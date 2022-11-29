import type { Connection } from "mysql2/promise";
import type { INSERT } from "cds-internal-tool/lib/types/ql";
import type { Options as PoolOptions } from "generic-pool";

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

export type ReleasableConnection = Connection & {
  /**
   * release connection to pool
   */
  _release: () => void;
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
    };
    /**
     * tenant database name prefix
     */
    prefix?: string;
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
      concurrency?: number
    }
    exist?: {
      update?: boolean;
    }
  };
}
