// @ts-nocheck
import { cloneDeep } from "@newdash/newdash";
import { LRUCacheProvider } from "@newdash/newdash/cacheProvider";
import { defaultsDeep } from "@newdash/newdash/defaultsDeep";
import cds from "@sap/cds/lib";
import DatabaseService from "@sap/cds/libx/_runtime/sqlite/Service";
import { config } from "dotenv";
import { createPool, Pool } from "generic-pool";
import { Connection, createConnection } from "mysql2/promise";
import { ConnectionOptions } from "typeorm";
import {
  CONNECTION_IDLE_CHECK_INTERVAL,
  DEFAULT_CONNECTION_IDLE_TIMEOUT,
  DEFAULT_TENANT_CONNECTION_POOL_SIZE,
  MAX_QUEUE_SIZE,
  TENANT_DEFAULT
} from "./constants";
import { parseEnv } from "./env";
import execute from "./execute";
import { csnToEntity, migrate } from "./typeorm";

config(); // load config from dot env file

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LOG = (cds.log || cds.debug)("mysql|db");

interface MySQLCredential {
  /**
   * DB User Name
   */
  user: string;
  /**
   * DB Password
   */
  password?: string;
  /**
   * DB Database/Schema Name, default same with user name
   */
  database?: string;
  /**
   * DB HostName, default localhost
   */
  host?: string;
  /**
   * DB Connection Port, default 3306
   */
  port?: string | number;

  ssl?: {
    /**
     * SSL ca cert in PEM text format 
     */
    ca?: string;
  }
}

const envCredential = parseEnv(process.env, "cds")?.cds?.mysql ?? {};

/**
 * MySQL Database Adapter for SAP CAP Framework
 */
export class MySQLDatabaseService extends DatabaseService {
  constructor(...args: any[]) {
    super(...args);

    // REVISIT: official db api
    this._execute = execute;

    // REVISIT: official db api
    this._insert = this._queries.insert(execute.insert);
    this._read = this._queries.read(execute.select, execute.stream);
    this._update = this._queries.update(execute.update, execute.select);
    this._delete = this._queries.delete(execute.delete);
    this._run = this._queries.run(this._insert, this._read, this._update, this._delete, execute.cqn, execute.sql);

    this._pools = new LRUCacheProvider(1024);
  }

  private _pools: LRUCacheProvider<string, Pool<Connection>>;

  /**
   * get connection pool for tenant
   *
   * connection pool is independent for tenant
   *
   * @param tenant
   */
  private async getPool(tenant = TENANT_DEFAULT): Promise<Pool<Connection>> {
    return this._pools.getOrCreate(tenant, async () => {
      const credential = await this.getTenantCredential(tenant);
      return createPool(
        {
          create: () => createConnection({ ...credential, dateStrings: true }),
          destroy: (conn) => conn.destroy()
        },
        {
          min: 0, // keep zero connection when whole tenant idle
          max: DEFAULT_TENANT_CONNECTION_POOL_SIZE,
          maxWaitingClients: MAX_QUEUE_SIZE,
          evictionRunIntervalMillis: CONNECTION_IDLE_CHECK_INTERVAL,
          idleTimeoutMillis: DEFAULT_CONNECTION_IDLE_TIMEOUT,
          ...this.options?.pool // overwrite by cds
        }
      );
    });
  }

  /**
   * overwrite this method to provide different databases for different tenants
   *
   * @param tenant
   */
  private async getTenantCredential(tenant?: string): Promise<MySQLCredential> {
    const rt: MySQLCredential = defaultsDeep(cloneDeep(this.options.credentials), envCredential);
    if (tenant !== TENANT_DEFAULT) {
      rt.database = tenant;
    }
    return rt;
  }

  /**
   * acquire connection from pool
   *
   * @override
   * @param arg
   */
  public async acquire(arg: any) {
    const tenant = (typeof arg === "string" ? arg : arg.user.tenant) || TENANT_DEFAULT;
    const pool = await this.getPool(tenant);
    const conn = await pool.acquire();
    conn._release = () => pool.release(conn);
    return conn;
  }

  /**
   * release connection to pool
   *
   * @param conn
   * @override
   */
  public async release(conn: any) {
    if (conn._release && typeof conn._release === "function") {
      await conn._release();
    }
  }

  private async _getTypeOrmOption(tenant?: string): Promise<ConnectionOptions> {
    const credentials = await this.getTenantCredential(tenant);
    return Object.assign(
      {},
      {
        name: `cds-deploy-connection-${tenant ?? "main"}`,
        type: "mysql",
        username: credentials.user,
        database: credentials.user,
        port: 3306,
        entities: []
      },
      credentials
    );
  }

  public async disconnect() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [tenant, pool] of this._pools.entries()) {
      await (<Pool<Connection>>pool).clear();
    }
  }

  /*
   * deploy
   */
  async deploy(model: any, options: any = {}) {
    const entities = csnToEntity(model);
    const migrateOptions = await this._getTypeOrmOption(options?.tenant ?? TENANT_DEFAULT);
    await migrate({ ...migrateOptions, entities });
    return true;
  }
}
