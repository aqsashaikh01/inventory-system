const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true },        // "Factory", "Outlet 1 - Pune"
  type: { type: String, enum: ['factory', 'shop'], required: true },
  address: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Location', locationSchema);