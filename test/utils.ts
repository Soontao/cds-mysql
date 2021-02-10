// @ts-nocheck
import cds from "@sap/cds";
import path from "path";
import { v4 } from "uuid";

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