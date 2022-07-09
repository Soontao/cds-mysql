// @ts-nocheck
import { sleep } from "@newdash/newdash";
import { cwdRequireCDS } from "cds-internal-tool";
import path from "path";
import { DataSource, DataSourceOptions } from "typeorm";
import { v4 } from "uuid";
import { MYSQL_CHARSET } from "../src/constants";

require("dotenv").config();

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
  const options: DataSourceOptions = {
    ...getTestTypeORMOptions(),
    name: "unit-test-clean-db",
  };
  const ds = new DataSource(options);
  try {
    await ds.initialize();
    await ds.createQueryRunner().clearDatabase();
  } finally {
    if (ds.isInitialized) { await ds.destroy(); }
  }

};

export function isTiDBTest() {
  return process.env.IS_TIDB === "true";
}