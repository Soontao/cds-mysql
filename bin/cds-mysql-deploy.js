#!/usr/bin/env node

(async () => {

  require("colors");
  const assert = require("assert");
  const path = require("path");
  const process = require("process");
  const { get } = require("@newdash/newdash/get");
  const { pick } = require("@newdash/newdash/pick");
  const zipObject = require("@newdash/newdash/zipObject").default;
  const { flattenDeep } = require("@newdash/newdash/flattenDeep");

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
  const CSV = _require("@sap/cds/lib/utils/csv");
  const logger = cds.log("mysql");
  const { env: { requires } } = cds;

  try {

    /**
     * @type {import("@sap/cds-reflect/apis/csn").CSN}
     */
    const model = await cds.load(
      get(requires, "db.model") || get(requires, "mysql.model") || ["srv"]
    );

    const credentials = Object.assign(
      {},
      get(requires, "db.credentials"),
      get(requires, "mysql.credentials")
    );

    assert.ok(credentials.user, "must defined user");
    assert.ok(credentials.password, "must defined password");
    assert.ok(credentials.host, "must defined host");

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
      impl: _resolve("cds-mysql")
    });

    db.model = model;

    const csvFiles = flattenDeep(
      model._sources
        .map(path.dirname)
        .map(dir => `${dir}/**/*.csv`)
        .map(pattern => glob(pattern))
    );

    if (csvFiles.length > 0) {

      logger.info("start migration CSV provision data");
      const tx = db.tx();

      try {

        for (const csvFile of csvFiles) {

          const filename = path.basename(csvFile, ".csv");
          const entity = filename.replace(/-/g, ".");
          const entires = CSV.read(csvFile);

          if (entity in model.definitions) {
            const meta = model.definitions[entity];
            const keys = Object
              .values(meta.elements)
              .filter(e => e.key === true)
              .map(e => e.name);

            if (keys.length === 0) {
              logger.warn(
                "entity",
                entity.green,
                "not have any keys, can not execute CSV migration"
              );
              continue;
            }

            const headers = entires[0];

            logger.info(
              "filling entity",
              entity.green,
              "with file",
              path.relative(process.cwd(), csvFile).green
            );

            const entryObjects = entires.slice(1).reduce((pre, row) => {
              pre.push(zipObject(headers, row)); return pre;
            }, []);

            for (const instance of entryObjects) {
              const keyFilter = keys.reduce(
                (pre, key) => { pre[key] = instance[key]; return pre; }, {}
              );
              // delete old data firstly by primary key
              await tx.run(DELETE.from(entity).where(keyFilter));
            }
            // batch insert
            await tx.run(INSERT.into(entity).entries(entryObjects));
          } else {
            logger.warn("not found entity", entity, "in definitions");
          }
        }

        await tx.commit();
      } catch (error) {
        await tx.rollback();
        throw error;
      }

      await db.disconnect();

      logger.info("CSV provision data migration successful");

    }

    process.exit(0);

  } catch (error) {
    logger.error(error);
    process.exit(1);
  }

})();
