/* eslint-disable max-len */
import { CSN, cwdRequireCDS, LinkedModel, Logger, memorized } from "cds-internal-tool";
import { DataSource, DataSourceOptions } from "typeorm";
import { TENANT_DEFAULT } from "./constants";
import { MysqlDatabaseOptions } from "./Service";
import { formatTenantDatabaseName } from "./tenant";
import { migrate } from "./typeorm";
import { csnToEntity } from "./typeorm/entity";
import { TypeORMLogger } from "./typeorm/logger";
import { CDSMySQLDataSource } from "./typeorm/mysql";

export const _rawCSN = memorized(async (m: LinkedModel) => {
  return await cwdRequireCDS().load(m["$sources"]);
});

/**
 * Admin Tool for Database
 */
export class AdminTool {

  private _logger: Logger;

  private _options: MysqlDatabaseOptions;

  constructor() {
    this._logger = cwdRequireCDS().log("db|mysql");
    this._options = cwdRequireCDS().requires.db;
  }

  /**
   * get the database name of tenant
   * @param tenant 
   * @returns 
   */
  public getTenantDatabaseName(tenant: string = TENANT_DEFAULT) {
    // TODO: mysql have max length restriction for database
    return formatTenantDatabaseName(
      this._options?.credentials,
      this._options?.tenant?.prefix,
      tenant,
    );
  }

  /**
   * get mysql connection credential
   * 
   * @param tenant 
   * @returns 
   */
  public getMySQLCredential(tenant: string): Promise<import("mysql2").ConnectionOptions> {
    return {
      ...this._options.credentials,
      database: this.getTenantDatabaseName(tenant),
    } as any;
  }

  /**
   * create database for tenant
   * 
   * @param tenant tenant id
   * @returns 
   */
  public async createDatabase(tenant: string): Promise<void> {
    if (tenant === undefined || tenant === TENANT_DEFAULT) {
      this._logger.debug("default tenant, skip creation database");
      return;
    }

    const databaseName = this.getTenantDatabaseName(tenant);

    await this.runWithAdminConnection(async ds => {
      if (await this.hasTenantDatabase(tenant)) {
        this._logger.info(
          "try to create database",
          databaseName,
          "for tenant",
          tenant,
          "but its already existed"
        );
        return;
      }
      this._logger.info("creating database", databaseName);
      // mysql 5.6 not support 'if not exists'
      await ds.query(`CREATE DATABASE ${databaseName}`);
      this._logger.info("database", databaseName, "created");
    });

  }

  /**
   * drop database for tenant
   * 
   * @param tenant 
   */
  public async dropDatabase(tenant: string) {
    this._logger.info("drop database for tenant", tenant);

    if (tenant === undefined) {
      throw new Error("tenant id must be provided for database drop");
    }

    await this.runWithAdminConnection(async ds => {
      const databaseName = this.getTenantDatabaseName(tenant);
      this._logger.info("drop database", databaseName);
      await ds.query(`DROP DATABASE ${databaseName}`);
      this._logger.info("drop database", databaseName, "successful");
    });
  }

  /**
   * get csn for tenant
   * 
   * @param tenant 
   * @returns 
   */
  public async csn4(tenant?: string) {
    const { "cds.xt.ModelProviderService": mp } = cds.services;
    return (mp as any).getCsn({ tenant, toggles: ["*"], activated: true });
  }

  /**
   * get typeorm ds option for migration or other usage
   * 
   * @param tenant 
   * @returns 
   */
  public async getDataSourceOption(tenant: string = TENANT_DEFAULT): Promise<DataSourceOptions> {
    const credentials = await this.getMySQLCredential(tenant);
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

  /**
   * run admin operations
   * 
   * NOTICE, there is no pool for this queries
   * 
   * CAREFULLY use this please
   * 
   * @param runner 
   * @returns the returned value of runner 
   */
  public async runWithAdminConnection<T = any>(runner: (ds: DataSource) => Promise<T>): Promise<T> {
    const credential = await this.getDataSourceOption();
    const ds = new CDSMySQLDataSource({
      ...credential,
      name: `admin-conn-${cds.utils.uuid()}`,
      entities: [],
      type: "mysql",
      logger: TypeORMLogger,
      synchronize: false, // no sync
    } as any);

    try {
      await ds.initialize();
      return await runner(ds);
    }
    catch (err) {
      this._logger.error("run with admin connection failed", err);
      throw err;
    }
    finally {
      if (ds && ds.isInitialized) {
        await ds.destroy();
      }
    }
  }

  /**
   * check tenant database is existed or not
   * 
   * @param tenant 
   * @returns 
   */
  public async hasTenantDatabase(tenant?: string) {

    return this.runWithAdminConnection(async ds => {
      const tenantDatabaseName = this.getTenantDatabaseName(tenant);
      const [{ COUNT }] = await ds.query(
        "SELECT COUNT(*) AS COUNT FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
        [tenantDatabaseName]
      );
      return COUNT > 0;
    });

  }

  public async syncTenant(tenant: string, csn?: CSN) {
    if (csn !== undefined) {
      return await this.deploy(csn, tenant);
    }

    // if has tenant database & mtxs is enabled
    if (await this.hasTenantDatabase(tenant) && ("cds.xt.ModelProviderService" in cds.services)) {
      return await this.deploy(await this.csn4(tenant), tenant);
    }

    await this.deploy(await _rawCSN(cwdRequireCDS().db.model), tenant);
  }

  /**
   * deploy (migrate) schema to (tenant) database
   * 
   * @param model plain CSN object
   * @param tenant tenant id
   * @returns 
   */
  async deploy(model: CSN, tenant: string = TENANT_DEFAULT) {
    try {
      this._logger.info("migrating schema for tenant", tenant.green);
      if (tenant !== TENANT_DEFAULT) { await this.createDatabase(tenant); }
      const entities = csnToEntity(model);
      const migrateOptions = await this.getDataSourceOption(tenant);
      await migrate({ ...migrateOptions, entities });
      this._logger.info("migrate", "successful".green, "for tenant", tenant.green);
      return true;
    } catch (error) {
      this._logger.info("migrate", "failed".red, "for tenant", tenant.red, error);
      throw error;
    }
  }

  /**
   * get tenant 0 name
   *
   * @returns
   */
  getAdminTenantName() {
    return process.env.CDS_REQUIRES_MULTITENANCY_T0 ?? "t0";
  }

  /**
   * get tables of tenant
   * 
   * @param tenant 
   * @returns 
   */
  async getTables(tenant?: string): Promise<Array<string>> {
    return this.runWithAdminConnection(async ds => {
      const tables = await ds.query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = ?`,
        [this.getTenantDatabaseName(tenant)],
      );
      return tables.map(({ TABLE_NAME }) => String(TABLE_NAME).toLowerCase());
    });
  }

  /**
   * deploy admin tenant if required
   * 
   * @returns 
   */
  async deployT0() {
    const t0 = this.getAdminTenantName();
    // TODO: additional CSN configuration
    const csn = await cds.load(`${__dirname}/../mtxs/t0.cds`);
    this._logger.info("deploy admin tenant", t0);
    await this.deploy(csn, t0);
  }

}