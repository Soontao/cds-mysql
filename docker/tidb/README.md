# [TiDB Dockerfile](https://hub.docker.com/r/thedockerimages/tidb)

> TiDB image for Unit Test 

## Build

```bash
docker build -t thedockerimages/tidb .
docker push thedockerimages/tidb
```

## Run

```bash
docker run -d --name tidb_inst -p 4000:4000 thedockerimages/tidb
```

## Health Check

```bash
mysqladmin ping --host 127.0.0.1 --port 4000 -u root
```

## User Creation

```sql
CREATE DATABASE cdstest;
CREATE USER 'cdstest'@'%' IDENTIFIED BY 'cdstest';
GRANT ALL on cdstest.* to 'cdstest'@'%';
```

## Env File

```env
CDS_REQUIRES_MYSQL_CREDENTIALS_USER=root
CDS_REQUIRES_MYSQL_CREDENTIALS_PASSWORD=
CDS_REQUIRES_MYSQL_CREDENTIALS_DATABASE=test
CDS_REQUIRES_MYSQL_CREDENTIALS_HOST=127.0.0.1
CDS_REQUIRES_MYSQL_CREDENTIALS_PORT=4000
```