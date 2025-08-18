// server.js
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// الاتصال بـ MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ====== نماذج البيانات ======
const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  department: { type: String, required: true },
  description: String,
  dateAdded: { type: Date, default: Date.now }
});
const Video = mongoose.model('Video', videoSchema);

const backupSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  data: Array
});
const Backup = mongoose.model('Backup', backupSchema);

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});
const Department = mongoose.model('Department', departmentSchema);

// ✅ نموذج جديد للروابط
const linkSchema = new mongoose.Schema({
  linkText: { type: String, required: true },
  link: { type: String, required: true },
  description: String,
  requiresPassword: { type: Boolean, default: false },
  dateAdded: { type: Date, default: Date.now }
});
const Link = mongoose.model('Link', linkSchema);

// Middleware
app.use(bodyParser.json());

// ✅ تعديل هنا فقط: تقديم الصفحات من مجلد "public"
app.use(express.static(path.join(__dirname, 'public')));

// ====== API: جلب الروابط ======
app.get('/api/links', async (req, res) => {
  try {
    const links = await Link.find().sort({ dateAdded: -1 });
    res.json(links);
  } catch (err) {
    console.error('❌ Error fetching links:', err);
    res.status(500).json({ error: 'خطأ في جلب الروابط' });
  }
});

// ====== API: إعادة التوجيه للرابط ======
app.get('/api/redirect/:id', async (req, res) => {
  try {
    const link = await Link.findById(req.params.id);
    if (!link) return res.status(404).send('الرابط غير موجود');
    res.redirect(link.link);
  } catch (err) {
    console.error('❌ Redirect error:', err);
    res.status(500).send('خطأ في إعادة التوجيه');
  }
});

// ====== تشغيل السيرفر ======
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
