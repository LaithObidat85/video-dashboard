// server.js
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const archiver = require('archiver');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// الاتصال بقاعدة MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// نموذج بيانات الفيديو
const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  department: { type: String, required: true },
  description: String,
  dateAdded: { type: Date, default: Date.now }
});
const Video = mongoose.model('Video', videoSchema);

const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/backups', express.static(BACKUP_DIR));

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
    const { id } = req.params;
    const updated = await Video.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'الفيديو غير موجود' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'خطأ في التعديل', error: err.message });
  }
});

app.delete('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Video.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'الفيديو غير موجود' });
    res.json({ message: '✅ تم حذف الفيديو' });
  } catch (err) {
    res.status(400).json({ message: 'خطأ في الحذف', error: err.message });
  }
});

function createBackup() {
  Video.find().then(videos => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(videos, null, 2), 'utf8');
  });
}

app.post('/api/backups/create', (req, res) => {
  try {
    createBackup();
    res.json({ message: '✅ تم إنشاء النسخة الاحتياطية بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'فشل في إنشاء النسخة الاحتياطية' });
  }
});

app.get('/api/backups', (req, res) => {
  fs.readdir(BACKUP_DIR, (err, files) => {
    if (err) return res.status(500).json({ message: 'فشل في قراءة النسخ الاحتياطية' });
    const backups = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const fullPath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(fullPath);
        return {
          name: file,
          path: `/backups/${file}`,
          size: stats.size
        };
      });
    res.json(backups);
  });
});

app.delete('/api/backups/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(BACKUP_DIR, filename);
  if (!filePath.startsWith(BACKUP_DIR)) {
    return res.status(400).json({ message: 'مسار غير آمن' });
  }
  fs.unlink(filePath, (err) => {
    if (err) return res.status(500).json({ message: 'فشل في الحذف' });
    res.json({ message: '🗑️ تم حذف النسخة الاحتياطية بنجاح' });
  });
});

app.get('/api/backups/zip', (req, res) => {
  let files = req.query.files;
  if (!files) return res.status(400).json({ message: '❌ لم يتم تحديد ملفات' });
  if (typeof files === 'string') {
    try {
      files = JSON.parse(files);
    } catch {
      return res.status(400).json({ message: '❌ تنسيق الملفات غير صالح' });
    }
  }
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ message: '❌ يرجى تحديد الملفات' });
  }

  res.setHeader('Content-Disposition', 'attachment; filename="backups.zip"');
  res.setHeader('Content-Type', 'application/zip');
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  files.forEach(filename => {
    const filePath = path.join(BACKUP_DIR, filename);
    if (fs.existsSync(filePath)) archive.file(filePath, { name: filename });
  });
  archive.finalize();
});

app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على: http://localhost:${PORT}`);
});
