// seed_admin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/userSchema');

(async () => {
  try {
    // اجعل السكربت يعمل فقط عندما يكون RUN_SEED=1
    if (process.env.RUN_SEED !== '1') {
      console.log('RUN_SEED != 1 → تخطي إنشاء الأدمن.');
      process.exit(0);
    }

    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
      console.error('❌ لم يتم تحديد MONGO_URI في متغيرات البيئة.');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ متصل بقاعدة البيانات');

    const username = 'b01578';
    const email = 'laith.obaidat@iu.edu.jo';

    // لو موجود مسبقًا لا نكرره
    const exists = await User.findOne({ $or: [{ username }, { email }] }).lean();
    if (exists) {
      console.log('ℹ️ المستخدم الأدمن موجود مسبقًا. لا حاجة للإنشاء.');
      await mongoose.disconnect();
      process.exit(0);
    }

    const hashed = await bcrypt.hash('200510601', 10);

    const admin = await User.create({
      name: 'ليث حسن محمد عبيدات',
      username,                          // تسجيل الدخول سيكون بالـ username
      email,
      password: hashed,                  // مشفر
      role: 'admin',
      isActive: true,
    });

    console.log('🎉 تم إنشاء الأدمن بنجاح:', {
      id: admin._id.toString(),
      username: admin.username,
      email: admin.email,
      role: admin.role,
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ خطأ أثناء إنشاء الأدمن:', err.message);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
})();
