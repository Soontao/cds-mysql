import { isEmpty, pick } from "@newdash/newdash";
import { toHashCode } from "@newdash/newdash/functional/toHashCode";
import type { CSN } from "@sap/cds/apis/csn";
import cds from "@sap/cds/lib";
import CSV from "@sap/cds/lib/compile/etc/csv";
import "colors";
import path from "path";
import MySQLDatabaseService from "..";


// @ts-ignore
const logger = cds.log("mysql|db");

/**
 * 
 * @param db database service
 * @param csvList 
 * @param model 
 */
export async function migrateData(db: MySQLDatabaseService, csvList: Array<string>, model: CSN) {
  if (csvList.length > 0) {

    logger.info("start migration CSV provision data");
    // @ts-ignore
    const tx = db.tx();

    try {

      for (const csvFile of csvList) {

        const filename = path.basename(csvFile, ".csv");
        const entity = filename.replace(/_/g, "."); // name_space_entity.csv -> name.space.entity
        const entires = CSV.read(csvFile);

        if (entity in model.definitions) {
          const meta = model.definitions[entity];
          // @ts-ignore
          const keys = Object.values(meta.elements).filter(e => e.key === true).map(e => e.name);

          if (keys.length === 0) {
            logger.warn(
              "entity",
              entity.green,
              "not have any keys, can not execute CSV migration"
            );
            continue;
          }

          if (entires.length > 1) {
            logger.info(
              "filling entity",
              entity.green,
              "with file",
              path.relative(process.cwd(), csvFile).green
            );
          } else {
            logger.warn(
              "CSV file",
              path.relative(process.cwd(), csvFile).green,
              "is empty, skip processing"
            );
            continue;
          }

          /**
           * @type {Array<string>}
           */
          const headers: Array<string> = entires[0];

          const convertObject = (entry: Array<string>) => {
            return headers.reduce(
              (pre, headerName, index) => {
                pre[headerName] = entry[index];
                return pre;
              }, {}
            );
          };

          const batchInserts = [];

          for (const entry of entires.slice(1)) {
            const entryObject = convertObject(entry);
            const keyFilter = pick(entryObject, keys);
            if (isEmpty(keyFilter)) {
              logger.error("entity", entity, "entry: ", entryObject, "not provide the key information");
              continue;
            }
            const dbRecord = await tx.run(SELECT.one(entity).where(keyFilter));
            if (dbRecord != null) {
              if (toHashCode(pick(dbRecord, headers)) != toHashCode(entryObject)) {
                await tx.run(
                  UPDATE
                    .entity(entity)
                    .byKey(keyFilter)
                    .with(entryObject)
                );
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
            await tx.run(INSERT.into(entity).columns(...headers).rows(batchInserts));
          }

        } else {
          logger.warn("not found entity", entity, "in definitions");
        }
      }

      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }

    logger.info("CSV provision data migration successful");

  }
}


