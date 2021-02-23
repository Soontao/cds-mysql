#!/usr/bin/env node

(async () => {
  try {

    const cds = require("@sap/cds");
    const deploy = require("@sap/cds/lib/db/deploy");
    const { env: { requires } } = cds;
    const model = await cds.load(
      requires.db.model || requires.mysql.model || ["srv"]
    );
    // if you are using cds-mysql deploy, it will force to deploy to mysql
    await deploy(model, {}).to("mysql");

  } catch (error) {
    console.error(error);
    process.exit(1);
  }

})();
