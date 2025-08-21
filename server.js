// server.js
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const axios = require('axios'); // ✅ لإرسال الطلب لـ Render API
const cors = require('cors');   // ✅ استدعاء مكتبة CORS
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ تفعيل CORS للسماح بالطلبات القادمة من GitHub Pages
app.use(cors({
  origin: "https://laithobidat85.github.io", // رابط GitHub Pages عندك
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

const backupSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  videos: Array,
  links: Array
});
const Backup = mongoose.model('Backup', backupSchema);

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});
const Department = mongoose.model('Department', departmentSchema);

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
  password: { type: String, required: true }
});
const Password = mongoose.model('Password', passwordSchema);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'secret123', // استبدله بـ قيمة من env لاحقًا
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 10 * 60 * 1000 }
}));

// ✅ التحقق من كلمة المرور وتفعيل الجلسة
app.post('/api/verify-password', (req, res) => {
  const { password } = req.body;
  if (password === process.env.DASHBOARD_PASSWORD) {
    req.session.dashboardAuth = true;
    return res.json({ success: true });
  } else {
    return res.status(403).json({ success: false });
  }
});

// ✅ تحقق من حالة الجلسة
app.get('/api/check-session', (req, res) => {
  if (req.session && req.session.dashboardAuth) {
    return res.json({ authenticated: true });
  } else {
    return res.json({ authenticated: false });
  }
});

// ✅ تسجيل الخروج
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: "خطأ في تسجيل الخروج" });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  });
});

// ✅ حماية الصفحات
function requireDashboardAuth(page) {
  return (req, res) => {
    if (req.session && req.session.dashboardAuth) {
      return res.sendFile(path.join(__dirname, 'public', page));
    } else {
      return res.sendFile(path.join(__dirname, 'public', page));
    }
  };
}

app.get('/dashboard.html', requireDashboardAuth('dashboard.html'));
app.get('/edit.html', requireDashboardAuth('edit.html'));
app.get('/links.html', requireDashboardAuth('links.html'));
app.get('/backups.html', requireDashboardAuth('backups.html'));
app.get('/add.html', requireDashboardAuth('add.html'));

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

// ✅ التحقق من كلمة مرور قسم
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
    const updated = await Department.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name },
      { new: true }
    );
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
    for (let i = 0; i < links.length; i++) {
      links[i].order = i;
      await links[i].save();
    }

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
      await link.save();
      await prev.save();
    } else if (direction === 'down' && index < links.length - 1) {
      const next = links[index + 1];
      [link.order, next.order] = [next.order, link.order];
      await link.save();
      await next.save();
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

    const backup = new Backup({ videos, links });
    await backup.save();

    res.json({ message: '✅ تم إنشاء النسخة الاحتياطية (فيديوهات + روابط)' });
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

    await Video.deleteMany({});
    if (backup.videos && backup.videos.length > 0) {
      await Video.insertMany(backup.videos);
    }

    await Link.deleteMany({});
    if (backup.links && backup.links.length > 0) {
      await Link.insertMany(backup.links);
    }

    res.json({ message: '♻️ تم الاسترجاع بنجاح (فيديوهات + روابط)' });
  } catch (err) {
    res.status(500).json({ message: '❌ فشل في الاسترجاع', error: err.message });
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

// ✅ ✅ ✅ تحديث كلمة المرور (PATCH لمتغير واحد فقط)
// ✅ تحديث كلمة المرور
app.post('/api/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (currentPassword !== process.env.DASHBOARD_PASSWORD) {
    return res.status(403).json({ success: false, message: '❌ كلمة المرور الحالية غير صحيحة' });
  }

  try {
    const serviceId = process.env.RENDER_SERVICE_ID;
    const apiKey = process.env.RENDER_API_KEY;

    await axios.patch(
      `https://api.render.com/v1/services/${serviceId}/env-vars`,
      [
        { key: "DASHBOARD_PASSWORD", value: newPassword }
      ],
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({ success: true, message: "✅ تم تحديث كلمة المرور فقط، وسيُعاد تشغيل الخادم" });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "❌ خطأ أثناء تحديث كلمة المرور",
      error: err.message
    });
  }
});

// ▶️ تشغيل الخادم
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على: http://localhost:${PORT}`);
});
