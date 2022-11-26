/* eslint-disable prefer-const */
import flattenDeep from "@newdash/newdash/flattenDeep";
import uniq from "@newdash/newdash/uniq";
import { cwdRequire, cwdRequireCDS, fuzzy, LinkedModel, memorized } from "cds-internal-tool";
import "colors";
import { createHash } from "crypto";
import fs from "fs";
import { glob } from "glob";
import { DateTime } from "luxon";
import { ConnectionOptions, createConnection } from "mysql2/promise";
import path from "path";
import { MYSQL_DATE_TIME_FORMAT } from "../constants";

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
 * @returns the hash or target file
 */
export const sha256 = memorized(
  function sha256(filename: string) {
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
);


const TRANSPORT_CDS_TYPES = [
  "cds.Binary",
  "cds.LargeBinary",
  "cds.UInt8",
  "cds.Int16",
  "cds.Int32",
  "cds.Integer",
  "cds.DateTime",
  "cds.Timestamp",
];

const TABLE_CSV_HISTORY = "community_mysql_csv_history";

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

  const cds = cwdRequireCDS();
  const logger = cds.log("db|mysql|migrate|typeorm");
  csvList = uniq(
    csvList ?? flattenDeep(
      await Promise.all(
        // @ts-ignore
        uniq(model.$sources.map(path.dirname))
          .map((dir: string) => `${dir}/{data,csv,src/data}/**/*.csv`)
          .map((pattern: string) => pGlob(pattern))
      )
    )
  );

  if (csvList.length > 0) {

    const connection = await createConnection(credential as ConnectionOptions);

    try {

      await connection.beginTransaction();

      logger.info("start provisioning data with CSV files");

      const [csvHistory] = await connection
        .query(`SHOW TABLES LIKE '${TABLE_CSV_HISTORY}'`) as any as Array<any>;

      const withHistoryTable = csvHistory?.length > 0;

      for (const csvFile of csvList) {
        const filename = path.basename(csvFile, ".csv");
        const entityName = filename.replace(/[_-]/g, "."); // name_space_entity.csv -> name.space.entity

        const entityModel = fuzzy.findEntity(filename, model);

        if (entityModel === undefined) {
          logger.warn(entityName, "is not in the model");
          continue;
        }

        // check the CSV has been provisioned or not
        const csvFileHash = await sha256(csvFile);

        // if csv history table was setup for target tenant
        if (withHistoryTable) {

          const [csvFileHashExists] = await connection.query(
            "SELECT ENTITY, HASH FROM ?? WHERE ENTITY = ? FOR UPDATE",
            [TABLE_CSV_HISTORY, entityModel.name, csvFileHash]
          ) as any as [Array<{ ENTITY: string, HASH: string }>];

          if (csvFileHashExists instanceof Array && csvFileHashExists.length > 0) {
            if (csvFileHashExists[0].HASH === csvFileHash) {
              logger.info(
                "file", csvFile,
                "with hash", csvFileHash,
                "has been provisioned before, skip processing"
              );
              continue;
            }
            else {
              // TODO: test CSV file change
              // existed but CSV hash different
              await connection.query(
                "UPDATE ?? SET HASH = ? WHERE ENTITY = ?",
                [TABLE_CSV_HISTORY, csvFileHash, entityModel.name]
              );
            }
          }
          else {
            await connection.query(
              "INSERT INTO ?? (entity, hash) VALUES (?, ?)",
              [TABLE_CSV_HISTORY, entityModel.name, csvFileHash]
            );
          }
        }
        else {
          logger.info("csv history table is not ready, skip duplicated migration check");
        }

        // eslint-disable-next-line max-len
        const isPreDeliveryModel = entityModel.includes?.includes?.("preDelivery") && entityModel.elements?.["PreDelivery"]?.type === "cds.Boolean";

        const CSV = cwdRequire("@sap/cds/lib/compile/etc/csv");
        const entires: Array<Array<string>> = CSV.read(csvFile);
        const tableName = entityName.replace(/\./g, "_");

        /**
         * key names of entity
         */
        const keys = Object.values(entityModel.elements)
          .filter((e: any) => e.key === true)
          .map((e: any) => e.name);

        let [headers, ...rows] = entires;

        // fuzzy mapping element
        headers = headers.map(header => {
          const element = fuzzy.findElement(entityModel, header);
          if (element === undefined) {
            throw cds.error(
              `csv file '${csvFile}' column ` +
              `with header key '${header}' is not found ` +
              `in the entity '${entityModel.name}'`
            );
          }
          return element?.name;
        });

        const transformColumnsIndex = Object
          .values(entityModel.elements)
          .filter(ele => TRANSPORT_CDS_TYPES.includes(ele.type))
          .map(ele => ({
            index: headers.indexOf(ele.name),
            type: ele.type,
            columnName: ele.name,
          }));


        const existedKeysIndex = headers
          .filter(header => keys.includes(header))
          .map(existedKey => headers.indexOf(existedKey));

        if (existedKeysIndex.length !== keys.length) {
          logger.warn(
            "file", csvFile.yellow,
            "do not provide enough primary keys",
            keys,
            "could not provision CSV, skip process"
          );
          continue;
        }

        if (transformColumnsIndex.length > 0) {
          logger.debug(
            "columns", transformColumnsIndex,
            "in entity", entityName.green, "need to be transformed"
          );
          for (const entry of (rows as Array<Array<any>>)) {
            for (const transformColumn of transformColumnsIndex) {
              if (entry[transformColumn.index]?.trim?.().length > 0) {
                switch (transformColumn.type) {
                  // REVISIT: if binary as where condition, here will have issue.
                  case "cds.Binary": case "cds.LargeBinary":
                    entry[transformColumn.index] = Buffer.from(entry[transformColumn.index], "base64");
                    break;
                  case "cds.Integer":
                    entry[transformColumn.index] = parseInt(entry[transformColumn.index], 10);
                    break;
                  case "cds.DateTime": case "cds.Timestamp":
                    entry[transformColumn.index] = DateTime
                      .fromISO(entry[transformColumn.index], { setZone: true })
                      .toUTC()
                      .toFormat(MYSQL_DATE_TIME_FORMAT);
                    break;
                  default:
                    break;
                }

              }
            }
          }
        }

        if (entires.length > 1) {
          logger.info(
            "filling entity", entityName.green,
            "with file", path.relative(process.cwd(), csvFile).green,
            "with", entires.length, "records"
          );
        } else {
          logger.warn(
            "file",
            path.relative(process.cwd(), csvFile).yellow,
            "is empty, skip processing"
          );
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
            // REVISIT: parameter: UPDATE or SKIP
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
      logger.info("provision CSV finished");
    }
    catch (error) {
      await connection.rollback();
      logger.error("provision CSV failed:", error);
      throw error;
    }
    finally {
      await connection.end();
    }
  }


  logger.info("CSV provision data migration successful");

}
