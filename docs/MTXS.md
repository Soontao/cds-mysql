# MTXS support

> support multitenancy/extensibility and feature toggles with `@sap/cds-mtxs` module

## Enablement

> you need manually enable each service, because there are some conflicts in `mtxs` internal shortcuts

```json
{
  "cds": {
    "requires": {
      "cds.xt.SaasProvisioningService": true,
      "cds.xt.ModelProviderService": true,
      "cds.xt.ExtensibilityService": true,
      "cds.xt.DeploymentService": true,
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

## Tenant Users

> CDS Built-In Mocked Users

```json
{
  "alice": {
    "tenant": "t1",
    "roles": ["cds.Subscriber", "admin"]
  },
  "bob": {
    "tenant": "t1",
    "roles": ["cds.ExtensionDeveloper", "cds.UIFlexDeveloper"]
  },
  "carol": {
    "tenant": "t1",
    "roles": [
      "cds.Subscriber",
      "admin",
      "cds.ExtensionDeveloper",
      "cds.UIFlexDeveloper"
    ]
  },
  "dave": {
    "tenant": "t1",
    "roles": ["cds.Subscriber", "admin"],
    "features": []
  },
  "erin": {
    "tenant": "t2",
    "roles": [
      "cds.Subscriber",
      "admin",
      "cds.ExtensionDeveloper",
      "cds.UIFlexDeveloper"
    ]
  },
  "fred": {
    "tenant": "t2",
    "features": ["isbn"]
  },
  "me": {
    "tenant": "t1",
    "features": ["*"]
  },
  "yves": {
    "roles": ["internal-user"]
  },
  "*": true
}
```

## Known Issues

- cause `cds-mysql` will automatically migrate tenants for non-existed tenant, so the `cds.xt.Tenants` maybe not have all tenants
- extensibility still not verified
