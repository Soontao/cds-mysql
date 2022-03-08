// @ts-nocheck
import cds from "@sap/cds";
import path from "path";
import process from "process";
import { ConnectionOptions, createConnection } from "typeorm";
import { v4 } from "uuid";
import { MYSQL_CHARSET } from "../src/constants";
import { parseEnv } from "../src/env";


require("dotenv").config();

export const createRandomName = () => v4().split("-").pop();
export const setupEnv = () => {
  cds.env.requires.db = {
    kind: "mysql",
  };
  cds.env.requires.mysql = {
    impl: path.join(__dirname, "../src"),
    credentials: parseEnv(process.env, "cds")?.cds?.mysql ?? {}
  };
};

export const loadCSN = async (relativePath: string) => cds.load(path.join(__dirname, relativePath));

export const getTestTypeORMOptions = () => {
  const credential = parseEnv(process.env, "cds")?.cds?.mysql ?? {};
  return Object.assign (
    {},
    {
      type: "mysql",
      charset: MYSQL_CHARSET,
      entities: [],
    },
    credential,
    { username: credential.user }
  );
};

export const cleanDB = async () => {
  const options: ConnectionOptions = {
    ...getTestTypeORMOptions(),
    name: "unit-test-clean-db",
  };
  const conn = await createConnection(options);
  try {
    await conn.createQueryRunner().clearDatabase();
  } finally {
    if (conn.isConnected) { await conn.close(); }
  }

};
