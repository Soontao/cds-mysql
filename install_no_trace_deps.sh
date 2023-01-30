#!/bin/bash

if [ ! -d "node_modules/@sap/cds" ]; then
  echo "Installing no trace dependencies ...";
  CDS_VERSION=$(node -e "console.log(require('./src/cds.version').VERSION)");
  MTXS_VERSION=$(node -e "console.log(require('./src/cds.version').MTXS_VERSION)");
  npm i --no-save express @sap/cds@$CDS_VERSION @sap/cds-dk@$CDS_VERSION @sap/cds-mtxs@$MTXS_VERSION sqlite3;
fi
