# cds mysql

[![npm version](https://img.shields.io/npm/v/cds-mysql?label=cds-mysql)](https://www.npmjs.com/package/cds-mysql)
![node-test](https://github.com/Soontao/cds-mysql/workflows/node-test/badge.svg)
[![tidb-test](https://github.com/Soontao/cds-mysql/actions/workflows/tidb.yml/badge.svg)](https://github.com/Soontao/cds-mysql/actions/workflows/tidb.yml)
[![database-test](https://github.com/Soontao/cds-mysql/actions/workflows/database.yml/badge.svg)](https://github.com/Soontao/cds-mysql/actions/workflows/database.yml)

[![codecov](https://codecov.io/gh/Soontao/cds-mysql/branch/main/graph/badge.svg?token=xTt6AaHeuu)](https://codecov.io/gh/Soontao/cds-mysql)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-mysql&metric=security_rating)](https://sonarcloud.io/dashboard?id=Soontao_cds-mysql)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-mysql&metric=sqale_index)](https://sonarcloud.io/dashboard?id=Soontao_cds-mysql)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-mysql&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=Soontao_cds-mysql)

> `MySQL`/`MariaDB`/`TiDB` adapter for [CAP Framework](https://cap.cloud.sap/docs/about/), this module is heavily inspired by the [cds-pg](https://github.com/sapmentors/cds-pg) module.

## Setup

create `.env` file and put that into the CAP project, then fill the database credential 

please find more database user setup information at [here](./docs/ADVANCED_USAGE.md#config-database-credential-by-environments-variables). 

```environment
CDS_REQUIRES_DB_CREDENTIALS_HOST=127.0.0.1
CDS_REQUIRES_DB_CREDENTIALS_PORT=3306
CDS_REQUIRES_DB_CREDENTIALS_DATABASE=cds_admin
CDS_REQUIRES_DB_CREDENTIALS_USER=cds_admin
CDS_REQUIRES_DB_CREDENTIALS_PASSWORD=cds_admin
```

then setup the `mysql` database driver for cds -> edit the `package.json` > `cds` node

```json
{
  "requires": {
    "db": {
      "kind": "mysql"
    },
    "kinds": {
      "mysql": {
        "impl": "cds-mysql"
      }
    }
  }
}
```

now, start the cds server (`cds run`), everything is ready! 

depends on the configuration, the database schema will be migrated at server startup, or first time the cds server received CRUD request from client.

---

in addition, please check [cap-mysql-sflight](https://github.com/Soontao/cap-mysql-sflight) to get the `mysql` version of official `cap-sflight` example, and it works well.

## [Advanced Documentation](./docs/ADVANCED_USAGE.md)

## Feature and RoadMap

- [x] fundamental `INSERT`/`UPDATE`/`DELETE`/`SELECT` query support
  - [x] support [`UPSERT`](./docs/ADVANCED_USAGE.md#upsert) by `INSERT ... ON DUPLICATE KEY UPDATE` statement
- [x] deep insert for association/composition
  - [x] deep create/update/query/delete test case
- [x] `fiori` draft support
  - [x] `draftPrepare`/`draftEdit`/`draftActivate` test case
- [x] `temporal` aspect, but not support [time-travel query](https://cap.cloud.sap/docs/guides/temporal-data#time-travel-queries)
- [x] `incrementID` auto incremental key aspect
- [x] `preDelivery` CSV aspect
  - [x] migrate CSV on-demand (with option)
  - [x] CSV migration with hash check
  - [ ] database handlers for `SELECT` and `DELETE`
- [x] full text search
- [x] schema migration optimization (ignore drop in some case)
  - [ ] ignore column length reduce and with warning
  - [ ] model version, only incremental migration
- [x] [`@Core.Media` attachment support](https://cap.cloud.sap/docs/guides/media-data)
- [x] [localized data](https://cap.cloud.sap/docs/guides/localized-data)
- [x] multi tenancy
  - [x] deploy model on-fly
  - [x] create database on-demand
    - [ ] user permission check
  - [x] _experimental_ [`@sap/cds-mtxs` support](https://pages.github.tools.sap/cap/docs/guides/multitenancy/mtxs) -> [document](./docs/MTXS.md) - behavior maybe changed later.
    - [ ] extensibility
- [x] `$expand` navigation
- [x] `$filter` with canonical functions (`concat`/`contains`/`substring`)
- [x] test with `mariadb 10.4`, `mysql 5.6/5.7/8`, `TiDB`
- [x] initial data provision by `CSV`
  - [x] better migration type/column/name adaption
- [x] mysql index
  - [ ] better error for not supported elements
- [x] automatically schema sync (when connection pool provision)
- [x] SELECT [`FOR UPDATE`](https://cap.cloud.sap/docs/node.js/cds-ql?q=forUpdate#select-forUpdate)/`LOCK IN SHARE MODE`
  - [ ] `NOWAIT` support
  - [ ] `SKIP LOCKED` support
- [x] better E2E document/sample - [cap-mysql-sflight](https://github.com/Soontao/cap-mysql-sflight)

## Limitation and Known Issues

- the maximum length of a table name is 64 characters - so the `length of entity name with namespace` cannot exceed 64 chars
- mysql `5.6` does not support key length exceed `767` bytes
- mysql does not support [entities with parameters](https://cap.cloud.sap/docs/cds/cdl?q=parameter#exposed-entities)
- TiDB does not support `DROP PRIMARY KEY` for [clustered index](https://docs.pingcap.com/tidb/dev/clustered-indexes), so users cannot `modify the primary keys` when `clustered index is enabled`
- `date` column not support default value `$now`
- upload attachment maybe will meet `max_allowed_packet` issue, [it can be configured on server side](https://dev.mysql.com/doc/refman/8.0/en/packet-too-large.html).
- The internal representation of a MySQL table has a maximum row size limit of `65,535` bytes.
- The default `varchar(5000)` will be converted to unlimited `text` type, so, **DO NOT** remember add length for the unlimited `String` fields.
- The `Boolean` type is represented as `TINYINT(1)` in mysql server, as a result, `boolean default true/false` will be converted to `TINYINT DEFAULT 1/0`.
- The `incrementID` aspect could not works well with `managed composition` because mysql do not support `composite primary key` contains an `auto_increment` column

## [CHANGELOG](./CHANGELOG.md)

## [LICENSE](./LICENSE)
