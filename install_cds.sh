#!/bin/bash
CDS_VERSION=$(node -e "console.log(require('./src/cds.version').VERSION)")
npm i --no-save express @sap/cds@$CDS_VERSION