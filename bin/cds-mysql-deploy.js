#!/usr/bin/env node

(async () => {
  try {

    const path = require("path");
    const process = require("process");
    const { pick } = require("@newdash/newdash/pick");

    const _require = (id) => {
      if (require.resolve(id)) {
        return require(id);
      }
      const cwdPath = path.join(process.cwd, "node_modules", id);
      if (require.resolve(cwdPath)) {
        return require(cwdPath);
      }
      throw new Error(`can not found module ${id}`);
    };

    const cds = _require("@sap/cds");
    const logger = (cds.log)("mysql");
    const { env: { requires } } = cds;

    const model = await cds.load(
      requires.db.model || requires.mysql.model || ["srv"]
    );

    const credentials = Object.assign(
      {},
      requires.db.credentials,
      requires.mysql.credentials
    );

    const { csnToEntity, migrate } = require("../lib/typeorm");

    const connectionOptions = {
      name: "cds-deploy-connection",
      type: "mysql",
      username: credentials.user,
      password: credentials.password,
      database: credentials.database || credentials.user,
      host: credentials.host,
      port: parseInt(credentials.port) || 3306,
      entities: csnToEntity(model)
    };

    logger.info(
      "start database migration for ",
      pick(
        connectionOptions,
        "host",
        "username",
        "database",
      )
    );

    await migrate(connectionOptions);

    logger.info("migration successful");

  } catch (error) {
    console.error(error);
    process.exit(1);
  }

})();
