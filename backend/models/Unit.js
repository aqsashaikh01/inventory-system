const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  unitCode: { type: String, required: true, unique: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  qrCodeUrl: { type: String },
  // Which symbol is printed on this unit's sticker. Units created before the
  // switch carry QR codes and keep scanning; everything new is Code128.
  codeType: { type: String, enum: ['qr', 'barcode'], default: 'qr' },
  status: {
    type: String,
    enum: ['generated', 'in_factory', 'dispatched', 'in_shop', 'sold'],
    default: 'generated'
  },
  currentLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
  scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  soldAt: { type: Date, default: null },
  dispatchedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
  clientName: { type: String, default: '' },
  clientPhone: { type: String, default: '' },
  paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'credit'], default: 'cash' }
}, { timestamps: true });

module.exports = mongoose.model('Unit', unitSchema);