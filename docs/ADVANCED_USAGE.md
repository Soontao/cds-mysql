# Advanced Document

- [Advanced Document](#advanced-document)
  - [Concepts](#concepts)
    - [Compatibility Table](#compatibility-table)
    - [Configurations Overview](#configurations-overview)
    - [Built-In Data Type](#built-in-data-type)
    - [Automatically Schema Migration](#automatically-schema-migration)
    - [Transparent Migration](#transparent-migration)
    - [Multi Tenancy](#multi-tenancy)
    - [CSV Migration](#csv-migration)
  - [Tips and FAQ](#tips-and-faq)
    - [UPSERT](#upsert)
    - [CREATE and DROP CQN are disabled](#create-and-drop-cqn-are-disabled)
    - [Large Blob Storage](#large-blob-storage)
    - [Database Connection Pool](#database-connection-pool)
    - [Eager Tenant Deployment](#eager-tenant-deployment)
    - [Auto Incremental Key Aspect](#auto-incremental-key-aspect)
    - [PreDelivery Aspect for CSV migration](#predelivery-aspect-for-csv-migration)
    - [Column Index](#column-index)
  - [Configuration](#configuration)
    - [Configure database credential by environments variables](#configure-database-credential-by-environments-variables)
    - [Configure database credential by file](#configure-database-credential-by-file)
    - [Setup Database Credential for Cloud Foundry](#setup-database-credential-for-cloud-foundry)
  - [Database](#database)
    - [Database User](#database-user)
  - [Limitation and Restriction](#limitation-and-restriction)
    - [Database Technical Restrictions](#database-technical-restrictions)
    - [`cds-mysql` Implementation Restrictions](#cds-mysql-implementation-restrictions)

## Concepts

### Compatibility Table

must use proper version of `cds-mysql` with `@sap/cds` sdk

| @sap/cds version | @sap/cds-mtxs version | cds-mysql version |
| ---------------- | --------------------- | ----------------- |
| 5.8.x            |                       | 5.9.x             |
| 5.9.x            |                       | 5.9.x             |
| 6.0.x            |                       | 6.0.x             |
| 6.1.x            |                       | 6.1.x             |
| 6.2.x            |                       | 6.2.x             |
| 6.3.x            |                       | 6.3.x             |
| 6.4.x            |                       | 6.4.x             |
| 6.5.x            |                       | 6.5.x             |
| 6.6.x            |                       | 6.6.x             |
| 6.7.x            | 1.7.x                 | 6.7.x             |
| 6.8.x            | 1.8.x                 | 6.8.x             |
| 7.0.x            | 1.9.x                 | 7.0.x             |
| 7.1.x            | 1.10.x                | 7.1.x             |
| ^7.2.x           | ^1.11.x               | 7.2.x             |

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
       * @default true
       */
      auto?: boolean;
      /**
       * eager deploy tenant id list
       *
       * schema sync of these tenants will be performed when server startup
       *
       * @default ['default']
       */
      eager?: Array<string> | string;

      /**
       * eager deploy will also include tenants from cds.env.requires.auth.users
       *
       * @default false
       */
      withMockUserTenants?: boolean;
      /**
       * transparent migrate, require to use `cds-mysql-build` to generate migrations.sql
       *
       * @default false
       */
      transparent?: boolean;
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
  /**
   * csv configurations
   */
  csv?: {
    /**
     * migrate CSV on deployment
     *
     * @default false
     */
    migrate?: boolean;

    identity?: {
      /**
       * `cds-mysql` will parallel to query record by keys,
       *  to check the record is existed or not
       */
      concurrency?: number;
    };
    exist?: {
      /**
       * when `cds-mysql` found the record is existed in database
       *
       * update or skip that.
       *
       * @default false
       */
      update?: boolean;
    };
    /**
     * enhanced csv processing for `preDelivery` aspect
     *
     * @default false
     */
    enhancedProcessing: boolean;
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
| DateTime       | DATETIME         |
| Timestamp      | DATETIME(3)      |
| String(LENGTH) | NVARCHAR(LENGTH) |
| String         | NVARCHAR(255)    |
| Binary         | VARBINARY        |
| LargeBinary    | LONGBLOB         |
| LargeString    | LONGTEXT         |

### Automatically Schema Migration

`cds-mysql` will use the `cds compiler` to generate `DDL` SQL statements, then parse the `DDL` statements, and convert them into `typeorm`-`EntitySchema` objects, then do the migration with `typeorm` existed migration functionality.

```mermaid
graph LR
    CDS[CDS Definition] --> |compile CDS to DDL| DDL[Compiled DDL]
    DDL --> |ast parser| te[TypeORM Entity Metadata]
    te --> |use typeorm migrate schema|Schema[Database Schema]
```

It will be fully automatically, sync changed `columns`, `views`.

It will **NEVER** drop old `tables`/`columns`, it will be **SAFE** in most cases.

### Transparent Migration

> `cds-mysql` support to generate readable/trackable/auditable `migrations.sql` to perform schema migration

to enable that, please modify the cds configuration with `transparent` deployment flag

```diff
{
  "name": "transparent-migration",
  "cds": {
    "requires": {
      "db": {
        "kind": "mysql",
        "tenant": {
+          "deploy": {
+            "transparent": true
+          }
        }
      }
    }
  }
}
```

then run the `npx cds-mysql-build` command to generate migrations file

- `db/last-dev/mysql.json` - store the latest model
- `db/migrations.sql` - store the migration statements between different versions

an example of `migrations.sql`

```sql
-- generated by cds-mysql
-- database migration scripts
-- do not manually change this file

-- version: 100 hash: 89d52ab9f80a0fb38b9d52bc1caeeaf532d208e4b5671818830f4fa2032c45d1 at: 2023-02-01T12:03:22.489Z
CREATE TABLE `FioriService_Forms_drafts` (`ID` varchar(36) NOT NULL, `f1` varchar(255) NULL, `f2` varchar(255) NULL, `f3` int NULL, `f4` decimal NULL, `IsActiveEntity` tinyint NOT NULL DEFAULT 1, `HasActiveEntity` tinyint NOT NULL DEFAULT 0, `HasDraftEntity` tinyint NOT NULL DEFAULT 0, `DraftAdministrativeData_DraftUUID` varchar(36) NULL, PRIMARY KEY (`ID`, `IsActiveEntity`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'

-- <remove some statements here> ...

-- version: 101 hash: 06962d18b51963e273375acc512ea8e96b69325620662a78d57b4cf9c2bc1877 at: 2023-02-01T12:04:16.622Z
DROP VIEW `FioriService_Persons`

ALTER TABLE `FioriService_Persons_drafts` ADD `Country` varchar(40) NULL DEFAULT 'CN'

ALTER TABLE `test_resources_fiori_db_Person` ADD `Country` varchar(40) NULL DEFAULT 'CN'

CREATE VIEW `FioriService_Persons` AS SELECT
  Person_0.ID,
  Person_0.Name,
  Person_0.Age,
  Person_0.Address,
  Person_0.Country
FROM test_resources_fiori_db_Person AS Person_0;

-- version: 102 hash: c7f16bf48eb23fe3f5b52c53c53bfade82a3ce2f3a6532493b82d16cefa75e37 at: 2023-02-04T03:41:18.704Z
CREATE TABLE `cds_xt_Extensions` (`ID` varchar(36) NOT NULL, `tag` text NULL, `csn` longtext NULL, `i18n` longtext NULL, `sources` longblob NULL, `activated` text NULL, `timestamp` datetime(3) NULL, PRIMARY KEY (`ID`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'
```

NOTE: mtxs - `extensibility` **CAN NOT** work with `transparent migration`

### Multi Tenancy

> Out-of-Box multi-tenancy support

- develop the single tenant application, use the `default` as tenant id
- develop the multi-tenancy application, fill the `User.tenant` information for each `request`/`event`, and `cds-mysql` will automatically sync schema/CSV and provision connection pool for that tenant
  - data isolation in mysql database level, each tenant will own its own `database`
  - better to create a `admin` user to `cds-mysql` so that `cds-mysql` could help you to create `database`
- multi-tenancy could work without `@sap/mtxs`, but if enable the `@sap/mtxs` features, please find more details at [MTXS documentation](./MTXS.md)

### CSV Migration

`cds-mysql` has a built-in csv migrator, it will migrate data with key validation.

- if key of entity is existed, depends on the `cds.requires.db.csv.exist.update`, if the value is `true`, try to update, otherwise will skip the record
- if key of entity not existed, insert (if the records has been deleted, its also will be inserted)
- for `clob` columns (like `cds.Binary`/`cds.LargeBinary`), please fill csv with `base64` encoded value
- for `array of` columns, please fill with JSON string with correct CSV encoding, for example, use `""` two double quotes to represent `"` double quotes.

## Tips and FAQ

### UPSERT

> support `UPSERT` with mysql `INSERT ... ON DUPLICATE KEY UPDATE` feature

- ONLY could be handled by `DatabaseService`, there is no builtin handler are registered for `cds.ApplicationService`
- `UPSERT` will not return the updated object
- till now, there are some features not well-implemented by cds team, for example, not able to automatically rewrite `upsert` for `view`

```js
module.exports = class DemoService extends cds.ApplicationService {
  async _upsert(req) {
    const Product = "test.upsert.Product";
    const { data } = req;
    await cds.run(cds.ql.UPSERT.into(Product).entries(data));
    return cds.run(cds.ql.SELECT.one.from(Product).where({ ID: data.ID }));
  }
};
```

### CREATE and DROP CQN are disabled

> `CREATE` and `DROP` ql are **DISABLED** by `cds-mysql`.

it means:

```js
cds.run(CREATE.entity(def)); // with throw error 'ERR_NOT_SUPPORT_CQN_CREATE'
```

### Large Blob Storage

if you have the `blob` column, and try to upload large file/binary, maybe will encounter the `ER_NET_PACKET_TOO_LARGE` server side error, you can [configure](https://dev.mysql.com/doc/refman/8.0/en/packet-too-large.html) the `max_allowed_packet` in server side, or configure the global variable by `cds-mysql` (will be restore after mysql restart)

```json
{
  "cds": {
    "requires": {
      "db": {
        "kind": "mysql",
        "connection": {
          "maxallowedpacket": 104857600 // 100 MB
        }
      },
      "kinds": {
        "mysql": {
          "impl": "cds-mysql"
        }
      }
    }
  }
}
```

### Database Connection Pool

> `cds-mysql` setup pool for **EACH** tenant, for more options of pool, please ref [options section of generic-pool](https://www.npmjs.com/package/generic-pool)

```json
{
  "cds": {
    "requires": {
      "db": {
        "kind": "mysql",
        "pool": {
          "max": 50
        }
      },
      "kinds": {
        "mysql": {
          "impl": "cds-mysql"
        }
      }
    }
  }
}
```

### Eager Tenant Deployment

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

### PreDelivery Aspect for CSV migration

> csv migrator will automatically fill the `PreDelivery` field as `true`
> for business, if user want to delete some data, just set the `Disabled` field as `true`
> content hash will be checked before provisioned, if one file has been filled before, `cds-mysql` will skip processing it.

```groovy
using {incrementID, preDelivery} from 'cds-mysql';

entity Person : incrementID, preDelivery {
  Name : String(255);
}
```

then use the database model with filter

```groovy
  // where Disabled = false
  entity Peoples    as projection on db.Person excluding {
    PreDelivery,
    Disabled
  } where Disabled = false;
```

if enable the `enhancedProcessing` options

```diff
{
  "cds": {
    "requires": {
      "db": {
        "kind": "mysql",
        "csv": {
          "migrate": true,
          "exist": {
            "update": true
          },
+          "enhancedProcessing": true
        }
      }
    }
  }
}
```

NOTE: `cds-mysql` will reject db `DELETE` operations for `pre-delivery = true` records

```json
{
  "error": {
    "@Common.numericSeverity": 4,
    "code": "400",
    "message": "ERR_DELETE_PRE_DELIVERED_DATA"
  }
}
```

### Column Index

> `cds-mysql` allow user define entity with mysql built-in index

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

NOTE: `index` migration is not well-tested, carefully use that on your own risk.

## Configuration

### Configure database credential by environments variables

> as CAP supported, developer could also use `environments` to configure the database credential

```bash
CDS_REQUIRES_DB_CREDENTIALS_USER=cds_admin
CDS_REQUIRES_DB_CREDENTIALS_PASSWORD=cds_admin
CDS_REQUIRES_DB_CREDENTIALS_DATABASE=cds_admin
CDS_REQUIRES_DB_CREDENTIALS_HOST=127.0.0.1
CDS_REQUIRES_DB_CREDENTIALS_PORT=3306
```

### Configure database credential by file

create a `default-env.json` file into the root directory of your CAP project, it will be useful if you want to put some details information of mysql driver

for more supported options in `credentials` node, please ref the [mysql official connection options document](https://www.npmjs.com/package/mysql#connection-options)

```json
{
  "VCAP_SERVICES": {
    "user-provided": [
      {
        "label": "user-provided",
        "name": "remote-mysql-service",
        "tags": ["mysql"],
        "credentials": {
          "host": "mysql.host.name.com",
          "user": "user",
          "password": "cdsPas$w0rd",
          "database": "test",
          "port": 3306
        }
      }
    ]
  }
}
```

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

## Database

### Database User

for the database user which configured in credential, at least, it should have the permission to perform SQL and DML.

if the `multi-tenancy` or `mtxs` is enabled, the user need the permission to `CREATE/DROP DATABASE` and other DDL permission.

## Limitation and Restriction

### Database Technical Restrictions

> hard restrictions from database

- the maximum length of a table name is 64 characters - so the `length of entity name with namespace` cannot exceed 64 chars
- The internal representation of a MySQL table has a maximum row size limit of `65,535` bytes.
- upload attachment maybe will meet `max_allowed_packet` issue, [it can be configured on server side](https://dev.mysql.com/doc/refman/8.0/en/packet-too-large.html).
- **MySQL** does not support [entities with parameters](https://cap.cloud.sap/docs/cds/cdl?q=parameter#exposed-entities)

### `cds-mysql` Implementation Restrictions

> some restrictions from `cds-mysql` implementation

- `date` column not support default value `$now`
- The `Boolean` type is represented as `TINYINT(1)` in mysql server, as a result, `boolean default true/false` will be converted to `TINYINT DEFAULT 1/0`.
- The `incrementID` aspect of `mysql`, does not work with `managed composition`, because `mysql` do not support `composite primary key` contains an `auto_increment` column
