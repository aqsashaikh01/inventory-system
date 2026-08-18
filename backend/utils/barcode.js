const bwipjs = require('bwip-js');

// Code128 barcode for a unit code (e.g. MILK-500-UNIT-001).
// The barcode encodes the bare unit code — not a URL — because a 1D symbol
// can't hold one at a scannable density on a 60mm label.
// Rendered oversized so the label canvas downscales it (sharp edges) rather
// than stretching it up (blurred bars).
const generateBarcodePng = (text, { barHeightMm = 16 } = {}) =>
  bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 3,
    height: barHeightMm,
    includetext: false, // no digits under the bars — the label carries the name and MRP
    backgroundcolor: 'FFFFFF',
    paddingwidth: 0,
    paddingheight: 0,
  });

module.exports = { generateBarcodePng };
