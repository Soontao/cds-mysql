import { cwdRequireCDS, Logger } from "cds-internal-tool";
import { ConnectionOptions, createConnection } from "mysql2/promise";
import { TENANT_DEFAULT } from "./constants";
import { MysqlDatabaseOptions, MySQLDatabaseService } from "./Service";
import { MySQLCredential } from "./types";


// TODO: maybe fully replaced with @sap/cds-mtxs module

export function formatTenantDatabaseName(
  credentials: MySQLCredential,
  tenant_db_prefix = "tenant_db",
  tenant: string = TENANT_DEFAULT
) {
  if (tenant === TENANT_DEFAULT) {
    return credentials?.database ?? credentials?.user;
  }
  return [tenant_db_prefix, "_", tenant].join("").replace(/[\W]+/g, "_");;
}

export abstract class TenantProvider {

  protected _db: MySQLDatabaseService;

  protected _logger: Logger;

  /**
   * get the database options
   */
  protected get options(): MysqlDatabaseOptions {
    // @ts-ignore
    return this._db.options;
  }

  constructor(db: MySQLDatabaseService) {
    this._db = db;
    this._logger = cwdRequireCDS().log("tenant");
  }

  public getTenantDatabaseName(tenant: string = TENANT_DEFAULT) {
    return formatTenantDatabaseName(this.options?.credentials, this.options?.tenant?.prefix, tenant);
  }

  /**
   * create (mysql) database with tenant id
   * 
   * @param tenant tenant id
   */
  abstract createDatabase(tenant?: string): Promise<void>;

  /**
   * get (mysql) database credential with tenant id
   * 
   * @param tenant 
   */
  abstract getCredential(tenant?: string): Promise<ConnectionOptions>;

}

/**
 * share database tenant provide
 * 
 * all tenants are saved in single MySQL database, isolated by MySQL `Database`
 */
export class ShareMysqlTenantProvider extends TenantProvider {

  public async createDatabase(tenant: string): Promise<void> {
    if (tenant === undefined || tenant === TENANT_DEFAULT) {
      this._logger.debug("default tenant, skip creation database");
      return;
    }

    const defaultTenantCredential = await this.getCredential(TENANT_DEFAULT);
    const defaultTenantConnection = await createConnection(defaultTenantCredential);

    try {
      const databaseName = this.getTenantDatabaseName(tenant);
      const [results] = await defaultTenantConnection.query(`SHOW DATABASES LIKE '${databaseName}';`);
      // @ts-ignore
      if (results?.length === 0) {
        this._logger.info("creating database", databaseName);
        await defaultTenantConnection.query(`CREATE DATABASE \`${databaseName}\``); // mysql 5.6 not support 'if not exists'
        this._logger.info("database", databaseName, "created");
      }
      else {
        this._logger.debug("database", databaseName, "is existed, skip process");
      }
    }
    finally {
      await defaultTenantConnection.end();
    }
  }

  public async getCredential(tenant: string): Promise<ConnectionOptions> {
    return {
      ...this.options.credentials,
      database: this.getTenantDatabaseName(tenant)
    } as any;
  }

}