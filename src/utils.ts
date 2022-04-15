/* eslint-disable max-len */

import { ANNOTATION_CDS_TYPEORM_CONFIG } from "./constants";

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
  const intersects = require("semver/ranges/intersects");
  if (!intersects(cds.version, VERSION)) {
    throw new Error(`lib 'cds-mysql' requires '@sap/cds' with version: '${VERSION}', but installed '@sap/cds' version is: 
    ${cds.version}', please try other version 'cds-mysql'`);
  }
}


// TODO: reuse
export function groupByKey(prefix: string, obj: any): Partial<typeof obj> {
  return Object
    .keys(obj)
    .filter(key => key.startsWith(prefix))
    .reduce((pre, cur) => { pre[cur.slice(cur === prefix ? prefix.length : (prefix.length + 1))] = obj[cur]; return pre; }, {});
}

/**
 * utils for memorized (sync) **ONE-parameter** function
 * 
 * @param func a function which only have one parameter
 * @returns 
 */
export const memorized = <T extends (arg0: any) => any>(func: T): T => {
  let cache: WeakMap<any, any>;

  // @ts-ignore
  return function (arg0: any) {
    if (typeof arg0 === "object") {
      cache = new WeakMap();
    } else {
      cache = new Map();
    }
    if (!cache.has(arg0)) {
      cache.set(arg0, func(arg0));
    }
    return cache.get(arg0);
  };
};

export function mustBeArray<T extends Array<any>>(obj: T): T;
export function mustBeArray(obj: null): [];
export function mustBeArray(obj: undefined): [];
export function mustBeArray<T extends object>(obj: T): [T];
export function mustBeArray(obj: any): Array<any> {
  if (obj instanceof Array) {
    return obj;
  }
  if (obj === undefined || obj === null) {
    return [];
  }
  return [obj];
};

export const getIncrementalKey = memorized((entityDef: any): any | undefined => {
  const [key] = Object.values(entityDef?.keys)
    .filter(keyEle => groupByKey(ANNOTATION_CDS_TYPEORM_CONFIG, keyEle)?.generated === "increment");
  return key;
});