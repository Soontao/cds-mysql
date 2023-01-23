/* eslint-disable prefer-const */
import flattenDeep from "@newdash/newdash/flattenDeep";
import { Semaphore } from "@newdash/newdash/functional/Semaphore";
import uniq from "@newdash/newdash/uniq";
import { cwdRequire, cwdRequireCDS, fuzzy, LinkedModel, memorized } from "cds-internal-tool";
import "colors";
import { createHash } from "crypto";
import fs from "fs";
import { glob } from "glob";
import { ConnectionOptions, createConnection } from "mysql2/promise";
import path from "path";
import { DEFAULT_CSV_IDENTITY_CONCURRENCY } from "../constants";
import { adaptToMySQLDateTime } from "../conversion-pre";

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


const TRANSFORM_CDS_TYPES = [
  "cds.Binary",
  "cds.LargeBinary",
  "cds.UInt8",
  "cds.Int16",
  "cds.Int32",
  "cds.Integer",
  "cds.DateTime",
  "cds.Timestamp",
];

/**
 * ref ../../index.cds
 */
const TABLE_CSV_HISTORY = "cds_mysql_csv_history";

const TABLE_COLUMN_PRE_DELIVERY = "PreDelivery";

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

  if (csvList.length === 0) {
    return;
  }

  logger.debug("csv migration list", csvList);

  const connection = await createConnection(credential as ConnectionOptions);

  try {

    await connection.beginTransaction();

    logger.info("start provisioning data with ", csvList.length, " CSV files");

    const [csvHistory] = await connection
      .query(`SHOW TABLES LIKE '${TABLE_CSV_HISTORY}'`) as Array<any>;

    const withHistoryTable = csvHistory?.length > 0;

    if (!withHistoryTable) {
      logger.warn("csv history table is not ready, cannot check CSV content is migrated before");
    }

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
              "file", csvFile.green,
              "with hash", csvFileHash.substring(32).gray,
              "has been provisioned before, skip processing"
            );
            continue;
          }
          else {
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

      /**
       * the entity has `preDelivery` `aspect` or not
       */
      const isPreDeliveryModel = (
        entityModel.includes?.includes?.("preDelivery") &&
        entityModel.elements?.["PreDelivery"]?.type === "cds.Boolean"
      );

      const CSV = cwdRequire("@sap/cds/lib/compile/etc/csv");
      const entires: Array<Array<string>> = CSV.read(csvFile);
      const tableName = entityName.replace(/\./g, "_");

      // >> check csv
      if (entires.length > 1) {
        logger.info(
          "filling entity", entityName.green,
          "with file", path.relative(process.cwd(), csvFile).green,
          "with", entires.length, "records"
        );
      }
      else {
        logger.warn(
          "file",
          path.relative(process.cwd(), csvFile).yellow,
          "is empty, skip processing"
        );
        continue;
      }

      let [headers, ...rows] = entires;

      // >> headers
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

      // if entity has preDelivery aspect but not provide PreDelivery column value 
      if (
        isPreDeliveryModel &&
        !headers.includes(TABLE_COLUMN_PRE_DELIVERY)
      ) {
        headers.push(TABLE_COLUMN_PRE_DELIVERY);
        rows = rows.map(row => [...row, true]) as any;
      }

      // >> keys
      /**
       * key names of entity
       */
      const keys = Object.values(entityModel.elements)
        .filter((e: any) => e.key === true)
        .map((e: any) => e.name);

      const existedKeysIndex = headers
        .filter(header => keys.includes(header))
        .map(existedKey => headers.indexOf(existedKey));

      if (existedKeysIndex.length !== keys.length) {
        logger.error(
          "file", csvFile.yellow,
          "does not provide enough primary keys", keys,
          "could not provision CSV, skip process"
        );
        throw cds.error("CSV file format error");
      }

      // >> transform rows
      const transformColumnsIndex = Object
        .values(entityModel.elements)
        .filter(ele => TRANSFORM_CDS_TYPES.includes(ele.type))
        .filter(ele => headers.includes(ele.name)) // only process columns in CSV files
        .map(ele => ({
          index: headers.indexOf(ele.name),
          type: ele.type,
          columnName: ele.name,
        }));

      if (transformColumnsIndex.length > 0) {
        logger.debug(
          "columns", transformColumnsIndex,
          "in entity", entityName.green, "need to be transformed"
        );
        transform(rows, transformColumnsIndex); // TODO: cache transoformed data for each csv file.
      }

      // >> database operation
      /**
       * full fresh new records, insert with batch
       */
      const batchInserts = [];

      const sem = new Semaphore(
        cds.env.get("requires.db.csv.identity.concurrency") ??
        DEFAULT_CSV_IDENTITY_CONCURRENCY
      );

      await Promise.all(
        rows.map(
          entry => sem.use(
            async function _csvRowProcessor() {
              const { expr, values } = entryToWhereExpr(entry, headers, existedKeysIndex);

              const [[{ EXIST }]] = await connection.query(
                `SELECT COUNT(1) AS EXIST FROM ?? WHERE ${expr}`,
                [tableName, ...values]
              ) as any;

              if (EXIST === 0) {
                batchInserts.push(entry); // fresh record, insert by batch
                return;
              }

              if (cds.env.get("requires.db.csv.exist.update") === true) {
                const {
                  expr: updateExprs,
                  values: updateValues
                } = entryToUpdateExpr(entry, headers, existedKeysIndex);
                const updateExpr = updateExprs.join(", ");
                await connection.query(
                  `UPDATE ?? SET ${updateExpr} WHERE ${expr}`,
                  [tableName, ...updateValues, ...values]
                );
                return;
              }

              logger.debug(
                "entity", entityName,
                "where", expr,
                "values", values,
                "is already existed, skip process"
              );

            }
          )
        )
      );


      // >> batch insert
      if (batchInserts.length > 0) {

        const headerList = headers.join(", ");

        logger.debug("batch inserts:", entityName, "with", batchInserts.length, "records");

        // REVISIT: column name
        const [{ affectedRows }] = await connection
          .query(`INSERT INTO ?? (${headerList}) VALUES ?`, [tableName, batchInserts]) as any;

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

  logger.info("CSV data provisioning successfully");

}

function entryToUpdateExpr(
  entry: string[],
  headers: string[],
  existedKeysIndex: number[],
): { expr: Array<string>; values: Array<any>; } {
  return headers
    .reduce((pre, cur, index) => {
      if (!existedKeysIndex.includes(index)) {
        // not keys
        pre.expr.push(`${cur} = ?`);
        pre.values.push(entry[index]);
      }
      return pre;
    }, { expr: [], values: [] });
}

function entryToWhereExpr(entry: Array<string>, headers: Array<string>, existedKeysIndex: Array<number>) {
  const expr = [];
  const values = [];

  for (const existedKeyIndex of existedKeysIndex) {
    expr.push(`${headers[existedKeyIndex]} = ?`);
    values.push(entry[existedKeyIndex]);
  }

  return {
    expr: expr.join(" AND "),
    values,
  };
};

/**
 * transport type
 * @private
 * @param rows 
 * @param transformColumnsIndex 
 */
function transform(rows: string[][], transformColumnsIndex: { index: number; type: string; columnName: string; }[]) {
  for (const entry of (rows as Array<Array<any>>)) {
    for (const transformColumn of transformColumnsIndex) {
      if (entry[transformColumn.index]?.trim?.().length > 0) {
        switch (transformColumn.type) {
          case "cds.Binary": case "cds.LargeBinary":
            entry[transformColumn.index] = Buffer.from(entry[transformColumn.index], "base64");
            break;
          case "cds.Integer":
            entry[transformColumn.index] = parseInt(entry[transformColumn.index], 10);
            break;
          case "cds.DateTime": case "cds.Timestamp":
            entry[transformColumn.index] = adaptToMySQLDateTime(entry[transformColumn.index]);
            break;
          default:
            break;
        }
      }
    }
  }
}

