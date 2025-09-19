// models/userSchema.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true }, // مشفّرة بـ bcrypt
  role:        { type: String, enum: ['admin', 'user'], default: 'user' },
  isActive:    { type: Boolean, default: true },
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
