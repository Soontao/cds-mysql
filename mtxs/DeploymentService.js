require("colors");
const { cwdRequireCDS } = require("cds-internal-tool");

module.exports = class DeploymentService extends cds.ApplicationService {
  async init() {
    await super.init();
    const cds = cwdRequireCDS();
    await cds.db.implDeploymentService(this);
  }
};