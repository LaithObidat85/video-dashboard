// server.js
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();

const passport = require('passport');
const OIDCStrategy = require('passport-azure-ad').OIDCStrategy;
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

// ✅ تقديم الملفات من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// ====== تهيئة الجلسات والمصادقة ======
app.use(session({ secret: 'secret123', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// إعداد Azure AD OIDC Strategy باستخدام common endpoint
passport.use(new OIDCStrategy({
    identityMetadata: `https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration`,
    clientID: process.env.CLIENT_ID,
    responseType: 'code',
    responseMode: 'query',
    redirectUrl: 'https://video-dashboard-backend.onrender.com/auth/callback',
    clientSecret: process.env.CLIENT_SECRET,
    allowHttpForRedirectUrl: false,
    validateIssuer: true,
    passReqToCallback: false,
    scope: ['profile', 'email', 'openid']
}, (iss, sub, profile, accessToken, refreshToken, done) => {
    const email = profile._json.preferred_username || '';
    if (!email.endsWith('@iu.edu.jo')) {
        return done(null, false, { message: '❌ يجب أن يكون البريد @iu.edu.jo' });
    }
    return done(null, profile);
}));

// ====== مسارات تسجيل الدخول ======
app.get('/auth/login',
    passport.authenticate('azuread-openidconnect', { failureRedirect: '/' })
);

app.get('/auth/callback',
    passport.authenticate('azuread-openidconnect', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/viewlinks.html');
    }
);

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
