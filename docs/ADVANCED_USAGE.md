## Advanced Usage

### UPSERT

> use `upsert` by a internal indicator

```js
const { UPSERT } = require("cds-mysql");

module.exports = class DemoService extends cds.ApplicationService {

  async _upsert(req) {
    const { Products } = this.entities;
    const { data } = req;
    return this.run(UPSERT().into(Products).entries(data));
  }

};
```

### Schema Migration

`cds-mysql` will use the `cds compiler` to generate `DDL` SQL statements, then parse the `DDL` statements, and convert them into `typeorm`-`EntitySchema` objects, then do the migration with `typeorm` existed migration functionality.

```mermaid
graph LR
    CDS[CDS Definition] --> |compile CDS to DDL| DDL[Compiled DDL]
    DDL --> |ast parser| te[TypeORM Entity Metadata]
    te --> |use typeorm migrate schema|Schema[Database Schema]
```

It will be fully automatically, sync changed `columns`, `views`.

It will **NEVER** drop old `tables`/`columns`, it will be **SAFE** in most cases.

> `cds-mysql` will automatically migrate schema and pre-defined CSV data into database when connecting to database (generally it means server received the first request which need database operation).

> just specify the `requires.db.tenant.deploy.eager` to sync schema (of target tenants) at startup

```json
{
  "cds": {
    "requires": {
      "db": {
        "tenant": {
          "deploy": {
            "eager": ["default", "<a-tenant-id here>"]
          }
        }
      }
    }
  }
}
```

### Multi Tenancy

> Out-of-Box multi-tenancy support

- develop the single tenant application, use the `default` as tenant id
- develop the multi-tenancy application, fill the `User.tenant` information for each `request`/`event`, and `cds-mysql` will automatically sync schema/CSV and provision connection pool for that tenant
  - data isolation in mysql database level, each tenant will own its own `database`
  - better to create a `admin` user to `cds-mysql` so that `cds-mysql` could help you to create `database`

### Auto Incremental Key Aspect

> define entity with `incrementalID` aspect to support the `AUTO_INCREMENT` syntax in `mysql` db

> **NOT COMPATIBLE** with deep composition/association operations, its better to use the `@sap/cds/common - cuid` aspect for deep operations

```groovy
using {incrementID} from 'cds-mysql';

// the entity `Animal` will have an auto-filled 'ID' field
// ONLY support single record insert
entity Animal : incrementID {
  Name : String(255);
}
```

### CSV Migration

`cds-mysql` has a built-in csv migrator, it will migrate data with key validation.

- if key of entity is existed, skip
- if key of entity not existed, insert (if the records has been deleted, its also will be inserted)

> csv migrator will automatically fill the `PreDelivery` field as `true`
> for business, if user want to delete some data, just set the `Disabled` field as `true`
> content hash will be checked before provisioned, if one file has been filled before, `cds-mysql` will skip processing it.

```groovy
using {incrementID, preDelivery} from 'cds-mysql';

entity Person : incrementID, preDelivery {
  Name : String(255);
}
```

### Add Column Index

> define entity with mysql built-in index

```groovy
@cds.typeorm.config : {indices : [{
  name    : 'ProductName', // key name
  columns : ['Name'] // index fields
}]}
entity Product : cuid {
  Name  : TranslatedText;
  Price : Decimal(10, 2);
}
```

### Configurations Overview

> you can specify the configuration of `cds-mysql` at the `cds.requires.db` node

```json
{
  "cds": {
    "requires": {
      "db": {
        "kind": "mysql",
        "csv": { "migrate": false },
        "tenant": {
          "deploy": {
            "eager": ["default"]
          }
        }
      },
      "mysql": { "impl": "cds-mysql" }
    }
  }
}
```

> interface

```ts
interface MysqlDatabaseOptions {
  tenant?: {
    deploy?: {
      /**
       * auto migrate database schema when connect to it
       * default value is `true`
       * specify `false` to disable the migration on startup/connection pool setup
       */
      auto?: boolean;
      /**
       * eager deploy tenant id list
       * the migration of those tenants will be performed when server startup
       */
      eager?: Array<string> | string;
    };
    /**
     * tenant database name prefix
     */
    prefix?: string;
  };
  /**
   * connection pool options
   */
  pool?: PoolOptions;
  csv?: {
    /**
     * migrate CSV on deployment
     */
    migrate?: boolean;
  };
}
```

### Built-In Data Type

| CDS Type       | MySQL Type       |
| -------------- | ---------------- |
| UUID           | NVARCHAR(36)     |
| Boolean        | BOOLEAN          |
| UInt8          | TINYINT          |
| Int16          | SMALLINT         |
| Int32          | INTEGER          |
| Integer        | INTEGER          |
| Int64          | BIGINT           |
| Integer64      | BIGINT           |
| Decimal        | DECIMAL          |
| Double         | DOUBLE           |
| Date           | DATE             |
| Time           | TIME             |
| DateTime       | TIMESTAMP        |
| Timestamp      | TIMESTAMP        |
| String(LENGTH) | NVARCHAR(LENGTH) |
| String         | TEXT             |
| Binary         | VARBINARY        |
| LargeBinary    | LONGBLOB         |
| LargeString    | LONGTEXT         |

### Setup Database Credential for Cloud Foundry

> if you want to run cds-mysql on cloud foundry for production

create mysql service by [`cf cups`](http://cli.cloudfoundry.org/en-US/cf/create-user-provided-service.html) with following format

```bash
cf cups remote-mysql-service -t 'mysql' -p '{"host":"public.mysql.instance.com","user":"cds-user","password":"CdsUser123$","database":"cds-user","port":3306,"ssl":{"ca":"-----BEGIN CERTIFICATE-----\n ......\n-----END CERTIFICATE-----\n"}}'
```

you can convert PEM cert to json format with [this document](https://docs.vmware.com/en/Unified-Access-Gateway/2.9/com.vmware.access-point-29-deploy-config/GUID-870AF51F-AB37-4D6C-B9F5-4BFEB18F11E9.html), just run command

```bash
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' cert-name.pem
```

