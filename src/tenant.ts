import cloneDeep from "@newdash/newdash/cloneDeep";
import { cwdRequireCDS, Logger } from "cds-internal-tool";
import { ConnectionOptions, createConnection } from "mysql2/promise";
import { TENANT_DEFAULT } from "./constants";
import { MysqlDatabaseOptions, MySQLDatabaseService } from "./Service";
import { MySQLCredential } from "./types";

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

  protected getTenantDatabaseName(tenant: string = TENANT_DEFAULT) {
    if (tenant === TENANT_DEFAULT) {
      return this.options.credentials.database ?? this.options.credentials.user;
    }
    const tenant_db_prefix = this.options?.tenant?.prefix ?? "tenant_db";
    const candidate_name = [tenant_db_prefix, "_", tenant].join("");
    return candidate_name.replace(/[\W]+/g, "_");;
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