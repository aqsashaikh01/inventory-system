const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  quantity: { type: Number, default: 0 }
}, { timestamps: true });

// One inventory record per product per location
inventorySchema.index({ product: 1, location: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', inventorySchema);