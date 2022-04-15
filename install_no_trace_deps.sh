#!/bin/bash

if [ ! -d "node_modules/@sap/cds" ]; then
  echo "Installing no trace dependencies ...";
  CDS_VERSION=$(node -e "console.log(require('./src/cds.version').VERSION)");
  npm i --no-save express @sap/cds@$CDS_VERSION;
fi
