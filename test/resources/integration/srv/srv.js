const { sleep } = require("@newdash/newdash");
const { cwdRequireCDS } = require("cds-internal-tool");

const cds = cwdRequireCDS();


module.exports = class BankService extends cds.ApplicationService {
  init() {
    const { Cards } = this.entities;
    this.on("AddOneCreditToCard", async function (req) {
      const card = await this.run(SELECT.from(Cards, req.data.ID).forUpdate());
      await sleep(50);
      await this.run(UPDATE.entity(Cards, req.data.ID).set({
        Credit: parseFloat(card.Credit) + 1
      }));
      return this.run(SELECT.from(Cards, req.data.ID));
    });

    super.init();
  }
};