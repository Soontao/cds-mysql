/* eslint-disable max-len */

import { cwdRequire, cwdRequireCDS, groupByKeyPrefix, memorized, mustBeArray } from "cds-internal-tool";
import { ANNOTATION_CDS_TYPEORM_CONFIG } from "./constants";

/**
 * overwrite cds compiler type mapping
 */
export function overwriteCDSCoreTypes() {

  if (!overwriteCDSCoreTypes["done"] === true) {
    const { cdsToSqlTypes } = cwdRequire("@sap/cds-compiler/lib/render/utils/common");
    // remove some types, fallback to the `cdsToSqlTypes.standard` data type
    cdsToSqlTypes.sqlite = {
      "cds.Binary": "BLOB",
      "cds.hana.BINARY": "BLOB",
      "cds.hana.SMALLDECIMAL": "DECIMAL",
    };
    cdsToSqlTypes.standard["cds.LargeString"] = "LONGTEXT";
    cdsToSqlTypes.standard["cds.hana.LargeString"] = "LONGTEXT";
    overwriteCDSCoreTypes["done"] = true;
  }

}

/**
 * check cds version, if cds version is not match the `cds-mysql` required version, will throw error
 */
export function checkCdsVersion() {
  const { VERSION } = require("./cds.version");
  const cds = cwdRequireCDS();
  const intersects = require("semver/ranges/intersects");
  if (!intersects(cds.version, VERSION)) {
    throw new Error(`lib 'cds-mysql' requires '@sap/cds' with version: '${VERSION}', but installed '@sap/cds' version is: 
    ${cds.version}', please try other version 'cds-mysql'`);
  }
}

export { memorized, mustBeArray };

export const getIncrementalKey = memorized((entityDef: any): any | undefined => {
  const [key] = Object.values(entityDef?.keys)
    .filter(keyEle => groupByKeyPrefix(keyEle, ANNOTATION_CDS_TYPEORM_CONFIG)?.generated === "increment");
  return key;
});