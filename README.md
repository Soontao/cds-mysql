# cds mysql

[![npm version](https://img.shields.io/npm/v/cds-mysql?label=cds-mysql)](https://www.npmjs.com/package/cds-mysql)
![node-test](https://github.com/Soontao/cds-mysql/workflows/node-test/badge.svg)
[![codecov](https://codecov.io/gh/Soontao/cds-mysql/branch/main/graph/badge.svg?token=xTt6AaHeuu)](https://codecov.io/gh/Soontao/cds-mysql)

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-mysql&metric=security_rating)](https://sonarcloud.io/dashboard?id=Soontao_cds-mysql)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-mysql&metric=sqale_index)](https://sonarcloud.io/dashboard?id=Soontao_cds-mysql)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-mysql&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=Soontao_cds-mysql)
[![Libraries.io dependency status for GitHub repo](https://img.shields.io/librariesio/github/Soontao/cds-mysql)](https://libraries.io/github/Soontao/cds-mysql)

`MySQL`/`MariaDB`/`TiDB` adapter for [SAP CAP Framework](https://cap.cloud.sap/docs/about/), inspired by [cds-pg](https://github.com/sapmentors/cds-pg).

## Features

- [x] basic `INSERT`/`UPDATE`/`DELETE`/`SELECT`/`DROP`
- [x] deep insert
- [x] full text search
- [x] deploy & schema migration
- [x] migration optimization (ignore drop in some case)
- [x] [`@Core.Media` attachment support](https://cap.cloud.sap/docs/guides/generic#serving-media-data)
- [x] [localized data](https://cap.cloud.sap/docs/guides/localized-data)
- [ ] multi tenancy
- [x] `$expand` navigation
- [x] `$filter` with functions
- [x] test with `mariadb 10.4`, `mysql 5.6/5.7/8`
- [x] initial data provision by `CSV`

## Development

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
          "user": "cdsuser",
          "password": "cdsPas$w0rd",
          "database": "cdstest",
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
      "impl": "cds-mysql",
      "models": ["srv", "db"]
    }
  }
}
```

Then, edit your `cds` definitions & run the `cds-mysql-deploy` before start server.

## DB Artifacts Deployment

> `cds run` will **NOT** perform `DB deployment` automatically, development/infra should manually perform it before server start.

edit your `package.json` > `scripts` node, add `deploy` command

```json
{
  "scripts": {
    "deploy": "cds-mysql-deploy"
  }
}
```

and just run the `npm run deploy` is enough.

### Automatically Migration

`cds-mysql` will use the `cds` to generate `DDL` SQL, parse the `DDL` and convert it to `typeorm`-`EntitySchema` objects, then do the migration with `typeorm`.

It will be fullly automatically, sync changed `columns`, `views`.

It will **NEVER** drop old `tables`/`columns`, it will be **SAFE** in most cases.

**The mysql database must be empty (all table must be managed by cds-mysql, no pre-defined tables), otherwise the migration will be failed because typeorm detect the metadata by itself table**

### Enhanced CSV Migration

`cds-mysql` built-in a csv migration tool, it will migration data with key validation.


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

## [CHANGELOG](./CHANGELOG.md)

## [LICENSE](./LICENSE)
