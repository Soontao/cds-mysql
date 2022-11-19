const { cwdRequireCDS } = require("cds-internal-tool");
const { UPSERT } = require("../../../../src");

const cds = cwdRequireCDS();

module.exports = class DemoService extends cds.ApplicationService {

  init() {
    this.on("Upsert", this._upsert);
    super.init();
  }

  async _upsert(req) {
    const { Products } = this.entities;
    const { data } = req;
    return this.run(UPSERT().into(Products).entries(data));
  }

};