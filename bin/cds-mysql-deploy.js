#!/usr/bin/env node

(async () => {
  try {
    require("colors");
    const assert = require("assert");
    const path = require("path");
    const process = require("process");
    const { get } = require("@newdash/newdash/get");
    const { pick } = require("@newdash/newdash/pick");
    const { flattenDeep } = require("@newdash/newdash/flattenDeep");
    const { migrateData } = require("../lib/typeorm/csv");
    const { checkCdsVersion } = require("../lib/utils");

    const _resolve = (id) => {
      return require.resolve(id, {
        paths: [
          path.join(process.cwd(), "node_modules", id),
          path.join(__dirname, "../node_modules", id),
        ]
      });
    };

    const _require = (id) => {
      if (_resolve(id)) {
        return require(_resolve(id));
      }
      throw new Error(`can not found module ${id}`);
    };

    const cds = _require("@sap/cds");
    const glob = _require("glob").sync;
    const logger = cds.log("mysql|db");
    const { env: { requires } } = cds;

    checkCdsVersion();

    try {

      /**
       * @type {import("@sap/cds/apis/csn").CSN}
       */
      const model = await cds.load(
        get(requires, "db.model") || get(requires, "mysql.model") || ["srv"]
      );

      const credentials = Object.assign(
        {},
        get(requires, "db.credentials"),
        get(requires, "mysql.credentials"),
      );

      assert.ok(credentials.user, "must defined user");
      assert.ok(credentials.password, "must defined password");
      assert.ok(credentials.host, "must defined host");

      const { csnToEntity, migrate } = require("../lib/typeorm");

      const connectionOptions = Object.assign(
        {},
        {
          name: `cds-deploy-connection`,
          type: "mysql",
          username: credentials.user,
          database: credentials.user,
          port: 3306,
          entities: csnToEntity(model)
        },
        credentials
      );

      logger.info(
        "start database schema migration for ",
        pick(
          connectionOptions,
          "host",
          "username",
          "database",
        )
      );

      await migrate(connectionOptions);

      logger.info("schema migration successful");

      /**
       * @type {import("@sap/cds/apis/services").DatabaseService}
       */
      const db = await cds.connect.to("db", {
        impl: path.join(__dirname, "../lib/index.js")
      });

      db.model = model;

      const csvFiles = flattenDeep(
        model.$sources
          .map(path.dirname)
          .map(dir => `${dir}/**/*.csv`)
          .map(pattern => glob(pattern))
      );

      await migrateData(db, csvFiles, model);

      await db.disconnect();

      process.exit(0);

    } catch (error) {
      logger.error(error);
      process.exit(1);
    }
  } catch (error) {
    console.error(`error happened ${error.message}`);
  }

})();
