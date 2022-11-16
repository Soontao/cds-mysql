import { TENANT_DEFAULT } from "./constants";
import { MySQLCredential } from "./types";


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
