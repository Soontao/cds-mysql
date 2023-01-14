/**
 * cds.xt.DeploymentService implementation, adapt cds-mysql capability
 */


import { BuiltInServices, cwdRequireCDS, Request } from "cds-internal-tool";
import "colors";
import type { MySQLDatabaseService } from "./Service";


export async function _impl_deployment_service(ds: BuiltInServices["cds.xt.DeploymentService"]) {
  const cds = cwdRequireCDS();
  const logger = cds.log("mtx");
  const CDS_XT_TENANTS = "cds.xt.Tenants";
  const { DELETE } = cds.ql;

  const db = cds.db as any as MySQLDatabaseService;
  const tool = db.getAdminTool();

  ds.on("subscribe", async (req) => {
    const { tenant: t, options, metadata } = req.data;
    await ds.deploy(t, options);
    if (t === tool.getAdminTenantName()) { return; }
    await cds.tx({ tenant: tool.getAdminTenantName() }, tx => tx.run(
      (cds.ql as any).UPSERT.into(CDS_XT_TENANTS).entries(
        { ID: t, metadata: JSON.stringify(metadata) }
      )
    ));
  });

  ds.on("unsubscribe", async (req) => {
    const { tenant: t } = req.data;
    if (t === tool.getAdminTenantName()) { return; }

    await tool.dropDatabase(t); // REVISIT: maybe an option avoid automatically drop
    await db.disconnect(t);
    await cds.tx(
      { tenant: tool.getAdminTenantName() },
      tx => tx.run(DELETE.from(CDS_XT_TENANTS).where({ ID: { "=": t } }))
    );
  });

  ds.on("deploy", async function (req) {
    const { tenant: t, options } = req.data;
    const csn = await options?.csn ?? await tool.csn4();
    logger.info("(re-)deploying database for tenant:", t.green);
    return await tool.deploy(csn, t);
  });

  ds.on(["upgrade", "extend"], async function (req) {
    const { tenant: t } = req.data;
    logger.info(req.event, "for tenant", t.green);
    return ds.deploy(t, { csn: await tool.csn4(t) });
  });

  ds.on("getTables", (req: Request) => tool.getTables(req.data.tenant));

  // since mtxs@1.4.0
  ds.on("getColumns" as any, req => tool.getColumns(req.data.table, req.data.tenant));

  await tool.deployT0();

  // workaround for MySQL:
  if (!cds.env.requires.multitenancy) { cds.env.requires.multitenancy = true; };
}