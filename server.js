// server.js
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();

const session = require('express-session');

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
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'secret123', resave: false, saveUninitialized: true }));

// ====== تسجيل الدخول البسيط ======
app.get('/auth/login', (req, res) => {
  res.send(`
    <form method="post" action="/auth/verify" style="max-width:400px;margin:50px auto;font-family:sans-serif;">
      <h3>🔐 تسجيل الدخول</h3>
      <input type="email" name="email" placeholder="البريد الجامعي" required style="width:100%;margin:5px 0;padding:8px;">
      <input type="password" name="password" placeholder="كلمة المرور" style="width:100%;margin:5px 0;padding:8px;">
      <button type="submit" style="width:100%;padding:10px;">دخول</button>
    </form>
  `);
});

app.use(bodyParser.urlencoded({ extended: true }));

app.post('/auth/verify', (req, res) => {
  const { email } = req.body;
  if (email && email.endsWith('@iu.edu.jo')) {
    req.session.user = { email };
    const linkId = req.query.id || '';
    return res.redirect(`/protected?id=${linkId}`);
  }
  return res.send('❌ يجب تسجيل الدخول باستخدام بريد جامعي @iu.edu.jo');
});

// ✅ تسجيل الخروج
app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

// صفحة الروابط المحمية داخل iframe
app.get('/protected', async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  const linkId = req.query.id;
  const link = await Link.findById(linkId);
  if (!link) return res.send('❌ الرابط غير موجود');
  res.send(`
    <iframe src="${link.link}" style="width:100%;height:100vh;border:none;"></iframe>
  `);
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

// ====== API: إعادة التوجيه ======
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
