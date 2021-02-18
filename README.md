# cds mysql

[![npm version](https://img.shields.io/npm/v/cds-mysql?label=cds-mysql)](https://www.npmjs.com/package/cds-mysql)
![node-test](https://github.com/Soontao/cds-mysql/workflows/node-test/badge.svg)
[![codecov](https://codecov.io/gh/Soontao/cds-mysql/branch/main/graph/badge.svg?token=xTt6AaHeuu)](https://codecov.io/gh/Soontao/cds-mysql)

`MySQL`/`MariaDB`/`TiDB` adapter for SAP CAP Core Data Service Runtime, inspired by [cds-pg](https://github.com/sapmentors/cds-pg)

## Features

- [x] basic `INSERT`/`UPDATE`/`DELETE`/`SELECT`/`DROP`
- [x] deep insert
- [x] full text search
- [ ] deploy & schema migration
- [ ] `$expand` navigation
- [ ] `$filter` with functions

## Known Issues

- function `contains(FIELD,'text')` not works correctly in `$filter`

## [CHANGELOG](./CHANGELOG.md)
## [LICENSE](./LICENSE)