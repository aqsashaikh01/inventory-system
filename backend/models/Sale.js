const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  quantity: { type: Number, required: true },
  sellingPrice: { type: Number, required: true },
  soldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientName: { type: String },
  clientPhone: { type: String },
  paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'credit'], default: 'cash' }
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);