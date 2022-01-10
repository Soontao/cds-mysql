import { resolveValue } from "./resolver";


/**
 * parse deep env to object tree
 * 
 * @param obj env object, typically, it should be process.env
 * @returns 
 */
export function parseEnv(obj: object, prefix: string = ""): any {
  const rt = {};

  Object
    .keys(obj)
    .filter(key => key.toLowerCase().startsWith(prefix))
    .forEach(key => {
      const parts = key.toLowerCase().split("_");
      let ctx = rt;
      for (const part of parts.slice(0, parts.length - 1)) {
        if(ctx[part] === undefined) {
          ctx[part] = {};
        }
        ctx = ctx[part];
      }
      ctx[parts[parts.length - 1]] = resolveValue(obj[key]);
    });

  return rt;
}
