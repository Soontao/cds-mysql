import "colors";
import flattenDeep from "@newdash/newdash/flattenDeep";
import uniq from "@newdash/newdash/uniq";
import { cwdRequireCDS, EntityDefinition, LinkedModel } from "cds-internal-tool";
import path from "path";
import { DataSourceOptions } from "typeorm";
import { SqlInMemory } from "typeorm/driver/SqlInMemory";
import { TypeORMLogger } from "./logger";
import { CDSMySQLDataSource } from "./mysql";
import { glob } from "glob";
import CSV from "@sap/cds/lib/compile/etc/csv";
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

      logger.info("start migration CSV provision data");

      for (const csvFile of csvList) {

        const filename = path.basename(csvFile, ".csv");
        const entityName = filename.replace(/[_-]/g, "."); // name_space_entity.csv -> name.space.entity

        if (entityName in model.definitions) {
          const meta = model.definitions[entityName] as EntityDefinition;

          const entires: Array<Array<string>> = CSV.read(csvFile);
          const tableName = entityName.replace(/\./g, "_");

          if (meta === undefined) {
            logger.warn(entityName, "is not in the model");
            continue;
          }

          const keys = Object.values(meta.elements)
            .filter((e: any) => e.key === true)
            .map((e: any) => e.name);

          const [headers, ...rows] = entires;

          const transformColumnsIndex = Object
            .values(meta.elements)
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

          const headerList = headers.join(", ");

          for (const entry of rows) {

            const keyExpr = entryToWhereExpr(entry);

            const [[{ EXIST }]] = await connection
              .query(`SELECT COUNT(1) as EXIST FROM ${tableName} WHERE ${keyExpr}`) as any;

            if (EXIST === 0) {
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
        } else {
          logger.warn("not found entity", entityName, "in definitions");
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
