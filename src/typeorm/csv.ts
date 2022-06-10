import flattenDeep from "@newdash/newdash/flattenDeep";
import { toHashCode } from "@newdash/newdash/functional/toHashCode";
import { isEmpty } from "@newdash/newdash/isEmpty";
import { pick } from "@newdash/newdash/pick";
import cds from "@sap/cds/lib";
import CSV from "@sap/cds/lib/compile/etc/csv";
import "colors";
import path from "path";
import { glob } from "glob";
import type { MySQLDatabaseService } from "../Service";
import { DatabaseService, LinkedModel, TransactionMix } from "cds-internal-tool";

// @ts-ignore
const logger = cds.log("mysql|db");

const pGlob = (pattern: string) => new Promise<Array<string>>((res, rej) => {
  glob(pattern, (err, matches) => {
    if (err) {
      rej(err);
    } else {
      res(matches);
    }
  });
});

/**
 *
 * @param db database service
 * @param model
 * @param csvList csv file list
 */
export async function migrateData(db: MySQLDatabaseService, model: LinkedModel, csvList?: Array<string>) {

  csvList = csvList ?? flattenDeep(
    await Promise.all(
      // @ts-ignore
      model.$sources
        .map(path.dirname)
        .map((dir: string) => `${dir}/**/*.csv`)
        .map((pattern: string) => pGlob(pattern))
    )
  );

  if (csvList.length > 0) {
    
    await db.tx(async (tx: TransactionMix & DatabaseService) => {
      
      logger.info("start migration CSV provision data");

      for (const csvFile of csvList) {
        const filename = path.basename(csvFile, ".csv");
        const entity = filename.replace(/_/g, "."); // name_space_entity.csv -> name.space.entity
        const entires = CSV.read(csvFile);

        if (entity in model.definitions) {
          const meta: any = model.definitions[entity];

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

          /**
           * @type {Array<string>}
           */
          const headers: Array<string> = entires[0];

          const convertObject = (entry: Array<string>) => {
            return headers.reduce((pre, headerName, index) => {
              pre[headerName] = entry[index];
              return pre;
            }, {});
          };

          const batchInserts = [];

          for (const entry of entires.slice(1)) {
            const entryObject = convertObject(entry);
            const keyFilter = pick(entryObject, keys);
            if (isEmpty(keyFilter)) {
              logger.error("entity", entity, "entry: ", entryObject, "not provide the key information, skip process");
              continue;
            }
            const dbRecord = await tx.run(SELECT.one(entity).where(keyFilter));
            if (dbRecord != null) {
              if (toHashCode(pick(dbRecord, headers)) != toHashCode(entryObject)) {
                await tx.run(UPDATE.entity(entity).byKey(keyFilter).with(entryObject));
              } else {
                logger.debug("entity", entity, "entry:", keyFilter, "not changed, skipped process");
              }
            } else {
              batchInserts.push(entry);
            }
          }

          // batch insert
          if (batchInserts.length > 0) {
            logger.debug("batch inserts:", entity, "with", batchInserts.length, "records");
            await tx.run(
              INSERT.into(entity)
                .columns(...headers)
                .rows(batchInserts)
            );
          }
        } else {
          logger.warn("not found entity", entity, "in definitions");
        }
      }

      logger.info("CSV provision data migration successful");
    });

  }
}
