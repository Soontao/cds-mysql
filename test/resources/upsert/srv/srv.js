const { cwdRequireCDS } = require("cds-internal-tool");

const cds = cwdRequireCDS();

module.exports = class DemoService extends cds.ApplicationService {

  init() {
    this.on("Upsert", this._upsert);
    super.init();
  }

  async _upsert(req) {
    const { Products } = this.entities;
    const { data } = req;
    const q = INSERT.into(Products).entries(data);
    q.INSERT._upsert = true;
    return this.run(q);
  }

};