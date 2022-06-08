// @ts-nocheck
import { sleep } from "@newdash/newdash";
import { cwdRequireCDS } from "cds-internal-tool";
import path from "path";
import { ConnectionOptions, createConnection } from "typeorm";
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
  const mysqlOpt = { impl: path.join(__dirname, "../src"), dialect: "sqlite" };
  if (cds.env.requires.mysql === undefined) {
    cds.env.requires.mysql = mysqlOpt;
  } else {
    Object.assign(cds.env.requires.mysql, mysqlOpt);
  }
};

export const loadCSN = async (relativePath: string) => cwdRequireCDS().load(path.join(__dirname, relativePath));

export const getTestTypeORMOptions = () => {
  const cds = cwdRequireCDS("@sap/cds");
  const { credentials } = cds.requires.mysql;
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

export async function doAfterAll() {
  await sleep(100);
  await cleanDB();
  await cds?.db?.disconnect?.();
  await sleep(100);
}

export const cleanDB = async () => {
  const options: ConnectionOptions = {
    ...getTestTypeORMOptions(),
    name: "unit-test-clean-db",
  };
  const conn = await createConnection(options);
  try {
    await conn.createQueryRunner().clearDatabase();
  } finally {
    if (conn.isInitialized) { await conn.destroy(); }
  }

};

export function isTiDBTest() {
  return process.env.IS_TIDB === 'true'
}