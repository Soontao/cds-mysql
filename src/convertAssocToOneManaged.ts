const { foreignKeyPropagations } = require('@sap/cds-runtime/lib/common/utils/foreignKeyPropagations');

function _convertRefForAssocToOneManaged(element, refEntry) {
  const foreignKey = refEntry.ref.join('_');
  foreignKeyPropagations(element, true, false).forEach(key => {
    if (key.parentFieldName === foreignKey) {
      refEntry.ref = [foreignKey];
    }
  });
}

const _getConvertibleEntries = req => {
  const orders = req.query.SELECT.orderBy || [];
  const groups = req.query.SELECT.groupBy || [];
  const filters = req.query.SELECT.where || [];
  const havings = req.query.SELECT.having || [];
  return [...orders, ...groups, ...filters, ...havings];
};

// REVISIT once sql can handle structured keys properly, this handler should not be required anymore
const _handler = req => {
  // do simple checks upfront and exit early
  if (!req.query || typeof req.query === 'string') return;
  if (!req.query.SELECT.orderBy && !req.query.SELECT.groupBy && !req.query.SELECT.where && !req.query.SELECT.having) { return; }

  if (!req.target || !req.target.elements) return;

  for (const refEntry of _getConvertibleEntries(req)) {
    if (!refEntry.ref || refEntry.ref.length < 2) {
      // only check refs in format {ref: ['assoc', 'id']}
      continue;
    }

    const element = req.target.elements[refEntry.ref[0]];
    if (!element || !element.is2one) return;

    _convertRefForAssocToOneManaged(element, refEntry);
  }
};

_handler._initial = true;

export default _handler;
