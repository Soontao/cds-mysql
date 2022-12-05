
module.exports = class DeploymentService extends cds.ApplicationService {
  async init() {
    await super.init();
    const { cwdRequireCDS } = require("cds-internal-tool");
    const cds = cwdRequireCDS();
    await cds.db.implDeploymentService(this); // must be mysql database service
  }
};