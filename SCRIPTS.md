# Useful Scripts



## k8s

connect to k8s mysql service

```bash
kubectl port-forward service/ccds-test-mysql 33306:3306
```

## Env File

```env
CDS_REQUIRES_DB_CREDENTIALS_USER=cds_admin
CDS_REQUIRES_DB_CREDENTIALS_PASSWORD=cds_admin
CDS_REQUIRES_DB_CREDENTIALS_DATABASE=cds_admin
CDS_REQUIRES_DB_CREDENTIALS_HOST=127.0.0.1
CDS_REQUIRES_DB_CREDENTIALS_PORT=33306
```

## User Creation

```sql
CREATE DATABASE IF NOT EXISTS `cds_admin`;
CREATE USER IF NOT EXISTS 'cds_admin'@'%' IDENTIFIED BY 'cds_admin'; 
GRANT ALL PRIVILEGES ON *.* TO 'cds_admin'@'%' WITH GRANT OPTION;
```

