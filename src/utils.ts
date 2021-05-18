
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