const { cwdRequireCDS } = require("cds-internal-tool");

const cds = cwdRequireCDS();

module.exports = class DemoService extends cds.ApplicationService {

  init() {
    this.on("Upsert", this._upsert);
    super.init();
  }

  async _upsert(req) {
    // revisit view
    const Product = "test.upsert.Product";
    const { data } = req;
    await cds.run(cds.ql.UPSERT.into(Product).entries(data));
    return cds.run(cds.ql.SELECT.one.from(Product).where({ ID: data.ID }));
  }

};