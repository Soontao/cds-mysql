const cds = require("@sap/cds");
const path = require("path");
const kinds = cds.env.kinds ??= {};

if (kinds.mysql === undefined) {
  kinds["mysql"] = {
    impl: path.join(__dirname, "./lib/index.js")
  };
  kinds["cds.xt.DeploymentService"] = {
    model: path.join(__dirname, "./mtxs/DeploymentService.cds")
  };
}