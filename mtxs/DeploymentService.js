"use strict";
const { cwdRequireCDS } = require("cds-internal-tool");
const cds = cwdRequireCDS();
const LOG = cds.log("cds-mysql");
const Tenants = "cds.xt.Tenants";

/**
 * tenant 0 name
 *
 * @returns
 */
function _t0() {
  return process.env.CDS_REQUIRES_MULTITENANCY_T0 ?? "t0";
}

async function csn4(tenant) {
  const { "cds.xt.ModelProviderService": mp } = cds.services;
  return mp.getCsn({ tenant, toggles: ["*"], activated: true });
}
module.exports = class DeploymentService extends cds.ApplicationService {

  async resubscribeT0IfNeeded() {
    await this.tx({ tenant: _t0() }, async (tx) => {
      const csn = await cds.load(`${__dirname}/t0.cds`);
      await tx.deploy({ tenant: _t0(), options: { csn } });
    });
  }

  async init() {
    await super.init();
    this.on("subscribe", async (req, next) => {
      await next();
      // REVISIT: Use UPSERT instead
      const { tenant: t, metadata } = req.data;
      if (t === _t0())
        return await next();
      try {
        await cds.tx({ tenant: _t0() }, tx => tx.run(INSERT.into(
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
      await cds.tx({ tenant: _t0() }, tx => tx.run(DELETE.from(Tenants).where({ ID: { "=": t } })));
    });

    this.on("subscribe", async function (req) {
      const { tenant: t, options } = req.data;
      return this.deploy(t, options);
    });

    this.on("deploy", async function (req) {
      const { tenant: t, options } = req.data;
      const csn = await options?.csn || await csn4();
      LOG.info("(re-)deploying MySQL database for tenant:", t);
      cds.context = { tenant: t };
      return await cds.db.deploy(csn, { tenant: t });
    });

    this.on(["upgrade", "extend"], async function (req) {
      const { tenant: t } = req.data;
      return this.deploy(t, { csn: csn4(t) });
    });

    this.on("unsubscribe", async function unsubscribe(req) {
      const { tenant: t } = req.data;
      await cds.db?.disconnect(t);
    });

    this.on("hasTenant", async (req) => {
      const { tenant: t } = req.data;
      const tenantDatabaseName = cds.db._tenantProvider.getTenantDatabaseName(t);
      // eslint-disable-next-line max-len
      const [{ "COUNT": count }] = await cds.tx({ tenant: t }, tx => tx.run(`SELECT COUNT(*) AS COUNT FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '${tenantDatabaseName}'`));
      return count > 0;
    });

    this.on("getTenantDb", req => {
      const { tenant: t } = req.data;
      return cds.db._tenantProvider.getCredential(t);
    });

    this.on("getTables", async (req) => {
      const { tenant: t } = req.data;
      const tenantDatabaseName = cds.db._tenantProvider.getTenantDatabaseName(t);
      const records = await cds.tx({ tenant: t }, tx =>
        // eslint-disable-next-line max-len
        tx.run(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = '${tenantDatabaseName}'`));
      return records.map(({ TABLE_NAME }) => String(TABLE_NAME).toLowerCase());
    });

    await this.resubscribeT0IfNeeded();

    // workaround for MySQL:
    if (!cds.env.requires.multitenancy) { cds.env.requires.multitenancy = true; };
  }
};