# cds mysql

[![npm version](https://img.shields.io/npm/v/cds-mysql?label=cds-mysql)](https://www.npmjs.com/package/cds-mysql)
![node-test](https://github.com/Soontao/cds-mysql/workflows/node-test/badge.svg)
[![codecov](https://codecov.io/gh/Soontao/cds-mysql/branch/main/graph/badge.svg?token=xTt6AaHeuu)](https://codecov.io/gh/Soontao/cds-mysql)

`MySQL`/`MariaDB`/`TiDB` adapter for [SAP CAP Framework](https://cap.cloud.sap/docs/about/), inspired by [cds-pg](https://github.com/sapmentors/cds-pg)

## Features

- [x] basic `INSERT`/`UPDATE`/`DELETE`/`SELECT`/`DROP`
- [x] deep insert
- [x] full text search
- [x] deploy & schema migration
- [x] migration optimization (ignore drop in some case)
- [ ] [localization (i18n)](https://cap.cloud.sap/docs/guides/localized-data)
- [ ] multi tenancy
- [x] `$expand` navigation
- [x] `$filter` with functions

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

`cds-mysql` will re-use `cds` generated SQL and `typeorm` migration logics. 

It will full automatically, sync changed `columns`, `views`.

It will **NEVER** drop old `tables`/`columns`, it will be **SAFE** in most cases.


## Limitation

* mysql 5.6 not support key length exceed 767 bytes
* `date` column not support default `$now`

## [CHANGELOG](./CHANGELOG.md)
## [LICENSE](./LICENSE)