const mongoose = require('mongoose');

const movementSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  fromLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
  toLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
  quantity: { type: Number, required: true },
  type: {
    type: String,
    enum: ['stock_in', 'dispatch', 'receive', 'sold'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'received', 'done'],
    default: 'done'
  },
  scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Movement', movementSchema);