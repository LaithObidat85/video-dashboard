// server.js
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer'); // ✅ لإدارة رفع الملفات
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ تفعيل CORS للسماح بالطلبات القادمة من GitHub Pages
app.use(cors({
  origin: "https://laithobidat85.github.io",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// الاتصال بـ MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ====== النماذج (Models) ======
const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  department: { type: String, required: true },
  description: String,
  dateAdded: { type: Date, default: Date.now }
});
const Video = mongoose.model('Video', videoSchema);

const linkSchema = new mongoose.Schema({
  name: { type: String },
  description: String,
  link: { type: String, required: true },
  linkText: { type: String, required: true },
  requiresPassword: { type: Boolean, default: false },
  dateAdded: { type: Date, default: Date.now },
  order: { type: Number, default: 0 }
});
const Link = mongoose.model('Link', linkSchema);

const passwordSchema = new mongoose.Schema({
  section: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Password = mongoose.model('Password', passwordSchema);

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});
const Department = mongoose.model('Department', departmentSchema);

// ✅ النسخ الاحتياطية الآن تشمل (فيديوهات + روابط + كلمات مرور + أقسام + كليات)
const backupSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  videos: Array,
  links: Array,
  passwords: Array,
  colleges: Array,   // ✅ إضافة الكليات
  departments: Array
});
const Backup = mongoose.model('Backup', backupSchema);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'secret123',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 10 * 60 * 1000 }
}));

const Evaluation = require('./models/evaluationSchema');

const College = require('./models/collegeSchema');



// ✅ إعداد multer لحفظ الملفات مؤقتًا
const upload = multer({ dest: 'uploads/' });

// ==================== التحقق من كلمة المرور لكل قسم أو صفحة ====================
app.post("/api/verify-password", async (req, res) => {
  const { section, password } = req.body;
  try {
    const record = await Password.findOne({ section });
    if (record && record.password === password) {
      req.session[`${section}Auth`] = true;
      return res.json({ success: true });
    } else {
      return res.status(403).json({ success: false, message: "❌ كلمة المرور غير صحيحة" });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: "❌ خطأ في التحقق" });
  }
});

// ✅ تحقق من حالة الجلسة
app.get('/api/check-session/:section', (req, res) => {
  const { section } = req.params;
  if (req.session && req.session[`${section}Auth`]) {
    return res.json({ authenticated: true });
  } else {
    return res.json({ authenticated: false });
  }
});

// ✅ تسجيل الخروج
app.post('/api/logout/:section', (req, res) => {
  const { section } = req.params;
  if (req.session) req.session[`${section}Auth`] = false;
  return res.json({ success: true });
});

// ✅ حماية الصفحات
function requireSectionAuth(section, page) {
  return (req, res) => {
    if (req.session && req.session[`${section}Auth`]) {
      return res.sendFile(path.join(__dirname, 'public', page));
    } else {
      return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  };
}
app.get('/dashboard.html', requireSectionAuth('dashboard', 'dashboard.html'));
app.get('/edit.html', requireSectionAuth('edit', 'edit.html'));
app.get('/links.html', requireSectionAuth('links', 'links.html'));
app.get('/backups.html', requireSectionAuth('backups', 'backups.html'));
app.get('/add.html', requireSectionAuth('add', 'add.html'));
app.get('/passwords.html', requireSectionAuth('passwords', 'passwords.html'));
app.get('/index.html', requireSectionAuth('index', 'index.html'));

// ====== إدارة كلمات المرور ======
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

// ✅ التحقق المباشر من كلمة مرور قسم
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
    const updated = await Department.findByIdAndUpdate(req.params.id, { name: req.body.name }, { new: true });
    if (!updated) return res.status(404).json({ message: '❌ القسم غير موجود' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.delete('/api/departments/:id', async (req, res) => {
  try {
    const deleted = await Department.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: '❌ القسم غير موجود' });
    res.json({ message: '🗑️ تم حذف القسم' });
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
    const links = await Link.find().sort({ order: 1 });
    res.json(links);
  } catch (err) {
    res.status(500).json({ message: '❌ خطأ في قراءة الروابط', error: err.message });
  }
});
app.post('/api/links', async (req, res) => {
  try {
    const count = await Link.countDocuments();
    const link = new Link({ ...req.body, order: count });
    await link.save();
    res.status(201).json(link);
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في إضافة الرابط', error: err.message });
  }
});
app.put('/api/links/:id', async (req, res) => {
  try {
    const updated = await Link.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: '❌ الرابط غير موجود' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في التعديل', error: err.message });
  }
});
app.delete('/api/links/:id', async (req, res) => {
  try {
    const deleted = await Link.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: '❌ الرابط غير موجود' });
    const links = await Link.find().sort({ order: 1 });
    for (let i = 0; i < links.length; i++) { links[i].order = i; await links[i].save(); }
    res.json({ message: '✅ تم حذف الرابط' });
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في الحذف', error: err.message });
  }
});
app.post('/api/links/:id/move', async (req, res) => {
  const { direction } = req.body;
  try {
    const link = await Link.findById(req.params.id);
    if (!link) return res.status(404).json({ message: '❌ الرابط غير موجود' });
    const links = await Link.find().sort({ order: 1 });
    const index = links.findIndex(l => l.id === link.id);
    if (direction === 'up' && index > 0) {
      const prev = links[index - 1];
      [link.order, prev.order] = [prev.order, link.order];
      await link.save(); await prev.save();
    } else if (direction === 'down' && index < links.length - 1) {
      const next = links[index + 1];
      [link.order, next.order] = [next.order, link.order];
      await link.save(); await next.save();
    }
    res.json({ message: '✅ تم النقل' });
  } catch (err) {
    res.status(500).json({ message: '❌ خطأ في النقل', error: err.message });
  }
});

// ====== إدارة النسخ الاحتياطية ======
app.post('/api/backups/create', async (req, res) => {
  try {
    const videos = await Video.find();
    const links = await Link.find();
    const passwords = await Password.find();
    const departments = await Department.find();
    const backup = new Backup({ videos, links, passwords, departments });
    await backup.save();
    res.json({ message: '✅ تم إنشاء النسخة الاحتياطية (فيديوهات + روابط + كلمات مرور + أقسام)' });
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في إنشاء النسخة', error: err.message });
  }
});
app.get('/api/backups', async (req, res) => {
  try {
    const backups = await Backup.find().sort({ date: -1 });
    res.json(backups);
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في جلب النسخ', error: err.message });
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
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في التنزيل', error: err.message });
  }
});
app.post('/api/backups/restore/:id', async (req, res) => {
  try {
    const backup = await Backup.findById(req.params.id);
    if (!backup) return res.status(404).json({ message: '❌ النسخة غير موجودة' });
    await Video.deleteMany({}); if (backup.videos?.length) await Video.insertMany(backup.videos);
    await Link.deleteMany({}); if (backup.links?.length) await Link.insertMany(backup.links);
    await Password.deleteMany({}); if (backup.passwords?.length) await Password.insertMany(backup.passwords);
    await Department.deleteMany({}); if (backup.departments?.length) await Department.insertMany(backup.departments);
    res.json({ message: '♻️ تم الاسترجاع بنجاح (فيديوهات + روابط + كلمات مرور + أقسام)' });
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في الاسترجاع', error: err.message });
  }
});

// ====== إدارة تقييمات اللجان ======

// إضافة تقييم لجنة
app.post('/api/committees', async (req, res) => {
  try {
    const evaluation = new Evaluation(req.body);
    await evaluation.save();
    res.status(201).json({ message: '✅ تم حفظ التقييم بنجاح', evaluation });
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في حفظ التقييم', error: err.message });
  }
});

// جلب كل التقييمات (مع إمكانية الفلترة حسب الكلية)
app.get('/api/committees', async (req, res) => {
  try {
    const { college } = req.query;
    let query = {};
    if (college) query.college = college;
    const evaluations = await Evaluation.find(query).sort({ createdAt: -1 });
    res.json(evaluations);
  } catch (err) {
    res.status(500).json({ message: '❌ خطأ في جلب التقييمات', error: err.message });
  }
});

// تعديل تقييم لجنة
app.put('/api/committees/:id', async (req, res) => {
  try {
    const updated = await Evaluation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: '❌ التقييم غير موجود' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في تعديل التقييم', error: err.message });
  }
});

// حذف تقييم لجنة
app.delete('/api/committees/:id', async (req, res) => {
  try {
    const deleted = await Evaluation.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: '❌ التقييم غير موجود' });
    res.json({ message: '🗑️ تم حذف التقييم' });
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في الحذف', error: err.message });
  }
});

// ====== إدارة الكليات ======

// جلب جميع الكليات
app.get('/api/colleges', async (req, res) => {
  try {
    const colleges = await College.find().sort({ name: 1 });
    res.json(colleges);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إضافة كلية جديدة
app.post('/api/colleges', async (req, res) => {
  try {
    const college = new College({ name: req.body.name });
    await college.save();
    res.status(201).json(college);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// تعديل كلية
app.put('/api/colleges/:id', async (req, res) => {
  try {
    const updated = await College.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: '❌ الكلية غير موجودة' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// حذف كلية
app.delete('/api/colleges/:id', async (req, res) => {
  try {
    const deleted = await College.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: '❌ الكلية غير موجودة' });
    res.json({ message: '🗑️ تم حذف الكلية' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});



// ✅ رفع نسخة من الجهاز
app.post('/api/backups/upload', upload.single('backupFile'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(rawData);
    const backup = new Backup({
      videos: jsonData.videos || [],
      links: jsonData.links || [],
      passwords: jsonData.passwords || [],
      colleges: jsonData.colleges || [],   // ✅ إضافة الكليات هنا أيضًا
      departments: jsonData.departments || []
    });
    await backup.save();
    fs.unlinkSync(filePath);
    res.json({ message: '✅ تم رفع النسخة وحفظها في قاعدة البيانات' });
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في رفع النسخة', error: err.message });
  }
});

// ✅ إعادة التوجيه
app.get('/api/redirect/:id', async (req, res) => {
  try {
    const link = await Link.findById(req.params.id);
    if (!link) return res.status(404).send('❌ الرابط غير موجود');
    res.redirect(link.link);
  } catch (err) {
    res.status(500).send('❌ خطأ في إعادة التوجيه');
  }
});

// ====== تسجيل الدخول ======
app.get('/auth/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.post('/auth/login', (req, res) => {
  const { email, password, id } = req.body;
  if (email && email.endsWith('@iu.edu.jo')) {
    req.session.user = { email };
    return res.redirect(`/protected?id=${id}`);
  } else {
    return res.send('❌ يجب إدخال بريد ينتهي بـ @iu.edu.jo');
  }
});
app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/viewlinks.html');
  });
});

// ====== صفحة الروابط المحمية ======
app.get('/protected', async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  const linkId = req.query.id;
  if (!linkId) return res.redirect('/auth/login');
  try {
    const link = await Link.findById(linkId);
    if (!link) return res.send('❌ الرابط غير موجود');
    res.send(`<iframe src="${link.link}" style="width:100%;height:100vh;border:none;"></iframe>`);
  } catch (err) {
    res.redirect('/auth/login');
  }
});

// ▶️ تشغيل الخادم
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على: http://localhost:${PORT}`);
});
