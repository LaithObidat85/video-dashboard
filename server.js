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

const linkSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  link: { type: String, required: true },
  linkText: { type: String, required: true },
  requiresPassword: { type: Boolean, default: false },
  dateAdded: { type: Date, default: Date.now }
});
const Link = mongoose.model('Link', linkSchema);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ التحقق من كلمة المرور - يسمح بكلمتين: واحدة للوحة التحكم وأخرى لصفحة عرض الروابط
app.post('/api/verify-password', (req, res) => {
  const { password } = req.body;
  const isDashboard = password === process.env.DASHBOARD_PASSWORD;
  const isLinks = password === process.env.LINKS_PAGE_PASSWORD;

  if (isDashboard || isLinks) return res.sendStatus(200);
  else return res.sendStatus(403);
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

app.put('/api/links/:id', async (req, res) => {
  try {
    const updated = await Link.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في تعديل الرابط', error: err.message });
  }
});

app.delete('/api/links/:id', async (req, res) => {
  try {
    await Link.findByIdAndDelete(req.params.id);
    res.json({ message: '🗑️ تم حذف الرابط بنجاح' });
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في الحذف', error: err.message });
  }
});

// ====== إدارة النسخ الاحتياطية ======
app.post('/api/backups/create', async (req, res) => {
  try {
    const videos = await Video.find();
    const backup = new Backup({ data: videos });
    await backup.save();
    res.json({ message: '✅ تم إنشاء النسخة الاحتياطية' });
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في إنشاء النسخة', error: err.message });
  }
});

app.get('/api/backups', async (req, res) => {
  try {
    const backups = await Backup.find().sort({ date: -1 });
    res.json(backups);
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في جلب النسخ' });
  }
});

app.delete('/api/backups/:id', async (req, res) => {
  try {
    await Backup.findByIdAndDelete(req.params.id);
    res.json({ message: '🗑️ تم حذف النسخة' });
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في الحذف', error: err.message });
  }
});

app.get('/api/backups/download/:id', async (req, res) => {
  try {
    const backup = await Backup.findById(req.params.id);
    if (!backup) return res.status(404).json({ message: '❌ النسخة غير موجودة' });
    res.setHeader('Content-Disposition', `attachment; filename=backup-${backup.date.toISOString()}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(backup.data, null, 2));
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في التنزيل' });
  }
});

app.post('/api/backups/restore/:id', async (req, res) => {
  try {
    const backup = await Backup.findById(req.params.id);
    if (!backup) return res.status(404).json({ message: '❌ النسخة غير موجودة' });

    await Video.deleteMany({});
    await Video.insertMany(backup.data);

    res.json({ message: '♻️ تم الاسترجاع بنجاح' });
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في الاسترجاع', error: err.message });
  }
});

// ✅ تحميل الرابط كمحتوى (لصفحة proxy)
app.get('/api/proxy/:id', async (req, res) => {
  try {
    const link = await Link.findById(req.params.id);
    if (!link) return res.status(404).json({ error: 'الرابط غير موجود' });

    res.json({ link: link.link });
  } catch (err) {
    res.status(500).json({ error: 'فشل في جلب الرابط' });
  }
});

// ✅ إعادة توجيه حسب ID أو URL
app.get('/api/redirect/:value', async (req, res) => {
  const { value } = req.params;

  try {
    let url;

    // إذا القيمة تشبه ObjectId من MongoDB
    if (/^[0-9a-fA-F]{24}$/.test(value)) {
      const linkDoc = await Link.findById(value);
      if (!linkDoc) return res.status(404).send('❌ الرابط غير موجود');
      url = linkDoc.link;
    } else {
      // إذا أرسلت URL مباشرة
      url = decodeURIComponent(value);
    }

    return res.redirect(url);
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ خطأ في إعادة التوجيه');
  }
});

// ▶️ تشغيل الخادم
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على: http://localhost:${PORT}`);
});
