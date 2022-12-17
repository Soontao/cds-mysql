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
    await cds.run(cds.ql.UPSERT.into(Products).entries(data));
    return cds.run(cds.ql.SELECT.one.from(Products).where({ ID: data.ID }));
  }

};