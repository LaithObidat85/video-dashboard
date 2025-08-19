const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
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
const linkSchema = new mongoose.Schema({
  linkText: { type: String, required: true },
  link: { type: String, required: true },
  description: String,
  requiresPassword: { type: Boolean, default: false },
  dateAdded: { type: Date, default: Date.now }
});
const Link = mongoose.model('Link', linkSchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'secret123',
  resave: false,
  saveUninitialized: true
}));

// ====== صفحة تسجيل الدخول ======
app.get('/auth/login', (req, res) => {
  const linkId = req.query.id || '';
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ====== معالجة تسجيل الدخول ======
app.post('/auth/login', (req, res) => {
  const { email, password, id } = req.body;
  if (email && email.endsWith('@iu.edu.jo')) {
    req.session.user = { email };
    return res.redirect(`/protected?id=${id}`);
  } else {
    return res.send('❌ يجب إدخال بريد ينتهي بـ @iu.edu.jo');
  }
});

// ====== تسجيل الخروج ======
app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/viewlinks.html');
  });
});

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

// ====== صفحة الروابط المحمية داخل iframe ======
app.get('/protected', async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');

  const linkId = req.query.id;
  if (!linkId) {
    return res.redirect('/auth/login');
  }

  try {
    const link = await Link.findById(linkId);
    if (!link) return res.send('❌ الرابط غير موجود');

    res.send(`
      <iframe src="${link.link}" style="width:100%;height:100vh;border:none;"></iframe>
    `);
  } catch (err) {
    console.error('❌ Error in /protected:', err.message);
    res.redirect('/auth/login');
  }
});

// ====== API: جلب الأقسام من قاعدة البيانات ======
app.get('/api/departments', async (req, res) => {
  try {
    const Department = mongoose.model('Department', new mongoose.Schema({
      name: { type: String, required: true }
    }), 'departments'); // اسم الـ Collection = departments

    const departments = await Department.find().sort({ name: 1 });
    res.json(departments);
  } catch (err) {
    console.error('❌ Error fetching departments:', err);
    res.status(500).json({ error: 'خطأ في جلب الأقسام' });
  }
});

// ============================================================================================== Laith ======================

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



// ====== تشغيل السيرفر ======
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
