"use strict";
const { cwdRequireCDS } = require("cds-internal-tool");
const cds = cwdRequireCDS();
const logger = cds.log("cds-mysql");
const Tenants = "cds.xt.Tenants";

module.exports = class DeploymentService extends cds.ApplicationService {

  async init() {
    await super.init();

    /**
     * @type {import("../src/Service").MySQLDatabaseService}
     */
    const db = cds.db;
    const tool = db.getAdminTool();

    this.on("subscribe", async (req, next) => {
      await next();
      // REVISIT: Use UPSERT instead
      const { tenant: t, metadata } = req.data;
      if (t === tool.getAdminTenantName())
        return await next();
      try {
        await cds.tx({ tenant: tool.getAdminTenantName() }, tx => tx.run(INSERT.into(
          Tenants,
          { ID: t, metadata: JSON.stringify(metadata) }
        )));
      }
      catch (e) {
        if (e.message !== "ENTITY_ALREADY_EXISTS")
          throw e;
      }
    });

    this.on("unsubscribe", async (req, next) => {
      await next();
      const { tenant: t } = req.data;
      await cds.tx({ tenant: tool.getAdminTenantName() }, tx => tx.run(DELETE.from(Tenants).where({ ID: { "=": t } })));
    });

    this.on("subscribe", async function (req) {
      const { tenant: t, options } = req.data;
      return this.deploy(t, options);
    });

    this.on("deploy", async function (req) {
      const { tenant: t, options } = req.data;
      const csn = await options?.csn || await tool.csn4();
      logger.info("(re-)deploying MySQL database for tenant:", t);
      return await tool.deploy(csn, t);
    });

    this.on(["upgrade", "extend"], async function (req) {
      const { tenant: t } = req.data;
      return this.deploy(t, { csn: await tool.csn4(t) });
    });

    this.on("unsubscribe", async function unsubscribe(req) {
      const { tenant: t } = req.data;
      // TODO: configuration of really DROP database
      await cds.db?.disconnect(t);
    });

    this.on("getTables", async (req) => {
      const { tenant: t } = req.data;
      return tool.getTables(t);
    });

    await tool.deployT0();

    // workaround for MySQL:
    if (!cds.env.requires.multitenancy) { cds.env.requires.multitenancy = true; };
  }
};