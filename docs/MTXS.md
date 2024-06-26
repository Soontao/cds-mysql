# MTXS support

> support multitenancy/extensibility and feature toggles with `@sap/cds-mtxs` module

- [MTXS support](#mtxs-support)
  - [Enablement](#enablement)
  - [Database User](#database-user)
  - [Tenant Users](#tenant-users)
  - [Extensibility](#extensibility)
    - [Commands](#commands)
    - [Extensibility project - package json is required](#extensibility-project---package-json-is-required)
  - [Limitation](#limitation)

## Enablement

> **MUST** manually enable each service, because there are some conflicts in `mtxs` internal shortcuts
> `cds.xt.SaasProvisioningService` MUST NOT be included into your application

```json
{
  "cds": {
    "requires": {
      "multitenancy": true,
      "extensibility": true,
      "cds.xt.ModelProviderService": true,
      "cds.xt.ExtensibilityService": true,
      "cds.xt.DeploymentService": true,
      "cds.xt.SaasProvisioningService": true,
      "kinds": {
        "cds.xt.DeploymentService": {
          "model": "cds-mysql/mtxs/DeploymentService.cds"
        },
        "mysql": {
          "impl": "cds-mysql"
        }
      }
    }
  }
}
```

- the database connection user should have the permission to create/delete new database(schema)
- unsubscribe a tenant will really `DROP` the tenant database(schema)

## Database User

for multitenancy, `cds-mysql` will try to create `database/schema` for each tenant, so the database user need to have the permission to `CREATE DATABASE` and `DROP DATABASE`

Please ref [here](../SCRIPTS.md#user-creation) to get an example to create user.

## Tenant Users

> [CDS Built-In Mocked Users](https://cap.cloud.sap/docs/node.js/authentication#mock-users)

## Extensibility

### Commands

```bash
cds login localhost:4004 --user theo-on-tenant-2:pass
cds pull # pull latest base model
cds build # build local extensions to TAR
cds push # push & activate extension
```

### Extensibility project - package json is required

> the `name` is very important to determine the extension is existed one or not

```json
{
  "name": "ext-1",
  "cds": {
    "build": {
      "tasks": [
        {
          "for": "mtx-extension"
        }
      ]
    }
  }
}
```

## Limitation

- `extensibility` does not work with `transparent migration`
