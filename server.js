// server.js

/***************************************************
 * إضافات نظام المستخدمين الخاص باللجان (لا تؤثر على نظام الفيديو)
 ****************************************************/
const bcrypt = require('bcryptjs');                       // لتشفير/مقارنة كلمات المرور
const User = require('./models/userSchema');              // نموذج المستخدمين (admin/user) للّجان

/****************************************************
 * الاعتمادات الأساسية
 ****************************************************/
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

/****************************************************
 * CORS: اسمح للفرونت-إند على GitHub بالوصول
 * (لا تغيير على الإعداد السابق)
 ****************************************************/
app.use(cors({
  origin: "https://laithobidat85.github.io",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

/****************************************************
 * الاتصال بقاعدة البيانات عبر متغير البيئة MONGO_URI
 * (أنت الآن تضبطه ليشير إلى video-dashboard حسب رغبتك)
 ****************************************************/
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => console.error('❌ MongoDB connection error:', err));

/****************************************************
 * مخططات نظام الفيديوهات (بدون أي تعديل وظيفي)
 ****************************************************/
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

/****************************************************
 * قاموس أسماء اللجان (للّجان) - كما هو
 ****************************************************/
const committeeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});
const Committee = mongoose.model('Committee', committeeSchema);

/****************************************************
 * النسخ الاحتياطية لنظام الفيديوهات (كما هي)
 ****************************************************/
const backupSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  videos: Array,
  links: Array,
  passwords: Array,
  colleges: Array,
  departments: Array
});
const Backup = mongoose.model('Backup', backupSchema);

/****************************************************
 * إعدادات عامة
 ****************************************************/
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

/****************************************************
 * جلسات (Sessions)
 * - تُستخدم سابقًا لكلمات مرور الأقسام في نظام الفيديو
 * - سنستخدم نفس الجلسة أيضًا لمستخدمين نظام اللجان
 ****************************************************/
app.use(session({
  secret: 'secret123',               // يُفضّل وضعه في ENV
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60 * 60 * 1000 } // 60 دقيقة
}));

/****************************************************
 * نماذج نظام اللجان (كما لديك)
 ****************************************************/
const Evaluation = require('./models/evaluationSchema');
const College = require('./models/collegeSchema');
const Auditor = require('./models/auditorSchema');

/****************************************************
 * نموذج إعدادات عرض تقييمات اللجان (كما لديك)
 ****************************************************/
const settingsSchema = new mongoose.Schema({
  visibleColumns: [String],
  selectedVisits: [String],
  updatedAt: { type: Date, default: Date.now }
});
const Settings = mongoose.model('Settings', settingsSchema);

/****************************************************
 * نموذج سجلات التدقيق (Audit Log) لعمليات اللجان
 * - لا يغير أي مخطط آخر، فقط يسجل من فعل ماذا ومتى
 ****************************************************/
const auditLogSchema = new mongoose.Schema({
  model:    { type: String, required: true },                  // مثل: Evaluation/College/Auditor/Committee/Settings/User
  action:   { type: String, required: true },                  // create/update/delete
  docId:    { type: String },                                  // معرف المستند المتأثر
  user:     {                                                  // بصمة المستخدم من الجلسة
    id:    String,
    name:  String,
    email: String,
    username: String,                                          // جديد 2 (2025-09-19): تخزين اسم المستخدم
    role:  String
  },
  payload:  { type: Object },                                  // بيانات مُرسلة/معدّلة/قبل الحذف
  createdAt:{ type: Date, default: Date.now }
});
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

/****************************************************
 * Multer لرفع الملفات (كما لديك)
 ****************************************************/
const upload = multer({ dest: 'uploads/' });

/****************************************************
 * أدوات/دوال مساعدة للمصادقة والصلاحيات (للّجان فقط)
 ****************************************************/

// جلب المستخدم الحالي من الجلسة إن وجد
function currentUser(req) {
  return req.session && req.session.user ? req.session.user : null;
}

// التحقق من تسجيل الدخول (للّجان)
function authRequired(req, res, next) {
  const user = currentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'غير مصرح: يجب تسجيل الدخول' });
  }
  next();
}

// التحقق من الدور (للّجان)
function requireRole(...roles) {
  return (req, res, next) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ message: 'غير مصرح: يجب تسجيل الدخول' });
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: 'غير مصرح: صلاحيات غير كافية' });
    }
    next();
  };
}

// تسجيل حدث في سجلات التدقيق (للّجان)
async function logAudit(req, { model, action, docId, payload }) {
  try {
    const u = currentUser(req);
    await AuditLog.create({
      model,
      action,
      docId: docId ? String(docId) : undefined,
      user: u ? { id: u.id, name: u.name, email: u.email, username: u.username, role: u.role } : undefined, // جديد 2 (2025-09-19)
      payload
    });
  } catch (e) {
    // عدم إيقاف الطلب لو فشل تسجيل السجل
    console.error('AuditLog error:', e.message);
  }
}

/****************************************************
 * نظام كلمات مرور الأقسام (خاص بنظام الفيديو) - كما هو
 ****************************************************/
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

app.get('/api/check-session/:section', (req, res) => {
  const { section } = req.params;
  if (req.session && req.session[`${section}Auth`]) {
    return res.json({ authenticated: true });
  } else {
    return res.json({ authenticated: false });
  }
});

app.post('/api/logout/:section', (req, res) => {
  const { section } = req.params;
  if (req.session) req.session[`${section}Auth`] = false;
  return res.json({ success: true });
});

/****************************************************
 * حماية صفحات ثابتة بنظام كلمات المرور (خاصة بالفيديو) - كما هي
 ****************************************************/
function requireSectionAuth(section, page) {
  return (req, res) => {
    if (req.session && req.session[`${section}Auth`]) {
      return res.sendFile(path.join(__dirname, 'public', page));
    } else {
      return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  };
}
app.get('/dashboard.html',  requireSectionAuth('dashboard',  'dashboard.html'));
app.get('/edit.html',       requireSectionAuth('edit',       'edit.html'));
app.get('/links.html',      requireSectionAuth('links',      'links.html'));
app.get('/backups.html',    requireSectionAuth('backups',    'backups.html'));
app.get('/add.html',        requireSectionAuth('add',        'add.html'));
app.get('/passwords.html',  requireSectionAuth('passwords',  'passwords.html'));
// صفحة إدارة أسماء اللجان القديمة عبر نفس آلية الصفحات المحمية (تبقى كما هي)
app.get('/committees-manage.html', requireSectionAuth('dashboard', 'committees-names-manage.html'));
app.get('/index.html',      requireSectionAuth('index',      'index.html'));

/****************************************************
 * CRUD كلمات المرور (نظام الفيديو) - كما هي
 ****************************************************/
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

/****************************************************
 * الأقسام (خاص بالفيديو) - كما هي
 ****************************************************/
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

/****************************************************
 * الفيديوهات (نظام الفيديو) - كما هي
 ****************************************************/
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

/****************************************************
 * الروابط (نظام الفيديو) - كما هي
 ****************************************************/
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

/****************************************************
 * النسخ الاحتياطية (خاص بالفيديو) - كما هي + رفع ملف
 ****************************************************/
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
    await Link.deleteMany({});  if (backup.links?.length)  await Link.insertMany(backup.links);
    await Password.deleteMany({}); if (backup.passwords?.length) await Password.insertMany(backup.passwords);
    await Department.deleteMany({}); if (backup.departments?.length) await Department.insertMany(backup.departments);
    res.json({ message: '♻️ تم الاسترجاع بنجاح (فيديوهات + روابط + كلمات مرور + أقسام)' });
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في الاسترجاع', error: err.message });
  }
});

// جديد 2 (2025-09-19): رفع ملف نسخة احتياطية وحفظه بالقاعدة
app.post('/api/backups/upload', upload.single('backupFile'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(rawData);
    const backup = new Backup({
      videos: jsonData.videos || [],
      links: jsonData.links || [],
      passwords: jsonData.passwords || [],
      colleges: jsonData.colleges || [],
      departments: jsonData.departments || []
    });
    await backup.save();
    fs.unlinkSync(filePath);
    res.json({ message: '✅ تم رفع النسخة وحفظها في قاعدة البيانات' });
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في رفع النسخة', error: err.message });
  }
});

/****************************************************
 * أسماء اللجان (Autocomplete) - للّجان - عامة (GET فقط)
 ****************************************************/
app.get('/api/committee-names', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    let filter = {};
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: new RegExp(safe, 'i') };
    }
    const items = await Committee.find(filter).sort({ name: 1 }).limit(50).select('name');
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/****************************************************
 * مصادقة خاصة بنظام اللجان فقط (لا تؤثر على نظام الفيديو)
 ****************************************************/

// جديد 2 (2025-09-19): تهيئة أول مدير يدعم username
app.post('/auth/committees/init-admin', async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) return res.status(403).json({ message: 'تمت التهيئة مسبقًا' });
    const { name, username, email, password } = req.body;
    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: 'الاسم واسم المستخدم والبريد وكلمة المرور مطلوبة' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hash,
      role: 'admin',
      isActive: true
    });
    res.status(201).json({
      message: '✅ تم إنشاء المدير الأول',
      user: { id: user._id, name: user.name, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: '❌ فشل تهيئة المدير', error: err.message });
  }
});

// جديد 2 (2025-09-19): تسجيل الدخول باسم المستخدم أو الإيميل
app.post('/auth/committees/login', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if ((!username && !email) || !password) {
      return res.status(400).json({ message: 'اسم المستخدم/البريد وكلمة المرور مطلوبة' });
    }

    const query = username
      ? { username: (username || '').trim(), isActive: true }
      : { email: (email || '').toLowerCase().trim(), isActive: true };

    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });

    // جديد 2 (2025-09-19): نخزن username أيضًا في الجلسة
    req.session.user = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      username: user.username || (user.email ? user.email.split('@')[0] : undefined),
      role: user.role
    };

    res.json({ message: '✅ تم تسجيل الدخول', user: req.session.user });
  } catch (err) {
    res.status(500).json({ message: '❌ خطأ في تسجيل الدخول', error: err.message });
  }
});

// جديد 2 (2025-09-19): إنشاء مستخدم مع تسجيل في AuditLog
app.post('/auth/committees/register', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body || {};
    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: 'الاسم واسم المستخدم والبريد وكلمة المرور مطلوبة' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hash,
      role: role === 'admin' ? 'admin' : 'user',
      isActive: true
    });

    await logAudit(req, {
      model: 'User',
      action: 'create',
      docId: user._id,
      payload: { name: user.name, username: user.username, email: user.email, role: user.role }
    });

    res.status(201).json({
      message: '✅ تم إنشاء المستخدم',
      user: { id: user._id, name: user.name, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'اسم المستخدم أو البريد مستخدم مسبقًا' });
    }
    res.status(500).json({ message: '❌ فشل إنشاء المستخدم', error: err.message });
  }
});

// جديد 2 (2025-09-19): قائمة المستخدمين (admin فقط) لصفحة users-manage.html
app.get('/api/users', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find({}, 'name username email role isActive createdAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: '❌ خطأ في جلب المستخدمين', error: err.message });
  }
});

// جديد 2 (2025-09-19): تعديل بيانات مستخدم (admin فقط) مع before/after
app.put('/api/users/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { name, username, role, isActive } = req.body || {};
    const update = {};
    if (typeof name === 'string') update.name = name.trim();
    if (typeof username === 'string') update.username = username.trim();
    if (role === 'admin' || role === 'user') update.role = role;
    if (typeof isActive === 'boolean') update.isActive = isActive;

    const before = await User.findById(req.params.id);
    if (!before) return res.status(404).json({ message: '❌ المستخدم غير موجود' });

    const updated = await User.findByIdAndUpdate(req.params.id, update, { new: true });
    await logAudit(req, {
      model: 'User',
      action: 'update',
      docId: req.params.id,
      payload: {
        before: { name: before.name, username: before.username, role: before.role, isActive: before.isActive },
        after:  { name: updated.name, username: updated.username, role: updated.role, isActive: updated.isActive }
      }
    });

    res.json({ message: '✅ تم التعديل', user: { id: updated._id, name: updated.name, username: updated.username, role: updated.role, isActive: updated.isActive } });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'اسم المستخدم مستخدم مسبقًا' });
    }
    res.status(500).json({ message: '❌ خطأ في تعديل المستخدم', error: err.message });
  }
});

// جديد 2 (2025-09-19): تغيير كلمة مرور مستخدم (admin فقط)
app.put('/api/users/:id/password', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { newPassword } = req.body || {};
    if (!newPassword) return res.status(400).json({ message: 'كلمة المرور الجديدة مطلوبة' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: '❌ المستخدم غير موجود' });

    const hash = await bcrypt.hash(newPassword, 10);
    user.password = hash;
    await user.save();

    await logAudit(req, { model: 'User', action: 'update', docId: user._id, payload: { passwordChanged: true } });

    res.json({ message: '✅ تم تغيير كلمة المرور' });
  } catch (err) {
    res.status(500).json({ message: '❌ خطأ في تغيير كلمة المرور', error: err.message });
  }
});

// جديد 2 (2025-09-19): حذف مستخدم (admin فقط) مع snapshot قبل الحذف
app.delete('/api/users/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const before = await User.findById(req.params.id);
    if (!before) return res.status(404).json({ message: '❌ المستخدم غير موجود' });

    await User.findByIdAndDelete(req.params.id);
    await logAudit(req, {
      model: 'User',
      action: 'delete',
      docId: req.params.id,
      payload: { name: before.name, username: before.username, email: before.email, role: before.role }
    });

    res.json({ message: '🗑️ تم حذف المستخدم' });
  } catch (err) {
    res.status(500).json({ message: '❌ خطأ في حذف المستخدم', error: err.message });
  }
});

// الخروج من نظام اللجان
app.post('/auth/committees/logout', (req, res) => {
  if (req.session) {
    delete req.session.user;
  }
  res.json({ message: '✅ تم تسجيل الخروج' });
});

// معرفة المستخدم الحالي (لنظام اللجان)
app.get('/auth/committees/me', (req, res) => {
  const user = currentUser(req);
  res.json({ authenticated: !!user, user: user || null });
});

/****************************************************
 * تقييمات اللجان (قراءة عامة / كتابة محمية)
 ****************************************************/

// إضافة تقييم لجنة: يحتاج user أو admin + تسجيل تدقيق
app.post('/api/committees', authRequired, async (req, res) => {
  try {
    // يحفظ اسم اللجنة في قاموس اللجان إن لم يكن موجودًا (كما لديك)
    await Committee.updateOne(
      { name: req.body.committee_name },
      { $setOnInsert: { name: req.body.committee_name } },
      { upsert: true }
    );

    const evaluation = new Evaluation(req.body);
    await evaluation.save();

    // سجل تدقيق إنشاء
    await logAudit(req, { model: 'Evaluation', action: 'create', docId: evaluation._id, payload: req.body });

    res.status(201).json({ message: '✅ تم حفظ التقييم بنجاح', evaluation });
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في حفظ التقييم', error: err.message });
  }
});

// عرض التقييمات: عام للجميع (كما طلبت)
app.get('/api/committees', async (req, res) => {
  try {
    const { college, auditor_name } = req.query;
    let query = {};
    if (college) query.college = college;
    if (auditor_name) query.auditor_name = auditor_name;
    const evaluations = await Evaluation.find(query).sort({ createdAt: -1 });
    res.json(evaluations);
  } catch (err) {
    res.status(500).json({ message: '❌ خطأ في جلب التقييمات', error: err.message });
  }
});

// جديد 2 (2025-09-19): update مع before/after
app.put('/api/committees/:id', authRequired, async (req, res) => {
  try {
    const before = await Evaluation.findById(req.params.id).lean();
    const updated = await Evaluation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: '❌ التقييم غير موجود' });

    await logAudit(req, { model: 'Evaluation', action: 'update', docId: req.params.id, payload: { before, after: updated.toObject() } });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في تعديل التقييم', error: err.message });
  }
});

// حذف تقييم: admin فقط + تسجيل Snapshot قبل الحذف
app.delete('/api/committees/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const before = await Evaluation.findById(req.params.id);
    const deleted = await Evaluation.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: '❌ التقييم غير موجود' });

    await logAudit(req, { model: 'Evaluation', action: 'delete', docId: req.params.id, payload: before ? before.toObject() : null });

    res.json({ message: '🗑️ تم حذف التقييم' });
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في الحذف', error: err.message });
  }
});

/****************************************************
 * الكليات (للّجان) - قراءة عامة / كتابة admin فقط
 ****************************************************/
app.get('/api/colleges', async (req, res) => {
  try {
    const colleges = await College.find().sort({ name: 1 });
    res.json(colleges);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/colleges', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const college = new College({ name: req.body.name });
    await college.save();

    await logAudit(req, { model: 'College', action: 'create', docId: college._id, payload: req.body });

    res.status(201).json(college);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// جديد 2 (2025-09-19): update مع before/after
app.put('/api/colleges/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const before = await College.findById(req.params.id).lean();
    const updated = await College.findByIdAndUpdate(req.params.id, { name: req.body.name }, { new: true });
    if (!updated) return res.status(404).json({ message: '❌ الكلية غير موجودة' });

    await logAudit(req, { model: 'College', action: 'update', docId: req.params.id, payload: { before, after: updated.toObject() } });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.delete('/api/colleges/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const before = await College.findById(req.params.id);
    const deleted = await College.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: '❌ الكلية غير موجودة' });

    await logAudit(req, { model: 'College', action: 'delete', docId: req.params.id, payload: before ? before.toObject() : null });

    res.json({ message: '🗑️ تم حذف الكلية' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/****************************************************
 * قاموس أسماء اللجان (للّجان) - قراءة عامة / كتابة admin فقط
 ****************************************************/
app.get('/api/committees-master', async (req, res) => {
  try {
    const items = await Committee.find().sort({ name: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/committees-master', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const item = new Committee({ name: req.body.name });
    await item.save();

    await logAudit(req, { model: 'Committee', action: 'create', docId: item._id, payload: req.body });

    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// جديد 2 (2025-09-19): update مع before/after
app.put('/api/committees-master/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const before = await Committee.findById(req.params.id).lean();
    const updated = await Committee.findByIdAndUpdate(req.params.id, { name: req.body.name }, { new: true });
    if (!updated) return res.status(404).json({ message: '❌ اللجنة غير موجودة' });

    await logAudit(req, { model: 'Committee', action: 'update', docId: req.params.id, payload: { before, after: updated.toObject() } });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.delete('/api/committees-master/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const before = await Committee.findById(req.params.id);
    const deleted = await Committee.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: '❌ اللجنة غير موجودة' });

    await logAudit(req, { model: 'Committee', action: 'delete', docId: req.params.id, payload: before ? before.toObject() : null });

    res.json({ message: '🗑️ تم حذف اللجنة' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/****************************************************
 * المدققون (للّجان) - قراءة عامة / كتابة admin فقط
 ****************************************************/
app.get('/api/auditors', async (req, res) => {
  try {
    const auditors = await Auditor.find().sort({ name: 1 });
    res.json(auditors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/auditors', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const auditor = new Auditor({ name: req.body.name });
    await auditor.save();

    await logAudit(req, { model: 'Auditor', action: 'create', docId: auditor._id, payload: req.body });

    res.status(201).json(auditor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// جديد 2 (2025-09-19): update مع before/after
app.put('/api/auditors/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const before = await Auditor.findById(req.params.id).lean();
    const updated = await Auditor.findByIdAndUpdate(req.params.id, { name: req.body.name }, { new: true });
    if (!updated) return res.status(404).json({ message: '❌ المدقق غير موجود' });

    await logAudit(req, { model: 'Auditor', action: 'update', docId: req.params.id, payload: { before, after: updated.toObject() } });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.delete('/api/auditors/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const before = await Auditor.findById(req.params.id);
    const deleted = await Auditor.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: '❌ المدقق غير موجود' });

    await logAudit(req, { model: 'Auditor', action: 'delete', docId: req.params.id, payload: before ? before.toObject() : null });

    res.json({ message: '🗑️ تم حذف المدقق' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/****************************************************
 * إعدادات عرض اللجان: قراءة عامة / تعديل admin فقط
 ****************************************************/
app.get('/api/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({ visibleColumns: [], selectedVisits: [] });
      await settings.save();
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: '❌ خطأ في جلب الإعدادات', error: err.message });
  }
});
// جديد 2 (2025-09-19): update مع before/after
app.put('/api/settings', authRequired, requireRole('admin'), async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(req.body);
      await settings.save();
      await logAudit(req, { model: 'Settings', action: 'update', docId: settings._id, payload: { before: null, after: settings.toObject() } });
      return res.json(settings);
    }
    const before = settings.toObject();
    settings.visibleColumns = req.body.visibleColumns || [];
    settings.selectedVisits = req.body.selectedVisits || [];
    settings.updatedAt = new Date();
    await settings.save();

    await logAudit(req, { model: 'Settings', action: 'update', docId: settings._id, payload: { before, after: settings.toObject() } });

    res.json(settings);
  } catch (err) {
    res.status(400).json({ message: '❌ خطأ في حفظ الإعدادات', error: err.message });
  }
});

/****************************************************
 * سرد سجلات التدقيق (admin فقط) مع فلاتر وباجنة + حذف كل السجلات
 ****************************************************/
app.get('/api/audit-logs', authRequired, requireRole('admin'), async (req, res) => {
  try {
    let { model, action, q, from, to, page = 1, limit = 20 } = req.query;
    page = Math.max(1, parseInt(page, 10) || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const filter = {};
    if (model)  filter.model  = model;
    if (action) filter.action = action;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from + 'T00:00:00Z');
      if (to)   filter.createdAt.$lte = new Date(to   + 'T23:59:59Z');
    }

    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      filter.$or = [
        { 'user.name': rx },
        { 'user.email': rx },
        { 'user.username': rx } // جديد 2 (2025-09-19): البحث باسم المستخدم أيضًا
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter)
    ]);

    const hasMore = skip + items.length < total;
    res.json({ items, hasMore, total });
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في جلب السجلات', error: err.message });
  }
});

// جديد 2 (2025-09-19): حذف جميع سجلات التدقيق (admin فقط)
app.delete('/api/audit-logs', authRequired, requireRole('admin'), async (req, res) => {
  try {
    await AuditLog.deleteMany({});
    res.json({ message: '🧹 تم حذف جميع السجلات' });
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في حذف السجلات', error: err.message });
  }
});

/****************************************************
 * نظام المصادقة القديم للفيديو — فصل الجلسة عن نظام اللجان
 ****************************************************/
app.get('/api/redirect/:id', async (req, res) => {
  try {
    const link = await Link.findById(req.params.id);
    if (!link) return res.status(404).send('❌ الرابط غير موجود');
    res.redirect(link.link);
  } catch (err) {
    res.status(500).send('❌ خطأ في إعادة التوجيه');
  }
});

app.get('/auth/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
// جديد 2 (2025-09-19): استخدام videoUser بدل user حتى لا تؤثر على جلسة اللجان
app.post('/auth/login', (req, res) => {
  const { email, password, id } = req.body;
  if (email && email.endsWith('@iu.edu.jo')) { // جديد 2: تصحيح رسالة النطاق
    req.session.videoUser = { email }; // كان سابقًا user
    return res.redirect(`/protected?id=${id}`);
  } else {
    return res.send('❌ يجب إدخال بريد ينتهي بـ @iu.edu.jo'); // جديد 2: تصحيح نص الرسالة
  }
});
app.get('/auth/logout', (req, res) => {
  // لا ندمّر الجلسة كلها حتى لا نلغي جلسة اللجان
  if (req.session) delete req.session.videoUser;
  res.redirect('/viewlinks.html');
});
app.get('/protected', async (req, res) => {
  if (!req.session.videoUser) return res.redirect('/auth/login'); // كان سابقًا user
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

/****************************************************
 * تشغيل الخادم
 ****************************************************/
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على: http://localhost:${PORT}`);
});
