/* eslint-disable max-len */

/**
 * overwrite cds compiler type mapping
 */
export function overwriteCDSCoreTypes() {

  const { cdsToSqlTypes } = require("@sap/cds-compiler/lib/render/utils/common");

  cdsToSqlTypes.sqlite = {
    "cds.Binary": "CHAR",
    "cds.hana.BINARY": "CHAR",
    "cds.hana.SMALLDECIMAL": "DECIMAL",
  };

}

/**
 * check cds version, if cds version is not match the `cds-mysql` required version, will throw error
 */
export function checkCdsVersion() {
  const { VERSION } = require("./cds.version");
  const cds = require("@sap/cds");
  if (cds.version !== VERSION) {
    throw new Error(`lib 'cds-mysql' requires '@sap/cds' with version: '${VERSION}', but installed '@sap/cds' version is: 
    ${cds.version}', please try other version 'cds-mysql'`);
  }
}