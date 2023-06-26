import { createPool } from "generic-pool";
import { getMySQLCredential } from "./admin-tool";
import { DEFAULT_MAX_ALLOWED_PACKED_MB, DEFAULT_POOL_OPTIONS, MYSQL_COLLATE } from "./constants";
import { lazy } from "./utils";
import { ConnectionOptions, createConnection } from "mysql2/promise";

/**
 * @private
 * @internal
 * @ignore
 * @param tenantCredential 
 * @param tenant 
 */
async function _setup_packet_size(tenantCredential: ConnectionOptions, tenant: string) {
  const cds = lazy.cds;
  const maxAllowedPacket = cds.env.get("requires.db.connection.maxallowedpacket");

  if (maxAllowedPacket !== undefined && maxAllowedPacket !== false) {
    const realPacketSize = typeof maxAllowedPacket === "number"
      ? maxAllowedPacket
      : (DEFAULT_MAX_ALLOWED_PACKED_MB * 1024 * 1024);

    const conn = await createConnection(tenantCredential);

    lazy.logger.info("setup global max_allowed_packet", realPacketSize, "for tenant", tenant);

    try {
      await conn.query(`SET GLOBAL max_allowed_packet=${realPacketSize}`);
    }
    catch (error) {
      lazy.logger.warn("set max_allowed_packet failed", error);
    }
    finally {
      await conn.end();
    }

  }
}

/**
 * create pool for tenant
 * 
 * @param tenant 
 * @returns 
 */
export async function create_pool(tenant?: string) {
  const credential = getMySQLCredential(tenant);

  const poolOptions = {
    ...DEFAULT_POOL_OPTIONS,
    ...lazy.db_options
  };

  const tenantCredential = {
    ...credential,
    dateStrings: true,
    charset: MYSQL_COLLATE
  };

  lazy.logger.info(
    "creating connection pool for tenant",
    tenant,
    "with option",
    poolOptions
  );

  await _setup_packet_size(tenantCredential, tenant);

  const newPool = createPool(
    {
      create: () => createConnection(tenantCredential),
      validate: (conn) => conn
        .query("SELECT 1")
        .then(() => true)
        .catch((err) => {
          lazy.logger.error("validate connection failed:", err);
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