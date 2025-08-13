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

// ====== النماذج ======
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

const linkSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  link: { type: String, required: true },
  linkText: { type: String, required: true },
  requiresPassword: { type: Boolean, default: false },
  dateAdded: { type: Date, default: Date.now }
});
const Link = mongoose.model('Link', linkSchema);

// ====== كلمات المرور ======
const passwordSchema = new mongoose.Schema({
  section: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const Password = mongoose.model('sitepasswords', passwordSchema); // اسم collection الجديد

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ التحقق من كلمة المرور للوحة التحكم
app.post('/api/verify-password', async (req, res) => {
  const { password } = req.body;
  try {
    const dashboardPass = await Password.findOne({ section: 'dashboard' });
    if (dashboardPass && dashboardPass.password === password) {
      return res.sendStatus(200);
    }
    return res.sendStatus(403);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ إدارة كلمات المرور
app.get('/api/passwords', async (req, res) => {
  try {
    const passwords = await Password.find();
    res.json(passwords);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/passwords', async (req, res) => {
  try {
    const pass = new Password(req.body);
    await pass.save();
    res.status(201).json(pass);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/passwords/:id', async (req, res) => {
  try {
    const updated = await Password.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/passwords/:id', async (req, res) => {
  try {
    await Password.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم حذف كلمة المرور' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ التحقق من كلمة مرور قسم أو رابط
app.post('/api/check-section-password', async (req, res) => {
  const { section, password } = req.body;
  try {
    const record = await Password.findOne({ section });
    if (!record) return res.status(404).json({ error: 'القسم غير موجود' });
    if (record.password === password) return res.sendStatus(200);
    return res.sendStatus(403);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== إدارة الأقسام ======
app.get('/api/departments', async (req, res) => {
  try {
    const deps = await Department.find().sort({ name: 1 });
    res.json(deps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/departments', async (req, res) => {
  try {
    const dep = new Department({ name: req.body.name });
    await dep.save();
    res.status(201).json(dep);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/departments/:id', async (req, res) => {
  try {
    const dep = await Department.findByIdAndUpdate(req.params.id, { name: req.body.name }, { new: true });
    res.json(dep);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/departments/:id', async (req, res) => {
  try {
    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم حذف القسم' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ====== إدارة الفيديوهات ======
app.get('/api/videos', async (req, res) => {
  try {
    const videos = await Video.find().sort({ dateAdded: -1 });
    res.json(videos);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في قراءة الفيديوهات' });
  }
});

app.post('/api/videos', async (req, res) => {
  try {
    const video = new Video(req.body);
    await video.save();
    res.status(201).json(video);
  } catch (err) {
    res.status(400).json({ message: 'خطأ في إضافة الفيديو', error: err.message });
  }
});

app.put('/api/videos/:id', async (req, res) => {
  try {
    const updated = await Video.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'الفيديو غير موجود' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'خطأ في التعديل', error: err.message });
  }
});

app.delete('/api/videos/:id', async (req, res) => {
  try {
    const deleted = await Video.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'الفيديو غير موجود' });
    res.json({ message: '✅ تم حذف الفيديو' });
  } catch (err) {
    res.status(400).json({ message: 'خطأ في الحذف', error: err.message });
  }
});

// ====== إدارة الروابط ======
app.get('/api/links', async (req, res) => {
  try {
    const links = await Link.find().sort({ dateAdded: -1 });
    res.json(links);
  } catch (err) {
    res.status(500).json({ message: '❌ خطأ في جلب الروابط' });
  }
});

app.post('/api/links', async (req, res) => {
  try {
    const link = new Link(req.body);
    await link.save();
    res.status(201).json(link);
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في إضافة الرابط', error: err.message });
  }
});

// تعديل أو حذف الروابط مع تحقق من كلمة المرور من قاعدة البيانات
app.put('/api/links/:id', async (req, res) => {
  const { sectionPassword } = req.body;
  const passRecord = await Password.findOne({ section: 'links' });
  if (!passRecord || passRecord.password !== sectionPassword) {
    return res.status(403).json({ message: '❌ كلمة المرور غير صحيحة' });
  }
  try {
    const updated = await Link.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في تعديل الرابط', error: err.message });
  }
});

app.delete('/api/links/:id', async (req, res) => {
  const { sectionPassword } = req.body;
  const passRecord = await Password.findOne({ section: 'links' });
  if (!passRecord || passRecord.password !== sectionPassword) {
    return res.status(403).json({ message: '❌ كلمة المرور غير صحيحة' });
  }
  try {
    await Link.findByIdAndDelete(req.params.id);
    res.json({ message: '🗑️ تم حذف الرابط بنجاح' });
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في الحذف', error: err.message });
  }
});

// ▶️ تشغيل الخادم
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على: http://localhost:${PORT}`);
});
