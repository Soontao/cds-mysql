const { ensureUnlocalized } = require('@sap/cds-runtime/lib/common/utils/draft');
const { redirect } = require('@sap/cds-runtime/lib/db/utils/localized');

// REVISIT: this is actually configurable
// there is no localized.en.<name>
const getLocalize = (locale, model) => name => {
  if (name.endsWith('_drafts')) {
    return name;
  }
  // if we get here via onReadDraft, target is already localized
  // because of subrequest using SELECT.from as new target
  const target = model.definitions[ensureUnlocalized(name)];
  const localizedView =
    target &&
    target['@cds.localized'] !== false &&
    model.definitions[`localized.${locale !== 'en' ? locale + '.' : ''}${name}`];

  return localizedView ? localizedView.name : name;
};

const _handler = function (req) {
  // do simple checks upfront and exit early
  if (!req.query || typeof req.query === 'string') return;
  if (!req.query.SELECT) return;
  if (!req.user || !req.user.locale) return;
  if (!this.model) return;

  redirect(req.query.SELECT, getLocalize(req.user.locale, this.model));
};

_handler._initial = true;

export default _handler;
