const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String },
  description: { type: String },
  sku: { type: String, required: true, unique: true },
  qrCodeUrl: { type: String },
  photo: { type: String },
  sellingPrice: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  marathiName: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);