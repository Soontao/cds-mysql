#!/usr/bin/env node

(async () => {

  const path = require("path");
  const process = require("process");
  const { pick } = require("@newdash/newdash/pick");
  const { flattenDeep } = require("@newdash/newdash/flattenDeep");

  const _resolve = (id) => {
    return require.resolve(id, {
      paths: [
        path.join(process.cwd(), "node_modules", id),
        path.join(__dirname, "../node_modules", id)
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
  const CSV = _require("@sap/cds/lib/utils/csv");
  const logger = cds.log("mysql");
  const { env: { requires } } = cds;

  try {

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

    const db = await cds.connect.to("db", {
      impl: _resolve("cds-mysql")
    });

    await migrate(connectionOptions);

    const csvFiles = flattenDeep(
      model._sources
        .map(path.dirname)
        .map(dir => `${dir}/**/*.csv`)
        .map(pattern => glob(pattern))
    );

    for (const csvFile of csvFiles) {
      const filename = path.basename(csvFile, ".csv");
      const entity = filename.replace(/-/g, ".");
      const entires = CSV.read(csvFile);
      if (entity in model.definitions) {
        logger.info("filling db", entity, "with file", csvFile);
        await db.run(
          INSERT
            .into(entity)
            .columns(...entires[0])
            .entries(entires.slice(1))
        );
      }
    }

    await db.disconnect();

    logger.info("migration successful");

  } catch (error) {
    logger.error(error);
    process.exit(1);
  }

})();
