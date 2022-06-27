import flattenDeep from "@newdash/newdash/flattenDeep";
import uniq from "@newdash/newdash/uniq";
import CSV from "@sap/cds/lib/compile/etc/csv";
import { cwdRequireCDS, fuzzy, LinkedModel } from "cds-internal-tool";
import "colors";
import { createHash } from "crypto";
import fs from "fs";
import { glob } from "glob";
import { ConnectionOptions, createConnection } from "mysql2/promise";
import path from "path";

export const pGlob = (pattern: string) => new Promise<Array<string>>((res, rej) => {
  glob(pattern, (err, matches) => {
    if (err) {
      rej(err);
    } else {
      res(matches);
    }
  });
});

/**
 * get sha256 hash for a file content
 * 
 * @param filename 
 * @returns 
 */
export function sha256(filename: string) {
  return new Promise<string>((resolve, reject) => {
    try {
      const h = createHash("sha256");
      const fd = fs.createReadStream(filename);
      h.setEncoding("hex");
      fd.on("error", reject);
      fd.on("end", () => { h.end(); resolve(h.read()); });
      fd.pipe(h);
    }
    catch (error) {
      reject(error);
    }
  });

}


/**
 * migrate CSV data
 * 
 * @param credential 
 * @param model 
 * @param csvList 
 */
export async function migrateData(
  credential: ConnectionOptions,
  model: LinkedModel,
  csvList?: Array<string>
): Promise<void> {
  const logger = cwdRequireCDS().log("mysql|db|migrate|typeorm");
  csvList = uniq(
    csvList ?? flattenDeep(
      await Promise.all(
        // @ts-ignore
        model.$sources
          .map(path.dirname)
          .map((dir: string) => `${dir}/**/*.csv`) // TODO: only **/data, **/csv and **/src/data
          .map((pattern: string) => pGlob(pattern))
      )
    )
  );

  if (csvList.length > 0) {

    const connection = await createConnection(credential as ConnectionOptions);

    try {

      await connection.beginTransaction();

      logger.info("start migrate CSV provision data");

      for (const csvFile of csvList) {
        const filename = path.basename(csvFile, ".csv");
        const entityName = filename.replace(/[_-]/g, "."); // name_space_entity.csv -> name.space.entity

        const entityModel = fuzzy.findEntity(filename, model);

        if (entityModel === undefined) {
          logger.warn(entityName, "is not in the model");
          continue;
        }
        // check the CSV has been migrated or not
        const csvFileHash = await sha256(csvFile);
        const [csvFileHashExists] = await connection.query(
          "SELECT 1 FROM cds_mysql_csv_history WHERE entity = ? and hash = ?", [entityModel.name, csvFileHash]
        );
        if (csvFileHashExists instanceof Array && csvFileHashExists.length > 0) {
          logger.info(csvFile, "with hash", csvFileHash, "has been migrated before, skip");
          continue;
        }
        else {
          await connection.query(
            "INSERT INTO cds_mysql_csv_history (entity, hash) VALUES (?, ?)",
            [entityModel.name, csvFileHash]
          );
        }

        // eslint-disable-next-line max-len
        const isPreDeliveryModel = entityModel.includes?.includes?.("preDelivery") && entityModel.elements?.["PreDelivery"]?.type === "cds.Boolean";

        const entires: Array<Array<string>> = CSV.read(csvFile);
        const tableName = entityName.replace(/\./g, "_");

        const keys = Object.values(entityModel.elements)
          .filter((e: any) => e.key === true)
          .map((e: any) => e.name);

        let [headers, ...rows] = entires;

        // fuzzy mapping element
        headers = headers.map(header => {
          const element = fuzzy.findElement(entityModel, header);
          if (element === undefined) {
            throw new Error(`csv file '${csvFile}' column with header key '${header}' is not found in the entity '${entityModel.name}'`)
          }
          return element?.name
        })

        const transformColumnsIndex = Object
          .values(entityModel.elements)
          .filter(ele => ["cds.Binary", "cds.LargeBinary", "cds.Integer"].includes(ele.type))
          .map(ele => ({
            index: headers.indexOf(ele.name),
            type: ele.type,
            columnName: ele.name,
          }));


        const existedKeysIndex = headers
          .filter(header => keys.includes(header))
          .map(existedKey => headers.indexOf(existedKey));

        if (existedKeysIndex.length === 0) {
          logger.warn("csv", csvFile, "do not provide any primary key, could not execute CSV migration");
          continue;
        }

        if (transformColumnsIndex.length > 0) {
          logger.debug("exist blob column in entity, ", entityName, ", transform");
          for (const entry of rows) {
            for (const transformColumn of transformColumnsIndex) {
              if (entry[transformColumn.index].trim().length > 0) {
                switch (transformColumn.type) {
                  case "cds.Binary": case "cds.LargeBinary":
                    // @ts-ignore
                    entry[transformColumn.index] = Buffer.from(entry[transformColumn.index], "base64");
                    break;
                  case "cds.Integer":
                    // @ts-ignore
                    entry[transformColumn.index] = parseInt(entry[transformColumn.index], 10);
                  default:
                    break;
                }

              }
            }
          }
        }

        if (entires.length > 1) {
          logger.info("filling entity", entityName.green, "with file", path.relative(process.cwd(), csvFile).green);
        } else {
          logger.warn("CSV file", path.relative(process.cwd(), csvFile).green, "is empty, skip processing");
          continue;
        }

        const entryToWhereExpr = (entry: Array<string>) => {
          const keyValues = [];
          for (const existedKeyIndex of existedKeysIndex) {
            keyValues.push(`${headers[existedKeyIndex]} = '${entry[existedKeyIndex]}'`);
          }

          return keyValues.join(" AND ");
        };


        const batchInserts = [];
        if (isPreDeliveryModel) {
          headers.push("PreDelivery");
        }
        const headerList = headers.join(", ");

        for (const entry of rows) {

          const keyExpr = entryToWhereExpr(entry);

          const [[{ EXIST }]] = await connection
            .query(`SELECT COUNT(1) as EXIST FROM ${tableName} WHERE ${keyExpr}`) as any;

          if (EXIST === 0) {
            if (isPreDeliveryModel) { entry.push(true as any); }
            batchInserts.push(entry);
          }
          else {
            logger.debug("entity", entityName, "with key", keyExpr, "has existed, skip process");
          }
        }

        // batch insert
        if (batchInserts.length > 0) {

          logger.debug("batch inserts:", entityName, "with", batchInserts.length, "records");

          const [{ affectedRows }] = await connection
            .query(`INSERT INTO ${tableName} (${headerList}) VALUES ?`, [batchInserts]) as any;

          if (affectedRows !== batchInserts.length) {
            logger.warn(
              "batch insert records for entity", entityName,
              "with", batchInserts.length, "records",
              "but db affectRows is", affectedRows,
              "please CARE and CHECK the reason"
            );
          }

        }


      }
      await connection.commit();
      logger.info("migrate CSV finished");
    }
    catch (error) {
      await connection.rollback();
      logger.error("migrate CSV failed:", error);
      throw error;
    }
    finally {
      await connection.end();
    }
  }



  logger.info("CSV provision data migration successful");

}
