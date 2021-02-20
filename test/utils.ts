// @ts-nocheck
import cds from "@sap/cds";
import path from "path";
import process from "process";
import { ConnectionOptions, createConnection } from "typeorm";
import { v4 } from "uuid";
import { MYSQL_CHARSET } from "../src/constants";

export const createRandomName = () => v4().split("-").pop();
export const setupEnv = () => {
  cds.env.requires.db = {
    kind: "mysql",
  };
  cds.env.requires.mysql = {
    impl: path.join(__dirname, "../src"),
    credentials: {
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT),
    }
  };
};

export const loadCSN = async (relativePath: string) => cds.load(path.join(__dirname, relativePath));

export const getTestTypeORMOptions = () => ({
  type: "mysql",
  username: process.env.MYSQL_USER,
  charset: MYSQL_CHARSET,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  host: process.env.MYSQL_HOST,
  port: parseInt(process.env.MYSQL_PORT),
  entities: [],
});

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
