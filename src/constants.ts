export const ANNOTATION_CDS_TYPEORM_CONFIG = "@cds.typeorm.config";

export const MYSQL_DATE_TIME_FORMAT = "yyyy-MM-dd HH:mm:ss.u";
export const MYSQL_DATE_TIME_FORMAT_WO_FRACTIONS = "yyyy-MM-dd HH:mm:ss";
export const MYSQL_CHARSET = "utf8mb4";
export const MYSQL_COLLATE = "utf8mb4_unicode_ci";
export const TENANT_DEFAULT = "default";

/**
 * the interval between idle connection check
 */
export const CONNECTION_IDLE_CHECK_INTERVAL = 5 * 1000;

/**
 * the default maximum connections number for each tenant
 */
export const DEFAULT_TENANT_CONNECTION_POOL_SIZE = 20;

/**
 * connection acquire timeout
 */
export const DEFAULT_CONNECTION_ACQUIRE_TIMEOUT = 10 * 1000;

/**
 * max queue items number to avoid over consuming for memory
 */
export const MAX_QUEUE_SIZE = 1000;

/**
 * the default connection idle timeout, after idle, it will be disconnected after next check
 */
export const DEFAULT_CONNECTION_IDLE_TIMEOUT = 120 * 1000;

/**
 * default value to check csv record is existed or not
 */
export const DEFAULT_CSV_IDENTITY_CONCURRENCY = 10;

/**
 * default `max_allowed_packet` value for `cds-mysql`
 * 
 * @see https://dev.mysql.com/doc/refman/8.0/en/packet-too-large.html
 */
export const DEFAULT_MAX_ALLOWED_PACKED_MB = 512;

export const MIGRATION_VERSION_PREFIX = "-- version: ";