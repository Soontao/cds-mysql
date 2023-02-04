/* eslint-disable max-len */
import { CDS, CSN, cwdRequireCDS, LinkedModel, Logger } from "cds-internal-tool";
import path from "path";
import { DataSource, DataSourceOptions } from "typeorm";
import { TENANT_DEFAULT } from "./constants";
import { formatTenantDatabaseName } from "./tenant";
import { migrate, migrateData } from "./typeorm";
import { csnToEntity } from "./typeorm/entity";
import { TypeORMLogger } from "./typeorm/logger";
import { CDSMySQLDataSource } from "./typeorm/mysql";
import { MysqlDatabaseOptions } from "./types";
import fs from "fs/promises";
import { migration_tool } from "./utils";


/**
 * get raw CSN from linked model
 * 
 * cannot be cached will cause stack overflow
 */
export const _rawCSN = async (m: LinkedModel) => {
  return cwdRequireCDS().load(m["$sources"]);
};

/**
 * Admin Tool for Database
 */
export class AdminTool {

  private _logger: Logger;

  private _options: MysqlDatabaseOptions;

  private _cds: CDS;

  /**
   * Admin Tool for Database
   * 
   * @param options service options
   */
  constructor(options?: any) {
    this._cds = cwdRequireCDS();
    this._logger = this._cds.log("db|mysql");
    this._options = options;
  }

  /**
   * get the database name of tenant
   * 
   * @param tenant 
   * @returns 
   */
  public getTenantDatabaseName(tenant: string = TENANT_DEFAULT) {

    const tenantDatabaseName = formatTenantDatabaseName(
      this._options?.credentials,
      this._options?.tenant?.prefix,
      tenant,
    );

    if (tenantDatabaseName.length > 64) {
      this._logger.warn("database name", tenantDatabaseName, "which for tenant", tenant, "is too long");
      throw this._cds.error("TENANT_DATABASE_NAME_TOO_LONG");
    }

    return tenantDatabaseName;
  }

  /**
   * get mysql connection credential
   * 
   * @param tenant 
   * @returns 
   */
  public getMySQLCredential(tenant: string): import("mysql2").ConnectionOptions {
    return {
      ...this._options.credentials,
      dateStrings: true,
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

    if (await this.hasTenantDatabase(tenant)) {
      this._logger.info(
        "try to create database for tenant",
        tenant.green,
        "but its already existed"
      );
      return;
    }

    await this.runWithAdminConnection(async ds => {
      const databaseName = this.getTenantDatabaseName(tenant);
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
    const { "cds.xt.ModelProviderService": mp } = this._cds.services;
    return mp.getCsn({ tenant, toggles: ["*"], activated: true });
  }

  /**
   * get typeorm ds option for migration or other usage
   * 
   * @param tenant 
   * @returns 
   */
  public async getDataSourceOption(tenant: string = TENANT_DEFAULT): Promise<DataSourceOptions> {
    const credentials = this.getMySQLCredential(tenant);
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
      name: `admin-conn-${this._cds.utils.uuid()}`,
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
    // TODO: maybe cache for seconds
    return this.runWithAdminConnection(async ds => {
      const tenantDatabaseName = this.getTenantDatabaseName(tenant);
      const [{ COUNT }] = await ds.query(
        "SELECT COUNT(*) AS COUNT FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
        [tenantDatabaseName]
      );
      return COUNT > 0;
    });

  }

  /**
   * sync tenant data model
   * 
   * @param tenant 
   * @param csn CSN, optional 
   * @returns 
   */
  public async syncTenant(tenant: string, csn?: CSN) {
    if (csn !== undefined) {
      await this.deploy(csn, tenant);
      return;
    }

    // if has tenant database & mtxs is enabled
    if (await this.hasTenantDatabase(tenant) && ("cds.xt.ModelProviderService" in this._cds.services)) {
      await this.deploy(await this.csn4(tenant), tenant);
      return;
    }

    await this.deploy(await _rawCSN(this._cds.db.model), tenant);
  }

  /**
   * deploy CSV (only) for tenant
   * 
   * @param tenant 
   */
  public async deployCSV(tenant?: string, csvList?: Array<string>) {
    // REVISIT: global model not suitable for extensibility
    await migrateData(this.getMySQLCredential(tenant), this._cds.model, csvList);
  }

  /**
   * deploy (migrate) database model into target tenant database
   * 
   * @param model plain CSN object
   * @param tenant tenant id
   * @returns 
   */
  public async deploy(model: CSN, tenant: string = TENANT_DEFAULT) {
    try {
      this._logger.info("migrating schema for tenant", tenant.green);

      if (tenant !== TENANT_DEFAULT) { await this.createDatabase(tenant); }
      const migrateOptions = await this.getDataSourceOption(tenant);

      if (
        this._options?.tenant?.deploy?.transparent === true &&
        this.getAdminTenantName() !== tenant // t0 need to use old way to deploy
      ) {
        this._logger.info("migrate with transparent approach");
        const migrations = migration_tool.parse(
          await fs.readFile(
            path.join(this._cds.root, "db/migrations.sql"),
            { encoding: "utf-8" }
          )
        );
        await migrate({ ...migrateOptions }, false, migrations);
      }
      else {
        const entities = csnToEntity(model);
        await migrate({ ...migrateOptions, entities });
      }

      if (this._options?.csv?.migrate !== false) {
        await this.deployCSV(tenant);
      }
      else {
        this._logger.info(
          "csv migration is disabled for tenant",
          tenant.green
        );
      }
      this._logger.info("migrate", "successful".green, "for tenant", tenant.green);
      return true;
    } catch (error) {
      this._logger.info("migrate", "failed".red, "for tenant", tenant.red, error);
      throw error;
    }
  }

  /**
   * get tenant 0 (admin tenant) name
   *
   * @returns
   */
  getAdminTenantName() {
    return process.env.CDS_REQUIRES_MULTITENANCY_T0 ?? "t0";
  }

  /**
   * get (lower case) tables of target tenant
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
   * get (lower case) columns of tables in target tenant
   * 
   * @param table table name
   * @param tenant tenant id
   * @returns 
   */
  async getColumns(table: string, tenant?: string): Promise<Array<string>> {
    return this.runWithAdminConnection(async ds => {
      const records = await ds.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE LOWER(TABLE_NAME) = ? AND TABLE_SCHEMA = ?`,
        [table.toLowerCase(), this.getTenantDatabaseName(tenant)],
      );
      return records.map(({ COLUMN_NAME }) => String(COLUMN_NAME).toLowerCase());
    });
  }

  /**
   * deploy admin tenant if required
   * 
   * @returns 
   */
  async deployT0() {
    const t0 = this.getAdminTenantName();
    this._logger.info("deploy admin tenant", t0.green);
    const t0_csn = await this._cds.load(path.join(__dirname, "../mtxs/t0.cds"));
    this._logger.debug("t0 entities", Object.keys(t0_csn.definitions));
    await this.deploy(t0_csn, t0);
  }

}