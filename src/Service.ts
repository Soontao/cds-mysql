/* eslint-disable max-len */
import { uniq } from "@newdash/newdash/uniq";
import {
  CDS,
  CSN, cwdRequire,
  cwdRequireCDS, EventContext,
  EventNames, LinkedModel, Logger, Service
} from "cds-internal-tool";
import "colors";
import { createPool, Options as PoolOptions, Pool } from "generic-pool";
import { Connection, createConnection } from "mysql2/promise";
import { ConnectionOptions } from "mysql2/typings/mysql";
import * as tool from "./admin-tool";
import {
  CONNECTION_IDLE_CHECK_INTERVAL,
  DEFAULT_CONNECTION_ACQUIRE_TIMEOUT,
  DEFAULT_CONNECTION_IDLE_TIMEOUT,
  DEFAULT_MAX_ALLOWED_PACKED_MB,
  DEFAULT_TENANT_CONNECTION_POOL_SIZE,
  MAX_QUEUE_SIZE,
  MYSQL_COLLATE,
  TENANT_DEFAULT
} from "./constants";
import { _impl_deployment_service } from "./deploy-service";
import execute from "./execute";
import { _disable_deletion_for_pre_delivery } from "./handlers";
import { ConnectionWithPool, MysqlDatabaseOptions } from "./types";
import { checkCdsVersion } from "./utils";

const DEFAULT_POOL_OPTIONS: Partial<PoolOptions> = {
  min: 1,
  acquireTimeoutMillis: DEFAULT_CONNECTION_ACQUIRE_TIMEOUT,
  max: DEFAULT_TENANT_CONNECTION_POOL_SIZE,
  maxWaitingClients: MAX_QUEUE_SIZE,
  evictionRunIntervalMillis: CONNECTION_IDLE_CHECK_INTERVAL,
  idleTimeoutMillis: DEFAULT_CONNECTION_IDLE_TIMEOUT,
  testOnBorrow: true,
};

const BaseService: typeof Service<EventNames, MysqlDatabaseOptions> = cwdRequire("@sap/cds/libx/_runtime/sqlite/Service");

/**
 * MySQL Database Adapter for SAP CAP Framework
 * 
 */
export class MySQLDatabaseService extends BaseService {

  constructor(...args: any[]) {
    super(...args);

    checkCdsVersion();

    const cds = this._cds = cwdRequireCDS();

    // REVISIT: official db api
    this._execute = execute;

    // REVISIT: official db api
    this._insert = this._queries.insert(execute.insert);
    this._read = this._queries.read(execute.select, execute.stream);
    this._update = this._queries.update(execute.update, execute.select);
    this._delete = this._queries.delete(execute.delete, execute.update);

    this._run = this._queries.run(
      this._insert,
      this._read,
      this._update,
      this._delete,
      execute.cqn,
      execute.sql
    );

    this._logger = cds.log("db|mysql");

    if (this.options.credentials === undefined) {
      throw cds.error("mysql credentials not found");
    }

  }

  private _cds: CDS;


  declare public options: MysqlDatabaseOptions;

  declare public model: LinkedModel;

  private _queries: any;

  private _execute: any;

  private _read: any;

  private _insert: any;

  private _update: any;

  private _delete: any;

  private _run: any;

  private _logger: Logger;

  private _pools: Map<string, Pool<Connection> | Promise<Pool<Connection>>> = new Map();

  /**
   * initialize function
   */
  async init() {
    this._registerCSVHandlers();
    await super.init();
    this._implDeploymentService();
    this._registerEagerDeploy();
  }

  private _registerCSVHandlers() {
    if (this.options?.csv?.enhancedProcessing === true) {
      this._logger.info("enhanced csv processing enabled");
      this.on("DELETE", _disable_deletion_for_pre_delivery);
    }
  }

  private _registerEagerDeploy() {
    const tenant = this.options?.tenant;

    if (tenant?.deploy?.auto !== false) {

      const cds = this._cds;
      let tenantsToBeDeployed = tenant?.deploy?.eager ?? [TENANT_DEFAULT];

      if (typeof tenantsToBeDeployed === "string") { tenantsToBeDeployed = [tenantsToBeDeployed]; }

      if (tenant?.deploy?.withMockUserTenants === true) {
        // auth users tenants (when use basic/dummy auth)
        const tenantsFromUsers = uniq(
          Object
            .values(cds.env.get("requires.auth.users") ?? {})
            .filter((u: any) => typeof u?.tenant === "string").map((u: any) => u.tenant)
        );

        if (tenantsFromUsers.length > 0) {
          this._logger.debug("tenants from users", tenantsFromUsers);
          tenantsToBeDeployed.push(...tenantsFromUsers);
        }
      }

      tenantsToBeDeployed = uniq(tenantsToBeDeployed) as Array<string>;

      if (tenantsToBeDeployed.length === 0) {
        return;
      }

      cds.once("served", async () => {
        this._logger.info("deploy tenants", tenantsToBeDeployed);
        return Promise.all((tenantsToBeDeployed as Array<string>).map(tenant => this._initializeTenant(tenant)));
      });

    }
  }

  private async _initializeTenant(tenant: string = TENANT_DEFAULT) {
    const { "cds.xt.DeploymentService": ds } = this._cds.services;
    if (ds === undefined) {
      await tool.syncTenant(tenant);
      return;
    }
    await ds.tx((tx) => tx.subscribe(
      tenant,
      { subscribedTenantId: tenant, eventType: "CREATE" }
    ));
    return;
  }

  /**
   * get connection pool for tenant
   *
   * connection pool is independent for tenant
   *
   * @param tenant
   */
  private async _getPool(tenant = TENANT_DEFAULT): Promise<Pool<Connection>> {
    if (!(await tool.hasTenantDatabase(tenant))) {
      this._logger.error(
        "tenant", tenant,
        "is not found in database, did you forgot to subscribe that?"
      );
      throw cwdRequireCDS().error(`tenant '${tenant}' database is not found, maybe forgot to setup?`);
    }
    if (!this._pools.has(tenant)) {
      this._pools.set(
        tenant,
        this._createPoolFor(tenant).then(
          pool => { this._pools.set(tenant, pool); return pool; }
        )
      );
    }

    return await this._pools.get(tenant);

  }

  private async _createPoolFor(tenant?: string) {
    const credential = tool.getMySQLCredential(tenant);

    const poolOptions = {
      ...DEFAULT_POOL_OPTIONS,
      ...this.options?.pool
    };

    const tenantCredential = {
      ...credential,
      dateStrings: true,
      charset: MYSQL_COLLATE
    };

    this._logger.info(
      "creating connection pool for tenant",
      tenant,
      "with option",
      poolOptions
    );

    await this._setupPacketSize(tenantCredential, tenant);

    const newPool = createPool(
      {
        create: () => createConnection(tenantCredential),
        validate: (conn) => conn
          .query("SELECT 1")
          .then(() => true)
          .catch((err) => {
            this._logger.error("validate connection failed:", err);
            return false;
          }),
        destroy: async (conn) => {
          await conn.end();
        }
      },
      poolOptions,
    );
    return newPool;
  }

  /**
   * @private
   * @internal
   * @ignore
   * @param tenantCredential 
   * @param tenant 
   */
  private async _setupPacketSize(tenantCredential: ConnectionOptions, tenant: string) {
    const cds = cwdRequireCDS();
    const maxAllowedPacket = cds.env.get("requires.db.connection.maxallowedpacket");

    if (maxAllowedPacket !== undefined && maxAllowedPacket !== false) {
      const realPacketSize = typeof maxAllowedPacket === "number"
        ? maxAllowedPacket
        : (DEFAULT_MAX_ALLOWED_PACKED_MB * 1024 * 1024);

      const conn = await createConnection(tenantCredential);

      this._logger.info("setup global max_allowed_packet", realPacketSize, "for tenant", tenant);

      try {
        await conn.query(`SET GLOBAL max_allowed_packet=${realPacketSize}`);
      }
      catch (error) {
        this._logger.warn("set max_allowed_packet failed", error);
      }
      finally {
        await conn.end();
      }

    }
  }

  /**
   * acquire connection from pool
   *
   * @override
   * @param tenant_id tenant id
   */
  public async acquire(tenant_id: string): Promise<ConnectionWithPool>;

  public async acquire(context: EventContext): Promise<ConnectionWithPool>;

  public async acquire(arg: any) {
    const tenant = (typeof arg === "string" ? arg : arg?.user?.tenant) ?? TENANT_DEFAULT;
    const pool = await this._getPool(tenant);
    // REVISIT: priority maybe for http request
    // REVISIT: retry connection
    const conn = await pool.acquire();

    return Object.assign(conn, { _pool: pool });
  }

  /**
   * release connection to pool
   *
   * @param conn
   * @override
   */
  public async release(conn: ConnectionWithPool) {
    if (typeof conn?._pool?.release === "function") {
      await conn._pool.release(conn);
    }
  }


  /**
   * disconnect from database, free all connections of all tenants
   * 
   * @param tenant optional tenant id, if with `*`, close all pools 
   */
  public async disconnect(tenant: "*" | string = TENANT_DEFAULT) {
    if (tenant !== "*") {
      if (this._pools.has(tenant)) {
        this._logger.info("disconnect mysql database for tenant", tenant.green);
        const pool = await this._pools.get(tenant);
        this._pools.delete(tenant);
        await pool.drain();
        await pool.clear();
      }
      return;
    }

    this._logger.info("disconnect mysql database for all tenants");
    const pools = await Promise.all(Array.from(this._pools.values()).map(async pool => await pool));
    this._pools.clear();
    await Promise.all(
      pools.map(async pool => {
        await pool.drain();
        await pool.clear();
      })
    );

  }

  /**
   * implement deployment service
   * 
   * @internal
   * @param ds 
   * @returns 
   */
  private _implDeploymentService() {
    this._cds.once("served", () => {
      const { "cds.xt.DeploymentService": ds } = this._cds.services;
      if (ds !== undefined) {
        return _impl_deployment_service(ds);
      }
    });
  }

  /**
   * deploy (migrate) schema to (tenant) database
   * 
   * @param model plain CSN object
   * @param options deployment options
   * @returns 
   */
  async deploy(model: CSN, options?: { tenant: string }) {
    await tool.deploy(model, options?.tenant);
  }

}
