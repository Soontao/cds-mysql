# TIDB dockerfile

## Build

```bash
docker build -t thedockerimages/tidb .
docker push thedockerimages/tidb
```

## Run

```bash
docker run -d --name tidb_inst thedockerimages/tidb
```

## Health Check

```bash
mysqladmin ping --host 127.0.0.1 --port 4000
```