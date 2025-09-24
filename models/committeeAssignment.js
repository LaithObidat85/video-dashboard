// models/committeeAssignment.js
const mongoose = require('mongoose');

const committeeAssignmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  college: { type: String, required: true, trim: true },
  committee_name: { type: String, required: true, trim: true },
  // اختياري: وصف/ملاحظة
  note: { type: String, trim: true }
}, { timestamps: true });

// فهرس يمنع تكرار نفس (المستخدم ← الكلية+اللجنة)
committeeAssignmentSchema.index({ userId: 1, college: 1, committee_name: 1 }, { unique: true });

// فهرس يمنع وجود أكثر من مالك لنفس (الكلية+اللجنة)
committeeAssignmentSchema.index({ college: 1, committee_name: 1 }, { unique: true });

module.exports = mongoose.model('CommitteeAssignment', committeeAssignmentSchema);
