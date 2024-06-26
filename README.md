# cds mysql

[![npm version](https://img.shields.io/npm/v/cds-mysql?label=cds-mysql)](https://www.npmjs.com/package/cds-mysql)
[![node-test](https://github.com/Soontao/cds-mysql/actions/workflows/nodejs.yml/badge.svg)](https://github.com/Soontao/cds-mysql/actions/workflows/nodejs.yml)
[![database-test](https://github.com/Soontao/cds-mysql/actions/workflows/database.yml/badge.svg)](https://github.com/Soontao/cds-mysql/actions/workflows/database.yml)

[![codecov](https://codecov.io/gh/Soontao/cds-mysql/branch/main/graph/badge.svg?token=xTt6AaHeuu)](https://codecov.io/gh/Soontao/cds-mysql)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-mysql&metric=security_rating)](https://sonarcloud.io/dashboard?id=Soontao_cds-mysql)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-mysql&metric=sqale_index)](https://sonarcloud.io/dashboard?id=Soontao_cds-mysql)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-mysql&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=Soontao_cds-mysql)

> `MySQL`/`MariaDB` adapter for [CAP Framework](https://cap.cloud.sap/docs/about/), this module is heavily inspired by the [cds-pg](https://github.com/sapmentors/cds-pg) module.

## Setup

firstly, install npm packages

```bash
npm i cds-mysql mysql2
```

setup the `mysql` database driver for cds -> edit the `package.json` > `cds` node (or `.cdsrc.json`)

```json
{
  "requires": {
    "db": {
      "kind": "mysql"
    }
  }
}
```

create an `.env` file and put that into your local CDS project, then fill the database credential

```bash
CDS_REQUIRES_DB_CREDENTIALS_HOST=127.0.0.1
CDS_REQUIRES_DB_CREDENTIALS_PORT=3306
CDS_REQUIRES_DB_CREDENTIALS_DATABASE= # db name
CDS_REQUIRES_DB_CREDENTIALS_USER= # db user
CDS_REQUIRES_DB_CREDENTIALS_PASSWORD= # db user pwd!
```

now, start the cds server (`npx cds-serve`), everything is ready!

> [!TIP]
> read more about how to config [database credential](./docs/ADVANCED_USAGE.md#configure-database-credential-by-environments-variables).

> [!TIP]
> read more about how to setup [database user](./docs/ADVANCED_USAGE.md#database).

---

in addition, please check [cap-mysql-sflight](https://github.com/Soontao/cap-mysql-sflight) to get the `mysql` version of official `cap-sflight` example, and it works well.

## [Advanced Documentation](./docs/ADVANCED_USAGE.md)

please read the full long version [Advanced Documentation](./docs/ADVANCED_USAGE.md) to get more technical details.

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
  - [ ] care entity dependencies - the order of CSV import
- [x] full text search
- [x] schema migration optimization (ignore drop in some case)
  - [ ] ignore column length reduce and with warning
  - [x] model version, only incremental migration - `transparent migration`
- [x] [`@Core.Media` attachment support](https://cap.cloud.sap/docs/guides/media-data)
- [x] [localized data](https://cap.cloud.sap/docs/guides/localized-data)
- [x] multi tenancy
  - [x] deploy model on-fly
  - [x] create database on-demand
    - [ ] user permission check
  - [x] _experimental_ [`@sap/cds-mtxs` support](https://cap.cloud.sap/docs/guides/multitenancy/mtxs) -> [document](./docs/MTXS.md) - behavior maybe changed later.
    - [x] extensibility (`pull`/`push`)
- [x] `$expand` navigation
- [x] `$filter` with canonical functions (`concat`/`contains`/`substring`)
- [x] test with `mariadb 10`, `mysql 5/8`
- [x] initial data provision by `CSV`
  - [x] better migration type/column/name adaption
- [x] mysql index
  - [ ] better error for not supported elements
- [x] automatically schema sync (when connection pool provision)
- [x] SELECT [`FOR UPDATE`](https://cap.cloud.sap/docs/node.js/cds-ql?q=forUpdate#select-forUpdate)/`LOCK IN SHARE MODE`
  - [ ] `NOWAIT` support
  - [ ] `SKIP LOCKED` support
- [x] better E2E document/sample - [cap-mysql-sflight](https://github.com/Soontao/cap-mysql-sflight)
- [ ] adapt new cds-dbs layer
- [ ] real stream adoption for binary

## [CHANGELOG](./CHANGELOG.md)

## [LICENSE](./LICENSE)
