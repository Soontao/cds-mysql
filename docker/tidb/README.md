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
