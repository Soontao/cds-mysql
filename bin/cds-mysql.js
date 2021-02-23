#!/usr/bin/env node
const [, , action, model, to, db] = process.argv;

const deploy = async () => {
  const cds = require("@sap/cds");
  const cds_deploy = require("@sap/cds/lib/db/deploy");

  await cds.connect();
  // if you are using cds-mysql deploy, it will force to deploy to mysql
  await cds_deploy(model, {}).to("mysql");
};

switch (action) {
  case "deploy":
    deploy();
    break;
  default:
    break;
}