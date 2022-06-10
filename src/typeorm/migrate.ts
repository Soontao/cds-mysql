import "colors";
import flattenDeep from "@newdash/newdash/flattenDeep";
import uniq from "@newdash/newdash/uniq";
import { cwdRequireCDS, LinkedModel } from "cds-internal-tool";
import path from "path";
import { DataSourceOptions } from "typeorm";
import { SqlInMemory } from "typeorm/driver/SqlInMemory";
import { TypeORMLogger } from "./logger";
import { CDSMySQLDataSource } from "./mysql";
import { glob } from "glob";
import CSV from "@sap/cds/lib/compile/etc/csv";
import pick from "@newdash/newdash/pick";
import isEmpty from "@newdash/newdash/isEmpty";
import { MySQLCredential } from "../types";
import { ConnectionOptions, createConnection } from "mysql2/promise";

const pGlob = (pattern: string) => new Promise<Array<string>>((res, rej) => {
  glob(pattern, (err, matches) => {
    if (err) {
      rej(err);
    } else {
      res(matches);
    }
  });
});

export async function migrate(connectionOptions: DataSourceOptions, dryRun: true): Promise<SqlInMemory>;
export async function migrate(connectionOptions: DataSourceOptions, dryRun?: false): Promise<void>;
export async function migrate(connectionOptions: DataSourceOptions, dryRun = false): Promise<any> {
  const logger = cwdRequireCDS().log("mysql|db|migrate|typeorm");
  // TODO: lock for migration
  const ds = new CDSMySQLDataSource({
    ...connectionOptions,
    logging: true,
    logger: new TypeORMLogger()
  });

  try {
    await ds.initialize();
    const builder = ds.driver.createSchemaBuilder();
    // dry run and return the DDL SQL
    if (dryRun) {
      return await builder.log();
    }
    await builder.build(); // execute build
  }
  catch (error) {
    logger.error("migrate database failed:", error);
    throw error;
  }
  finally {
    if (ds.isInitialized) {
      await ds.destroy();
    }
  }
}

export async function migrateData(
  credential: MySQLCredential,
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

      logger.info("start migration CSV provision data");

      for (const csvFile of csvList) {

        const filename = path.basename(csvFile, ".csv");
        const entity = filename.replace(/[_-]/g, "."); // name_space_entity.csv -> name.space.entity

        if (entity in model.definitions) {
          const meta: any = model.definitions[entity];

          const entires: Array<Array<string>> = CSV.read(csvFile);
          const tableName = entity.replace(/\./g, "_");

          if (meta === undefined) {
            logger.warn(entity, "is not in the model");
            continue;
          }
          const keys = Object.values(meta.elements)
            .filter((e: any) => e.key === true)
            .map((e: any) => e.name);

          if (keys.length === 0) {
            logger.warn("entity", entity.green, "not have any keys, can not execute CSV migration");
            continue;
          }

          if (entires.length > 1) {
            logger.info("filling entity", entity.green, "with file", path.relative(process.cwd(), csvFile).green);
          } else {
            logger.warn("CSV file", path.relative(process.cwd(), csvFile).green, "is empty, skip processing");
            continue;
          }

          const [headers, ...values] = entires;

          const convertObject = (entry: Array<string>) => {
            return headers.reduce((pre, headerName, index) => {
              // TODO: check model
              pre[headerName] = entry[index];
              return pre;
            }, {});
          };

          const batchInserts = [];

          const headerList = headers.join(", ");

          for (const entry of values) {
            const entryObject = convertObject(entry);
            const keyFilter = pick(entryObject, keys);
            if (isEmpty(keyFilter)) {
              logger.error("entity", entity, "entry: ", entryObject, "not provide the key information, skip process");
              continue;
            }

            // TODO: other type test
            const keyExpr = Object.entries(keyFilter).map(([key, value]) => `${key} = '${value}'`).join(" AND ");

            const [[{ EXIST }]] = await connection
              .query(`SELECT COUNT(1) as EXIST FROM ${tableName} WHERE ${keyExpr}`) as any;

            if (EXIST === 0) {
              batchInserts.push(entry);
            }
            else {
              logger.debug("entity", entity, "with key", keyFilter, "has existed, no process");
            }
          }

          // batch insert
          if (batchInserts.length > 0) {
            logger.debug("batch inserts:", entity, "with", batchInserts.length, "records");

            const [{ affectedRows }] = await connection
              .query(`INSERT INTO ${tableName} (${headerList}) VALUES ?`, [batchInserts]) as any;

            if (affectedRows !== batchInserts.length) {
              logger.warn(
                "batch insert records for entity", entity,
                "with", batchInserts.length, "records",
                "but db affectRows is", affectedRows,
                "please CARE and CHECK the reason"
              );
            }

          }
        } else {
          logger.warn("not found entity", entity, "in definitions");
        }

      }
      await connection.commit();
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
