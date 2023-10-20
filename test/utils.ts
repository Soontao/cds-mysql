/* eslint-disable max-len */
// @ts-nocheck
import { sleep } from "@newdash/newdash";
import { CSN, cwdRequireCDS } from "cds-internal-tool";
import path from "path";
import { spawn, SpawnOptionsWithoutStdio } from "child_process";
import { DataSource, DataSourceOptions } from "typeorm";
import { MYSQL_CHARSET } from "../src/constants";

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
  cds.model = cds.linked(csn);
  cds.services.db = cds.db = new MySQLDatabaseService(
    "db",
    cds.model,
    cds.env.requires.db
  );
  await cds.db.init();
  await cds.db.deploy(csn);
}

export const createRandomName = () => cwdRequireCDS().utils.uuid().split("-").pop();

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

export const loadMigrateStepCSN = async (step: number) => loadCSN(`./resources/migrate/step-${step}.cds`);

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
  await sleep(500);
  await cleanDB();
  await cds?.db?.disconnect?.("*");
  await sleep(500);
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
    for (const tenant of [undefined, "t0", "t1", "t2", "t192", "e5f878d5-7985-407b-a1cb-87a8716f1904", "15a1fbc8-79c0-4324-ba79-e96d359e60bd"]) {
      const { formatTenantDatabaseName } = require("../src/admin-tool");
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

export function createSh(options: SpawnOptionsWithoutStdio & { stdPipe?: boolean }) {
  return function sh(...command: Array<string>) {
    const p = spawn(command[0], command.slice(1), options);
    if (options.stdPipe !== false) {
      p.stdout.pipe(process.stdout);
      p.stderr.pipe(process.stderr);
    }
    return new Promise((resolve, reject) => {
      p.on("error", reject);
      p.on("exit", resolve);
    });
  };

}

