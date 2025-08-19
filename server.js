// server.js
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// الاتصال بـ MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ====== نماذج البيانات ======
const linkSchema = new mongoose.Schema({
  linkText: String,
  link: String,
  description: String,
  requiresPassword: { type: Boolean, default: false },
  dateAdded: { type: Date, default: Date.now }
});
const Link = mongoose.model('Link', linkSchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'secret123', resave: false, saveUninitialized: true }));

// ✅ صفحة تسجيل الدخول البسيطة
app.get('/auth/login', (req, res) => {
  res.send(`
    <form method="POST" action="/auth/login" style="text-align:center; margin-top:50px;">
      <h3>تسجيل الدخول</h3>
      <input type="email" name="email" placeholder="اكتب بريدك الجامعي" required><br><br>
      <input type="password" name="password" placeholder="كلمة المرور"><br><br>
      <button type="submit">دخول</button>
    </form>
  `);
});

app.post('/auth/login', (req, res) => {
  const { email } = req.body;
  if (email && email.endsWith('@iu.edu.jo')) {
    req.session.user = { email };
    res.redirect('/viewlinks.html');
  } else {
    res.send('❌ يجب إدخال بريد جامعي ينتهي بـ @iu.edu.jo');
  }
});

// ✅ API: جلب الروابط
app.get('/api/links', async (req, res) => {
  const links = await Link.find().sort({ dateAdded: -1 });
  res.json(links);
});

// ✅ API: إعادة التوجيه للرابط (مع التحقق لو محمي)
app.get('/api/redirect/:id', async (req, res) => {
  const link = await Link.findById(req.params.id);
  if (!link) return res.status(404).send('الرابط غير موجود');

  if (link.requiresPassword) {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }
  }
  res.redirect(link.link);
});

// ====== تشغيل السيرفر ======
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
