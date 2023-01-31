/* eslint-disable max-len */

import { cwdRequireCDS, groupByKeyPrefix, LinkedEntityDefinition, memorized, mustBeArray } from "cds-internal-tool";
import { ANNOTATION_CDS_TYPEORM_CONFIG, MIGRATION_VERSION_PREFIX } from "./constants";
import { Migration, Query } from "./types";


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

/**
 * return last 6 characters of target string
 * 
 * @param s 
 * @returns 
 */
export function last6Chars(s: string) {
  if (s.length < 6) {
    return s;
  }
  return s.slice(s.length - 6);
}

export { memorized, mustBeArray };

export const getIncrementalKey = memorized((entityDef: any): any | undefined => {
  const [key] = Object.values(entityDef?.keys)
    .filter(keyEle => groupByKeyPrefix(keyEle, ANNOTATION_CDS_TYPEORM_CONFIG)?.generated === "increment");
  return key;
});

/**
 * check the given entity has `preDelivery` aspect or not
 */
export const isPreDeliveryModel = memorized((entifyDef: LinkedEntityDefinition) => {
  return (
    entifyDef?.includes?.includes?.("preDelivery") &&
    entifyDef?.elements?.["PreDelivery"]?.type === "cds.Boolean"
  );
});


/**
 * migration file generation tool
 */
export const migration = {

  stringify(migrations: Array<Migration>): string {
    const parts = [];
    parts.push(`-- generated by cds-mysql`);
    parts.push(`-- database migration scripts`);
    parts.push(`-- do not manually change this file`);
    parts.push(""); // empty line

    for (const migration of migrations) {
      parts.push(`${MIGRATION_VERSION_PREFIX}${migration.version}`);
      parts.push(
        ...migration.statements.map(statement => statement.query + "\n")
      );
    }
    return parts.join("\n");
  },

  parse(content: string): Array<Migration> {
    const migrations = [];

    let current_migration: Migration = undefined;
    let statement: Query = undefined;
    for (const line of content.split("\n")) {
      if (line.trim().startsWith("--")) {
        if (line.startsWith(MIGRATION_VERSION_PREFIX)) {
          if (current_migration !== undefined) {
            current_migration.version = current_migration.version;
            migrations.push(current_migration);
          }
          // create a new context
          current_migration = {
            version: parseInt(line.slice(MIGRATION_VERSION_PREFIX.length)),
            statements: []
          };
        }
        // other is common comments, ignore
        continue;
      }
      // empty line
      if (line.trim().length === 0) {
        if (statement !== undefined && current_migration !== undefined) {
          statement.query = statement.query.trim();
          current_migration.statements.push(statement);
          statement = undefined;
        }
      }
      else {
        if (statement === undefined) {
          statement = { query: "" };
        }
        statement.query = statement.query + "\n" + line;
      }
    }
    // append last document
    if (current_migration !== undefined) { migrations.push(current_migration); }
    return migrations;
  },

};