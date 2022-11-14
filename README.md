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

for local development, just simply create the `default-env.json` file into the root directory of your CAP project, and put the `mysql` credential into that. (remember **don't** commit this file into your git repository)

please **NOTICE** that, the `{ tags: ['mysql'] }` is the key which used for service credential lookup in CAP framework.

for the supported options in `credentials` node, just ref the [mysql official connection options document](https://www.npmjs.com/package/mysql#connection-options)

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

edit your `package.json` > `cds` node

```json
{
  "requires": {
    "db": {
      "kind": "mysql"
    },
    "mysql": {
      "impl": "cds-mysql"
    }
  }
}
```

now, the cds server (`cds run`) should could be connected to the mysql server correctly. The database schema will be automatically migrated when **the firstly time received CRUD request**.

## [Advanced Usage](./docs/ADVANCED_USAGE.md)

## Compatibility Table

| @sap/cds version | cds-mysql version |
| ---------------- | ----------------- |
| 5.8.x            | 5.9.x             |
| 5.9.x            | 5.9.x             |
| 6.0.x            | 6.0.x             |
| 6.1.x            | 6.1.x             |
| 6.2.x            | 6.2.x             |
| 6.3.x            | 6.3.x             |

## Features

- [x] basic `INSERT`/`UPDATE`/`DELETE`/`SELECT` query support
- [x] deep insert for association/composition
  - [x] deep create/update/query/delete test case
- [x] `temporal` aspect, but not support [time-travel query](https://cap.cloud.sap/docs/guides/temporal-data#time-travel-queries)
- [x] full text search
- [x] deploy & schema migration
- [x] migration optimization (ignore drop in some case)
  - [ ] ignore column length reduce and with warning
  - [ ] model version, only incremental migration
  - [ ] using `LinkedModel` element information for database migration
- [x] [`@Core.Media` attachment support](https://cap.cloud.sap/docs/guides/media-data)
- [x] [localized data](https://cap.cloud.sap/docs/guides/localized-data)
- [ ] multi tenancy
  - [x] deploy model on-fly
  - [x] create database on-demand
    - [ ] permission check
    - [ ] test
    - [x] migrate CSV on-demand (with option)
      - [x] CSV aspect `preDelivery`
      - [x] CSV migration with hash check
      - [ ] enhance `preDelivery` check by standalone table
      - [ ] database handlers for `SELECT` and `DELETE`
  - [ ] dynamic database credential provider
  - [ ] admin database concept
    - [ ] `@admin` tenant entity & services
  - [ ] tenant credential refresh
- [x] `$expand` navigation
- [x] `$filter` with canonical functions (`concat`/`contains`/`substring`)
- [x] test with `mariadb 10.4`, `mysql 5.6/5.7/8`, `TiDB`
- [x] initial data provision by `CSV`
  - [x] better migration type/column/name adaption
- [x] auto incremental key aspect
- [x] mysql index
  - [ ] better error for not supported elements
- [x] automatically schema sync (when connection pool provision)
- [x] SELECT [`FOR UPDATE`](https://cap.cloud.sap/docs/node.js/cds-ql?q=forUpdate#select-forUpdate)/`LOCK IN SHARE MODE`
- [ ] `@sap/cds-mtxs` support
- [ ] better E2E document/sample

## Limitation

- mysql `5.6` not support key length exceed `767` bytes
- mysql does not support [entities with parameters](https://cap.cloud.sap/docs/cds/cdl?q=parameter#exposed-entities)
- `date` column not support default `$now`
- upload attachment maybe will meet `max_allowed_packet` issue, [it can be configured on server side](https://dev.mysql.com/doc/refman/8.0/en/packet-too-large.html). (default is `1MB`)
- The internal representation of a MySQL table has a maximum row size limit of `65,535` bytes.
- The default `varchar(5000)` will be converted to unlimited `text` type, so, **DO NOT** remember add length for the unlimited `String` fields.
- The `Boolean` type is represented as `TINYINT(1)` in mysql server, as a result, `boolean default true/false` will be converted to `TINYINT DEFAULT 1/0`.
- The `incrementID` aspect could not works well with `managed composition` because mysql do not support `composite primary key` contains an `auto_increment` column

## [CHANGELOG](./CHANGELOG.md)

## [LICENSE](./LICENSE)
