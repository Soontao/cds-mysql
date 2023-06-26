/* eslint-disable max-len */
import { CSN, LinkedModel } from "cds-internal-tool";
import path from "path";
import { DataSource, DataSourceOptions } from "typeorm";
import { TENANT_DEFAULT } from "./constants";
import { formatTenantDatabaseName } from "./tenant";
import { migrate, migrateData } from "./typeorm";
import { csnToEntity } from "./typeorm/entity";
import { TypeORMLogger } from "./typeorm/logger";
import { CDSMySQLDataSource } from "./typeorm/mysql";
import fs from "fs/promises";
import { migration_tool, lazy } from "./utils";


export function getTenantDatabaseName(tenant: string = TENANT_DEFAULT) {
  const options = lazy.db_options;
  const tenantDatabaseName = formatTenantDatabaseName(
    options?.credentials,
    options?.tenant?.prefix,
    tenant,
  );

  if (tenantDatabaseName.length > 64) {
    lazy.logger.warn(
      "database name", tenantDatabaseName,
      "which for tenant", tenant, "is too long"
    );
    throw lazy.cds.error("TENANT_DATABASE_NAME_TOO_LONG");
  }

  return tenantDatabaseName;
}

/**
 * get mysql credential for tenant
 * 
 * @param tenant 
 * @returns 
 */
export function getMySQLCredential(tenant: string): import("mysql2").ConnectionOptions {
  return {
    ...lazy.db_options.credentials,
    dateStrings: true,
    database: getTenantDatabaseName(tenant),
  } as any;
}

export async function getDataSourceOption(tenant = TENANT_DEFAULT): Promise<DataSourceOptions> {
  const credentials = getMySQLCredential(tenant);
  return Object.assign(
    {},
    {
      name: `cds-deploy-connection-${tenant ?? "main"}`,
      type: "mysql",
      entities: []
    },
    credentials,
    {
      // typeorm need the 'username' field as username
      username: credentials.user
    }
  ) as any;
}

export async function csn4(tenant?: string) {
  const { "cds.xt.ModelProviderService": mp } = lazy.cds.services;
  return mp.getCsn({ tenant, toggles: ["*"], activated: true });
}

export async function runWithAdminConnection<T = any>(runner: (ds: DataSource) => Promise<T>): Promise<T> {
  const credential = await getDataSourceOption();
  const ds = await CDSMySQLDataSource.createDataSource({
    ...credential,
    name: `admin-conn-${lazy.cds.utils.uuid()}`,
    entities: [],
    type: "mysql",
    logger: TypeORMLogger,
    synchronize: false, // no sync
  } as any);

  try {
    return await runner(ds);
  }
  catch (err) {
    lazy.logger.error("run with admin connection failed", err);
    throw err;
  }
  finally {
    if (ds && ds.isInitialized) {
      await ds.destroy();
    }
  }
}


/**
 * get raw CSN from linked model
 * 
 * cannot be cached will cause stack overflow
 */
export const _rawCSN = async (m: LinkedModel) => {
  return lazy.cds.load(m["$sources"]);
};

/**
 * check tenant database is existed or not
 * 
 * @param tenant 
 * @returns 
 */
export async function hasTenantDatabase(tenant?: string) {
  // TODO: maybe cache for seconds
  return runWithAdminConnection(async ds => {
    const tenantDatabaseName = getTenantDatabaseName(tenant);
    const [{ COUNT }] = await ds.query(
      "SELECT COUNT(*) AS COUNT FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
      [tenantDatabaseName]
    );
    return COUNT > 0;
  });

}

/**
 * create a mysql 'database' for tenant
 * 
 * @param tenant 
 * @returns 
 */
export async function createDatabase(tenant: string): Promise<void> {
  if (tenant === undefined || tenant === TENANT_DEFAULT) {
    lazy.logger.debug("default tenant, skip creation database");
    return;
  }

  if (await hasTenantDatabase(tenant)) {
    lazy.logger.info(
      "try to create database for tenant",
      tenant.green,
      "but its already existed"
    );
    return;
  }

  await runWithAdminConnection(async ds => {
    const databaseName = getTenantDatabaseName(tenant);
    lazy.logger.info("creating database", databaseName);
    // mysql 5.6 not support 'if not exists'
    await ds.query(`CREATE DATABASE ${databaseName}`);
    lazy.logger.info("database", databaseName, "created");
  });

}

/**
 * drop database for tenant
 * 
 * @param tenant 
 */
export async function dropDatabase(tenant: string) {
  lazy.logger.info("drop database for tenant", tenant);

  if (tenant === undefined) {
    throw new Error("tenant id must be provided for database drop");
  }

  await runWithAdminConnection(async ds => {
    const databaseName = getTenantDatabaseName(tenant);
    lazy.logger.info("drop database", databaseName);
    await ds.query(`DROP DATABASE ${databaseName}`);
    lazy.logger.info("drop database", databaseName, "successful");
  });
}



/**
 * sync tenant data model
 * 
 * @param tenant 
 * @param csn CSN, optional 
 * @returns 
 */
export async function syncTenant(tenant: string, csn?: CSN) {
  if (csn !== undefined) {
    await deploy(csn, tenant);
    return;
  }

  // if has tenant database & mtxs is enabled
  if (await hasTenantDatabase(tenant) && ("lazy.cds.xt.ModelProviderService" in lazy.cds.services)) {
    await deploy(await csn4(tenant), tenant);
    return;
  }

  await deploy(await _rawCSN(lazy.cds.db.model), tenant);
}

/**
 * deploy CSV (only) for tenant
 * 
 * @param tenant 
 */
export async function deployCSV(tenant?: string, csvList?: Array<string>) {
  // REVISIT: global model not suitable for extensibility
  await migrateData(getMySQLCredential(tenant), lazy.cds.model, csvList);
}

/**
 * deploy (migrate) database model into target tenant database
 * 
 * @param model plain CSN object
 * @param tenant tenant id
 * @returns 
 */
export async function deploy(model: CSN, tenant: string = TENANT_DEFAULT) {
  try {
    lazy.logger.info("migrating schema for tenant", tenant.green);

    if (tenant !== TENANT_DEFAULT) { await createDatabase(tenant); }
    const migrateOptions = await getDataSourceOption(tenant);
    const options = lazy.db_options;
    if (
      options?.tenant?.deploy?.transparent === true &&
      getAdminTenantName() !== tenant // t0 need to use old way to deploy
    ) {
      lazy.logger.info("migrate with transparent approach");
      const migrations = migration_tool.parse(
        await fs.readFile(
          path.join(lazy.cds.root, "db/migrations.sql"),
          { encoding: "utf-8" }
        )
      );
      await migrate({ ...migrateOptions }, false, migrations);
    }
    else {
      const entities = csnToEntity(model);
      await migrate({ ...migrateOptions, entities });
    }

    if (options?.csv?.migrate !== false) {
      await deployCSV(tenant);
    }
    else {
      lazy.logger.info(
        "csv migration is disabled for tenant",
        tenant.green
      );
    }
    lazy.logger.info("migrate", "successful".green, "for tenant", tenant.green);
    return true;
  } catch (error) {
    lazy.logger.info("migrate", "failed".red, "for tenant", tenant.red, error);
    throw error;
  }
}

/**
 * get tenant 0 (admin tenant) name
 *
 * @returns
 */
export function getAdminTenantName() {
  return process.env.CDS_REQUIRES_MULTITENANCY_T0 ?? "t0";
}

/**
 * get (lower case) tables of target tenant
 * 
 * @param tenant 
 * @returns 
 */
export async function getTables(tenant?: string): Promise<Array<string>> {
  return runWithAdminConnection(async ds => {
    const tables = await ds.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = ?`,
      [getTenantDatabaseName(tenant)],
    );
    return tables.map(({ TABLE_NAME }) => String(TABLE_NAME).toLowerCase());
  });
}

/**
 * get (lower case) columns of tables in target tenant
 * 
 * @param table table name
 * @param tenant tenant id
 * @returns 
 */
export async function getColumns(table: string, tenant?: string): Promise<Array<string>> {
  return runWithAdminConnection(async ds => {
    const records = await ds.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE LOWER(TABLE_NAME) = ? AND TABLE_SCHEMA = ?`,
      [table.toLowerCase(), getTenantDatabaseName(tenant)],
    );
    return records.map(({ COLUMN_NAME }) => String(COLUMN_NAME).toLowerCase());
  });
}

/**
 * deploy admin tenant if required
 * 
 * @returns 
 */
export async function deployT0() {
  const t0 = getAdminTenantName();
  lazy.logger.info("deploy admin tenant", t0.green);
  const t0_csn = await lazy.cds.load(path.join(__dirname, "../mtxs/t0.cds"));
  lazy.logger.debug("t0 entities", Object.keys(t0_csn.definitions));
  await deploy(t0_csn, t0);
}

