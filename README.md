# cds mysql

[![npm version](https://img.shields.io/npm/v/cds-mysql?label=cds-mysql)](https://www.npmjs.com/package/cds-mysql)
![node-test](https://github.com/Soontao/cds-mysql/workflows/node-test/badge.svg)
[![tidb-test](https://github.com/Soontao/cds-mysql/actions/workflows/tidb.yml/badge.svg)](https://github.com/Soontao/cds-mysql/actions/workflows/tidb.yml)
[![database-test](https://github.com/Soontao/cds-mysql/actions/workflows/database.yml/badge.svg)](https://github.com/Soontao/cds-mysql/actions/workflows/database.yml)
[![codecov](https://codecov.io/gh/Soontao/cds-mysql/branch/main/graph/badge.svg?token=xTt6AaHeuu)](https://codecov.io/gh/Soontao/cds-mysql)

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-mysql&metric=security_rating)](https://sonarcloud.io/dashboard?id=Soontao_cds-mysql)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-mysql&metric=sqale_index)](https://sonarcloud.io/dashboard?id=Soontao_cds-mysql)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-mysql&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=Soontao_cds-mysql)
![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/cds-mysql)

> `MySQL`/`MariaDB`/`TiDB` adapter for [SAP CAP Framework](https://cap.cloud.sap/docs/about/), inspired by [cds-pg](https://github.com/sapmentors/cds-pg).

## Features

- [x] basic `INSERT`/`UPDATE`/`DELETE`/`SELECT` query support
- [x] deep insert for association/composition
  - [ ] deep update test case
- [x] full text search
- [x] deploy & schema migration
- [x] migration optimization (ignore drop in some case)
  - [ ] ignore column length reduce and with warning
  - [ ] model version, only incremental migration
- [x] [`@Core.Media` attachment support](https://cap.cloud.sap/docs/guides/generic#serving-media-data)
- [x] [localized data](https://cap.cloud.sap/docs/guides/localized-data) with `sqlite` dialect
- [ ] multi tenancy
  - [x] deploy model on-fly
  - [ ] create database on-demand
    - [ ] permission check
  - [ ] dynamic database credential provider
  - [ ] documentation
  - [ ] admin database concept
- [x] `$expand` navigation
- [x] `$filter` with functions
- [x] test with `mariadb 10.4`, `mysql 5.6/5.7/8`, `TiDB`
- [x] initial data provision by `CSV`
- [x] auto incremental key aspect (odata only, single records)
- [x] mysql index
  - [ ] better error for not supported elements
- [x] automatically schema sync (when create pool)
  - [ ] sync data model online
  - [ ] sync CSV data when model changed
- [ ] better E2E document/sample


## Setup

put the `default-env.json` file into the root directory of your CAP project, with `mysql` credential information.

please **NOTICE** that, the `{ tags: ['mysql'] }` is the key which used for service credential lookup in CAP framework.

for the supported options in `credentials` node, just ref the [mysql official connection options document](https://www.npmjs.com/package/mysql#connection-options)

```json
{
  "VCAP_SERVICES": {
    "user-provided": [
      {
        "label": "user-provided",
        "name": "remote-mysql-service",
        "tags": [
          "mysql"
        ],
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

```json5
{
  "requires": {
    "db": {
      "kind": "mysql",
      "dialect": "sqlite" // add this if you want to make `localized` elements works
    },
    "mysql": {
      "impl": "cds-mysql"
    }
  }
}
```

edit your `package.json` > `scripts` node, add the `deploy` command

```json
{
  "scripts": {
    "deploy": "cds-mysql-deploy"
  }
}
```

Then, write your own `cds` definitions & execute the `npm run deploy` to deploy schema before server start.


## Usage

> some advanced usage

### Auto Incremental Key

> define entity with `incrementalID` aspect like cds built-in `cuid` aspect

```groovy
using {incrementID} from 'cds-mysql';

// the entity `Animal` will have an auto-filled 'ID' field 
// ONLY support single record insert
entity Animal : incrementID {
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

### Setup Database for Cloud Foundry

> if you want to run cds-mysql on cloud foundry

create mysql service by [`cf cups`](http://cli.cloudfoundry.org/en-US/cf/create-user-provided-service.html) with following format

```bash
cf cups remote-mysql-service -t 'mysql' -p '{"host":"public.mysql.instance.com","user":"cds-user","password":"CdsUser123$","database":"cds-user","port":3306,"ssl":{"ca":"-----BEGIN CERTIFICATE-----\n ......\n-----END CERTIFICATE-----\n"}}'
```

you can convert PEM cert to json format with [this document](https://docs.vmware.com/en/Unified-Access-Gateway/2.9/com.vmware.access-point-29-deploy-config/GUID-870AF51F-AB37-4D6C-B9F5-4BFEB18F11E9.html), just run command

```bash
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' cert-name.pem
```

## Schema Migration

`cds-mysql` will use the `cds compiler` to generate `DDL` SQL statements, parse the `DDL` statements and convert it to `typeorm`-`EntitySchema` objects, then do the migration with `typeorm`.

```mermaid
graph LR
    CDS[CDS Definition] --> |compile CDS to DDL| DDL[Compiled DDL]
    DDL --> |ast parser| te[TypeORM Entity Metadata]
    te --> |use typeorm migrate schema|Schema[Database Schema]
```


It will be fully automatically, sync changed `columns`, `views`.

It will **NEVER** drop old `tables`/`columns`, it will be **SAFE** in most cases.

**The mysql database must be empty (all table must be managed by cds-mysql, no pre-defined tables), otherwise the migration will be failed because typeorm detect the metadata by itself table**

## Enhanced CSV Migration

`cds-mysql-deploy` has a built-in csv migration tool, it will migrate data with key validation (enhance `cds` built-in one for sqlite).


## Compatibility Table

| @sap/cds version | cds-mysql version |
|------------------|-------------------|
| 5.8.x            | 5.9.x             |
| 5.9.x            | 5.9.x             |

## Limitation

- mysql 5.6 not support key length exceed 767 bytes
- `date` column not support default `$now`
- upload attachment maybe will meet `max_allowed_packet` issue, [it can be configured on server side](https://dev.mysql.com/doc/refman/8.0/en/packet-too-large.html). (default is `1MB`)
- The internal representation of a MySQL table has a maximum row size limit of `65,535` bytes.
- The default `varchar(5000)` will be converted to unlimited `text` type, so, **DO NOT** remember add length for the unlimited `String` fields.
- The `Boolean` type is represented as `TINYINT(1)` in mysql server, as a result, `boolean default true/false` will be converted to `TINYINT DEFAULT 1/0`.
- `DDL` on `TiDB` is extremely slowly, even no data in tables

## [CHANGELOG](./CHANGELOG.md)

## [LICENSE](./LICENSE)
