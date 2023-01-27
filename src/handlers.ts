// enhanced handlers for mysql database service

import { cwdRequireCDS, fuzzy, NextFunction, Request } from "cds-internal-tool";
import { MySQLDatabaseService } from "./Service";
import { isPreDeliveryModel } from "./utils";


const cds = cwdRequireCDS();

/**
 * 
 * disable deletion for pre-delivered data
 * 
 * @param req 
 * @param next 
 * @returns 
 */
export async function _disable_deletion_for_predelivery(this: MySQLDatabaseService, req: Request, next: NextFunction) {
  if (
    typeof req.query === "object" &&
    !(req.query instanceof Array) &&
    "DELETE" in req.query &&
    typeof req.query.DELETE?.from === "string"
  ) {

    const entity = fuzzy.findEntity(req.query.DELETE.from, this.model); // REVISIT: tenant model ?
    if (entity !== undefined && isPreDeliveryModel(entity)) {
      const { SELECT } = cds.ql;
      const { COUNT } = await this.run(
        SELECT.one
          .from(entity.name)
          .columns("count(1) AS COUNT")
          .where(req.query.DELETE.where)
      );
      if (COUNT > 0) {
        return req.reject(400, "ERR_DELETE_PRE_DELIVERED_DATA");
      }
    }
  }
  return next();
}