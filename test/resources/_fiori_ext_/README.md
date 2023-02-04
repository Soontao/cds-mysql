# Extension Project of Integration Test Project

```bash
npx cds pull -u theo-on-tenant-2:pass --from localhost:4004
npx cds build --for mtx-extension
npx cds push ./gen/extension.tgz -u theo-on-tenant-2:pass --to localhost:4004
```
