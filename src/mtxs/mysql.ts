// @ts-nocheck
import { cwdRequireCDS } from "cds-internal-tool";

const cds = cwdRequireCDS(), { db } = cds.requires;
const LOG = cds.log("cds-mysql");

const Tenants = "cds.xt.Tenants";
const activated = db?.kind === "mysql" && "MySQL database";

if (activated) {

  /**
   * tenant 0 name
   * 
   * @returns 
   */
  function _t0() {
    return process.env.CDS_REQUIRES_MULTITENANCY_T0 ?? "t0";
  }

  cds.once("served", () => {

    const { "cds.xt.DeploymentService": ds } = cds.services;

    async function needsT0Redeployment() {
      const tables = await ds.getTables(_t0());
      if (!(tables.includes("cds_xt_jobs") && tables.includes("cds_xt_tenants"))) {
        return true;
      }
      return false;
    }

    async function resubscribeT0IfNeeded() {
      await ds.tx({ tenant: _t0() }, async tx => {
        if (!await needsT0Redeployment()) return;
        const csn = await cds.load(`${__dirname}/t0.cds`);
        await tx.subscribe({ tenant: this._t0, options: { csn } });
      });
    };

    ds.on("subscribe", async (req, next) => {
      await next();
      // REVISIT: Use UPSERT instead
      const { tenant: t, metadata } = req.data;
      if (t === _t0()) return await next();
      try {
        await cds.tx({ tenant: _t0() }, tx =>
          tx.run(INSERT.into(Tenants, { ID: t, metadata: JSON.stringify(metadata) }))
        );
      } catch (e) {
        if (e.message !== "ENTITY_ALREADY_EXISTS") throw e;
      }
    });

    ds.on("unsubscribe", async (req, next) => {
      await next();
      const { tenant: t } = req.data;
      await cds.tx({ tenant: _t0() }, tx =>
        tx.run(DELETE.from(Tenants).where({ ID: { "=": t } }))
      );
    });

    ds.on("subscribe", async function (req) {
      const { tenant: t, options } = req.data;
      return this.deploy(t, options);
    });

    ds.on("deploy", async function (req) {
      const { tenant: t, options } = req.data;
      const csn = await options?.csn || await csn4();
      LOG.info("(re-)deploying MySQL database for tenant:", t);
      cds.context = { tenant: t };
      return await cds.deploy(csn).to("db");
    });

    ds.on(["upgrade", "extend"], async function (req) {
      const { tenant: t } = req.data;
      return this.deploy(t, { csn: csn4(t) });
    });

    ds.on("unsubscribe", async function unsubscribe(req) {
      const { tenant: t } = req.data;
      await cds.db?.disconnect(t);
    });


    ds.on("hasTenant", async req => {
      const { tenant: t } = req.data;
      const tenantDatabaseName = cds.db._tenantProvider.getTenantDatabaseName(t);
      const [{ "count(*)": count }] = await cds.tx({ tenant: t }, tx =>
        tx.run(`SELECT COUNT(*) AS COUNT FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '${tenantDatabaseName}'`)
      );
      return count > 0;
    });

    ds.on("getTenantDb", req => {
      const { tenant: t } = req.data;
      return cds.db._tenantProvider.getCredential(t);
    });

    ds.on("getTables", async req => {
      const { tenant: t } = req.data;
      const tenantDatabaseName = cds.db._tenantProvider.getTenantDatabaseName(t);
      const records = await cds.tx({ tenant: t }, tx =>
        // eslint-disable-next-line max-len
        tx.run(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = '${tenantDatabaseName}'`)
      );
      return records.map(({ TABLE_NAME }) => String(TABLE_NAME).toLowerCase());
    });


    async function csn4(tenant?: string) {
      const { "cds.xt.ModelProviderService": mp } = cds.services;
      return mp.getCsn({ tenant, toggles: ["*"], activated: true }); // REVISIT: ['*'] should be the default
    }

    resubscribeT0IfNeeded().catch(LOG.error);

    // workaround for MySQL:
    if (!cds.env.requires.multitenancy) cds.env.requires.multitenancy = true;
  });
}

export { activated };