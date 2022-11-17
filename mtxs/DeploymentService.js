"use strict";
const { cwdRequireCDS } = require("cds-internal-tool");
const cds = cwdRequireCDS();
const logger = cds.log("mtx");
const CDS_XT_TENANTS = "cds.xt.Tenants";

module.exports = class DeploymentService extends cds.ApplicationService {

  async init() {
    await super.init();

    /**
     * @type {import("../src/Service").MySQLDatabaseService}
     */
    const db = cds.db;
    const tool = db.getAdminTool();

    this.on("subscribe", async (req) => {
      const { tenant: t, options, metadata } = req.data;
      await this.deploy(t, options);
      if (t === tool.getAdminTenantName()) { return; }
      await cds.tx({ tenant: tool.getAdminTenantName() }, tx => tx.run(
        db.upsert(CDS_XT_TENANTS).entries(
          { ID: t, metadata: JSON.stringify(metadata) }
        )
      ));
    });

    this.on("unsubscribe", async (req) => {
      const { tenant: t } = req.data;
      if (t === tool.getAdminTenantName()) { return; }

      await tool.dropDatabase(t); // REVISIT: maybe an option avoid automatically drop
      await db.disconnect(t);
      await cds.tx(
        { tenant: tool.getAdminTenantName() },
        tx => tx.run(DELETE.from(CDS_XT_TENANTS).where({ ID: { "=": t } }))
      );
    });

    this.on("deploy", async function (req) {
      const { tenant: t, options } = req.data;
      const csn = await options?.csn ?? await tool.csn4();
      logger.info("(re-)deploying database for tenant:", t);
      return await tool.deploy(csn, t);
    });

    this.on(["upgrade", "extend"], async function (req) {
      const { tenant: t } = req.data;
      logger.info(req.event, "for tenant", t);
      return this.deploy(t, { csn: await tool.csn4(t) });
    });

    this.on("getTables", (req) => tool.getTables(req.data.tenant));

    await tool.deployT0();

    // workaround for MySQL:
    if (!cds.env.requires.multitenancy) { cds.env.requires.multitenancy = true; };
  }
};