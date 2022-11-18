// @ts-nocheck
import { sleep } from "@newdash/newdash";
import { CSN, cwdRequireCDS } from "cds-internal-tool";
import path from "path";
import { DataSource, DataSourceOptions } from "typeorm";
import { v4 } from "uuid";
import { MYSQL_CHARSET } from "../src/constants";
import { formatTenantDatabaseName } from "../src/tenant";

require("dotenv").config();

/**
 * 
 * deploy CSN to database, and setup default database
 * 
 * @param csn 
 * 
 */
export async function deploy(csn: CSN) {
  const cds = cwdRequireCDS();
  const { MySQLDatabaseService } = require("../src/Service");
  cds.services.db = cds.db = new MySQLDatabaseService(
    "db",
    cds.linked(csn),
    cds.env.requires.db
  );
  await cds.db.init();
  await cds.db.deploy(csn);
}

export const createRandomName = () => v4().split("-").pop();

export const setupEnv = () => {
  const cds = cwdRequireCDS();
  const dbOpt = { kind: "mysql" };
  if (cds.env.requires.db === undefined) {
    cds.env.requires.db = dbOpt;
  } else {
    Object.assign(cds.env.requires.db, dbOpt);
  }
  const mysqlOpt = { impl: path.join(__dirname, "../src"), };
  if (cds.env.requires.db === undefined) {
    cds.env.requires.db = mysqlOpt;
  } else {
    Object.assign(cds.env.requires.db, mysqlOpt);
  }
};

export const loadCSN = async (relativePath: string) => cwdRequireCDS().load(path.join(__dirname, relativePath));

export const getTestTypeORMOptions = () => {
  const cds = cwdRequireCDS();
  const { credentials } = cds.requires?.db ?? {};
  return Object.assign(
    {},
    {
      type: "mysql",
      charset: MYSQL_CHARSET,
      entities: [],
    },
    { ...credentials },
    { username: credentials.user }
  );
};

/**
 * erase database table & data before each case
 */
export async function doBeforeEach() {
  await sleep(100);
  await cleanDB();
}

export async function doAfterAll() {
  await sleep(100);
  await cleanDB();
  await cds?.db?.disconnect?.();
  await sleep(100);
}

export const cleanDB = async () => {
  // after cds@6.3.0, alice and other dummy users will have default tenant id
  // so, clean all tenants database
  const options: DataSourceOptions = {
    ...getTestTypeORMOptions(),
    name: `unit-test-clean-db-${cds.utils.uuid()}`,
  };
  const ds = new DataSource(options);

  try {
    await ds.initialize();
    for (const tenant of [undefined, "t0", "t1", "t2", "t192", "e5f878d5-7985-407b-a1cb-87a8716f1904"]) {
      const database = formatTenantDatabaseName(cds.env.requires.db.credentials, undefined, tenant);
      const results = await ds.query(`SHOW DATABASES LIKE '${database}'`);
      if (results.length === 0) {
        continue;
      }
      if (tenant === undefined) {
        await ds.createQueryRunner().clearDatabase(database);
      } else {
        await ds.query(`DROP DATABASE ${database}`);
      }
    }
  }
  catch (error) {
    // do nothing
    console.debug("clean db failed", error.message, "but its ok");
  }
  finally {
    if (ds.isInitialized) { await ds.destroy(); }
  }
};
