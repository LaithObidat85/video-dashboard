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

// نموذج بيانات الفيديو
const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  department: { type: String, required: true },
  description: String,
  dateAdded: { type: Date, default: Date.now }
});
const Video = mongoose.model('Video', videoSchema);

// نموذج النسخ الاحتياطية
const backupSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  data: Array
});
const Backup = mongoose.model('Backup', backupSchema);

// نموذج الأقسام
const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});
const Department = mongoose.model('Department', departmentSchema);

// نموذج بيانات الملفات
const fileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  link: { type: String, required: true },
  linkText: { type: String, required: true },
  dateAdded: { type: Date, default: Date.now }
});
const File = mongoose.model('File', fileSchema);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ التحقق من كلمة المرور للوحة التحكم
app.post('/api/verify-password', (req, res) => {
  const { password } = req.body;
  if (password === process.env.DASHBOARD_PASSWORD) return res.sendStatus(200);
  else return res.sendStatus(403);
});

// ====== إدارة الأقسام ======

// جلب الأقسام
app.get('/api/departments', async (req, res) => {
  try {
    const deps = await Department.find().sort({ name: 1 });
    res.json(deps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إضافة قسم جديد
app.post('/api/departments', async (req, res) => {
  try {
    const dep = new Department({ name: req.body.name });
    await dep.save();
    res.status(201).json(dep);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// تعديل قسم
app.put('/api/departments/:id', async (req, res) => {
  try {
    const dep = await Department.findByIdAndUpdate(req.params.id, { name: req.body.name }, { new: true });
    res.json(dep);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// حذف قسم
app.delete('/api/departments/:id', async (req, res) => {
  try {
    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم حذف القسم' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ====== إدارة الفيديوهات ======

// 📥 جلب الفيديوهات
app.get('/api/videos', async (req, res) => {
  try {
    const videos = await Video.find().sort({ dateAdded: -1 });
    res.json(videos);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في قراءة الفيديوهات' });
  }
});

// ➕ إضافة فيديو
app.post('/api/videos', async (req, res) => {
  try {
    const video = new Video(req.body);
    await video.save();
    res.status(201).json(video);
  } catch (err) {
    res.status(400).json({ message: 'خطأ في إضافة الفيديو', error: err.message });
  }
});

// ✏️ تعديل فيديو
app.put('/api/videos/:id', async (req, res) => {
  try {
    const updated = await Video.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'الفيديو غير موجود' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'خطأ في التعديل', error: err.message });
  }
});

// 🗑️ حذف فيديو
app.delete('/api/videos/:id', async (req, res) => {
  try {
    const deleted = await Video.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'الفيديو غير موجود' });
    res.json({ message: '✅ تم حذف الفيديو' });
  } catch (err) {
    res.status(400).json({ message: 'خطأ في الحذف', error: err.message });
  }
});

// ====== إدارة الملفات ======

// جلب الملفات
app.get('/api/files', async (req, res) => {
  try {
    const files = await File.find().sort({ dateAdded: -1 });
    res.json(files);
  } catch (err) {
    res.status(500).json({ message: '❌ خطأ في جلب الملفات' });
  }
});

// إضافة ملف
app.post('/api/files', async (req, res) => {
  try {
    const file = new File(req.body);
    await file.save();
    res.status(201).json(file);
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في إضافة الملف', error: err.message });
  }
});

// ====== إدارة النسخ الاحتياطية ======

// 📦 إنشاء نسخة احتياطية داخل MongoDB
app.post('/api/backups/create', async (req, res) => {
  try {
    const videos = await Video.find();
    const backup = new Backup({ data: videos });
    await backup.save();
    res.json({ message: '✅ تم إنشاء النسخة الاحتياطية وحفظها في قاعدة البيانات' });
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في إنشاء النسخة الاحتياطية', error: err.message });
  }
});

// 📂 عرض النسخ الاحتياطية
app.get('/api/backups', async (req, res) => {
  try {
    const backups = await Backup.find().sort({ date: -1 });
    res.json(backups);
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في جلب النسخ الاحتياطية' });
  }
});

// 🗑️ حذف نسخة احتياطية
app.delete('/api/backups/:id', async (req, res) => {
  try {
    await Backup.findByIdAndDelete(req.params.id);
    res.json({ message: '🗑️ تم حذف النسخة الاحتياطية بنجاح' });
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في الحذف', error: err.message });
  }
});

// ⬇️ تنزيل نسخة احتياطية كـ JSON
app.get('/api/backups/download/:id', async (req, res) => {
  try {
    const backup = await Backup.findById(req.params.id);
    if (!backup) return res.status(404).json({ message: '❌ النسخة غير موجودة' });
    res.setHeader('Content-Disposition', `attachment; filename=backup-${backup.date.toISOString()}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(backup.data, null, 2));
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في تنزيل النسخة' });
  }
});

// 🔄 استرجاع نسخة احتياطية إلى Collection الفيديوهات
app.post('/api/backups/restore/:id', async (req, res) => {
  try {
    const backup = await Backup.findById(req.params.id);
    if (!backup) return res.status(404).json({ message: '❌ النسخة غير موجودة' });

    await Video.deleteMany({});
    await Video.insertMany(backup.data);

    res.json({ message: '♻️ تم استرجاع النسخة الاحتياطية بنجاح إلى قاعدة البيانات' });
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في الاسترجاع', error: err.message });
  }
});

// ▶️ تشغيل الخادم
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على: http://localhost:${PORT}`);
});
