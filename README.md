# cds mysql

[![npm version](https://img.shields.io/npm/v/cds-mysql?label=cds-mysql)](https://www.npmjs.com/package/cds-mysql)
![node-test](https://github.com/Soontao/cds-mysql/workflows/node-test/badge.svg)
[![codecov](https://codecov.io/gh/Soontao/cds-mysql/branch/main/graph/badge.svg?token=xTt6AaHeuu)](https://codecov.io/gh/Soontao/cds-mysql)

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-mysql&metric=security_rating)](https://sonarcloud.io/dashboard?id=Soontao_cds-mysql)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-mysql&metric=sqale_index)](https://sonarcloud.io/dashboard?id=Soontao_cds-mysql)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-mysql&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=Soontao_cds-mysql)

`MySQL`/`MariaDB`/`TiDB` adapter for [SAP CAP Framework](https://cap.cloud.sap/docs/about/), inspired by [cds-pg](https://github.com/sapmentors/cds-pg).


## Features

- [x] basic `INSERT`/`UPDATE`/`DELETE`/`SELECT`/`DROP`
- [x] deep insert
- [x] full text search
- [x] deploy & schema migration
- [x] migration optimization (ignore drop in some case)
- [x] [`@Core.Media` attachment support](https://cap.cloud.sap/docs/guides/generic#serving-media-data)
- [ ] [localization (i18n)](https://cap.cloud.sap/docs/guides/localized-data)
- [ ] multi tenancy
- [x] `$expand` navigation
- [x] `$filter` with functions
- [x] test with `mariadb 10.4`, `mysql 5.6/5.7/8`
- [x] initial data provision by `CSV`

## Development

edit your `defualt-env.json` file, with `mysql` credential information

```json
{
  "VCAP_SERVICES": {
    "mysql": [
      {
        "name": "mysql",
        "label": "mysql",
        "tags": [
          "mysql"
        ],
        "credentials": {
          "user": "<db user name>",
          "password": "<db password>",
          "database": "<db schema name>",
          "port": 3306,
          "host": "<db host name>"
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

`cds-mysql` will use the `cds` to generate `DDL` SQL, parse the `DDL` and convert it with `typeorm`-`EntitySchema`, then do the migration with `typeorm`. 

It will full automatically, sync changed `columns`, `views`.

It will **NEVER** drop old `tables`/`columns`, it will be **SAFE** in most cases.


## Limitation

* mysql 5.6 not support key length exceed 767 bytes
* `date` column not support default `$now`
* upload attachment maybe will meet `max_allowed_packet` issue, [it can be configured on server side](https://dev.mysql.com/doc/refman/8.0/en/packet-too-large.html). (default is `1MB`)
* The internal representation of a MySQL table has a maximum row size limit of `65,535` bytes.
* The default `varchar(5000)` will be converted to unlimited `text` type, so, **DO NOT** remember add length for the unlimited `String` fields.
* The `Boolean` type is represented as `TINYINT(1)` in mysql server, as a result, `boolean default true/false` will be converted to `TINYINT DEFAULT 1/0`.

## [CHANGELOG](./CHANGELOG.md)
## [LICENSE](./LICENSE)