#!/bin/bash
CDS_VERSION=$(node -e "console.log(require('./src/cds.version').VERSION)")
npm i --no-save @sap/cds@$CDS_VERSION