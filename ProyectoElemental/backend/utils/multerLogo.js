const multer = require('multer');
const path = require('path');
const fs = require('fs');

const destino = path.join(__dirname, '..', 'uploads', 'logos');
if (!fs.existsSync(destino)) {
  fs.mkdirSync(destino, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, destino),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `logo-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

module.exports = multer({ storage });
