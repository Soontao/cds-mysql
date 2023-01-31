import type { Connection } from "mysql2/promise";
import type { INSERT } from "cds-internal-tool/lib/types/ql";
import type { Options as PoolOptions, Pool } from "generic-pool";
import type { EntitySchema } from "typeorm";

export declare class UPSERT<T = any> extends INSERT<T> {

}

/**
 * raw mysql2 library required credential
 */
export interface MySQLCredential {
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

export type ConnectionWithPool = Connection & {
  _pool: Pool<Connection>;
}

export interface MysqlDatabaseOptions {
  /**
   * database credentials
   */
  credentials: MySQLCredential;
  /**
   * tenant configuration
   */
  tenant?: {
    deploy?: {
      /**
       * auto migrate database schema when connect to it (create pool),
       * 
       * default `true`
       */
      auto?: boolean;
      /**
       * eager deploy tenant id list 
       * 
       * schema sync of these tenants will be performed when server startup
       * 
       * default value is ['default']
       */
      eager?: Array<string> | string;

      /**
       * eager deploy will also include tenants from cds.env.requires.auth.users
       * 
       * default value is `false`
       */
      withMockUserTenants?: boolean;
    };
    /**
     * tenant database name prefix
     */
    prefix?: string;
  };
  /**
   * mysql connection configurations
   */
  connection?: {
    /**
     * `max_allowed_packet` size of mysql database, when create the pool of tenant, `cds-mysql` will try to set the global `max_allowed_packet` variable
     * 
     * The value should be a multiple of 1024; non-multiples are rounded down to the nearest multiple.
     */
    maxallowedpacket?: number | boolean;
  };
  /**
   * connection pool options for each tenant
   */
  pool?: PoolOptions;
  csv?: {
    /**
     * migrate CSV on deployment
     * 
     * default value `true`
     */
    migrate?: boolean;

    identity?: {
      /**
       * `cds-mysql` will parallel to query record by keys,
       *  to check the record is existed or not
       */
      concurrency?: number
    }
    exist?: {
      /**
       * when `cds-mysql` found the record is existed in database
       * 
       * update or skip that. 
       * 
       * default value `false`
       */
      update?: boolean;
    };
    /**
     * enhanced csv processing for `preDelivery` aspect
     * 
     * default value is `false`
     */
    enhancedProcessing: boolean;
  };
}

export type CQNKind = "SELECT" | "UPDATE" | "DELETE" | "INSERT" | "CREATE" | "DROP";



export interface Query {
  query: string
}

export interface Migration {
  version: number;
  statements: Array<Query>;
}

export interface MigrationHistory {
  version: number;
  entities: Array<EntitySchema>;
  hash: string;
  migrations: Array<Migration>;
}