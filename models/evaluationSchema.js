const mongoose = require('mongoose');

const academicYearRegex = /^(20\d{2})[\/-](20\d{2})$/; // يقبل 2024-2025 أو 2024/2025

const evaluationSchema = new mongoose.Schema({
  college: { type: String, required: true },            // الكلية
  committee_name: { type: String, required: true },     // اسم اللجنة

  formation_decision: { type: Number, default: 0 },
  work_plan: { type: Number, default: 0 },
  performance_indicators: { type: Number, default: 0 },
  meetings: { type: Number, default: 0 },
  consistency: { type: Number, default: 0 },
  coverage_books: { type: Number, default: 0 },
  report1: { type: Number, default: 0 },
  report2: { type: Number, default: 0 },
  report3: { type: Number, default: 0 },
  statistical_analysis: { type: Number, default: 0 },

  availability_score: { type: Number, default: 0 },

  notes: { type: String }, // HTML
  audit_date: { type: Date },
  auditor_name: { type: String, required: true },

  // حقول جديدة تُعبَّأ تلقائيًا من Settings عند الإنشاء
  term: { type: String, default: '' },
  academicYear: {
    type: String,
    default: '',
    validate: {
      validator: (v) => !v || academicYearRegex.test(v),
      message: 'صيغة العام الجامعي يجب أن تكون 2024-2025 أو 2024/2025'
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Evaluation', evaluationSchema);
