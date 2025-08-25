// models/auditorSchema.js
const mongoose = require('mongoose');

const auditorSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // اسم المدقق
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Auditor', auditorSchema);
