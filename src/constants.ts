export const MYSQL_DATE_TIME_FORMAT = "yyyy-MM-dd hh:mm:ss";
export const MYSQL_CHARSET = "utf8mb4";
export const MYSQL_COLLATE = "utf8mb4_unicode_ci";
export const TENANT_DEFAULT = "default";

/**
 * the interval between idle connection check
 */
export const CONNECTION_IDLE_CHECK_INTERVAL = 30 * 1000;

/**
 * max queue items number to avoid over consuming for memory
 */
export const MAX_QUEUE_SIZE = 1000 * 1000;

/**
 * the default maximum connections number for each tenant
 */
export const DEFAULT_TENANT_CONNECTION_POOL_SIZE = 5;

/**
 * the default connection idle timeout, after idle, it will be disconnected after next check
 */
export const DEFAULT_CONNECTION_IDLE_TIMEOUT = 120 * 1000;