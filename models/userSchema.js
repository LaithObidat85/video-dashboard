// models/userSchema.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },

  // اسم المستخدم (فريد ويُستخدم لتسجيل الدخول)
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,     // تخزينه بحروف صغيرة لتجنّب التكرار حسب حالة الأحرف
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-z0-9_.]+$/ // أحرف إنجليزية صغيرة/أرقام/نقطة/شرطة سفلية فقط
  },

  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true }, // مشفّرة بـ bcrypt
  role:        { type: String, enum: ['admin', 'user'], default: 'user' },
  isActive:    { type: Boolean, default: true },
  lastLogin: { type: Date },           // ✅ جديد
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
