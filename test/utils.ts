// @ts-nocheck
import { cwdRequireCDS } from "cds-internal-tool";
import path from "path";
import { ConnectionOptions, createConnection } from "typeorm";
import { v4 } from "uuid";
import { MYSQL_CHARSET } from "../src/constants";

require("dotenv").config();

export const createRandomName = () => v4().split("-").pop();

export const setupEnv = () => {
  const cds = cwdRequireCDS();
  cds.env.requires.db.kind = "mysql";
  cds.env.requires.mysql = { impl: path.join(__dirname, "../src"), dialect: "sqlite" };
};

export const loadCSN = async (relativePath: string) => cwdRequireCDS().load(path.join(__dirname, relativePath));

export const getTestTypeORMOptions = () => {
  const cds = cwdRequireCDS("@sap/cds");
  const { credentials } = cds.requires.db;
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
