const fs = require('fs');
const path = require('path');

// Copy Devanagari font to /tmp at startup for sharp/librsvg
const fontSrc = path.join(__dirname, 'assets/NotoSansDevanagari-SemiBold.ttf');
const fontDir = '/tmp/fonts';
const fontDst = path.join(fontDir, 'NotoSansDevanagari-SemiBold.ttf');
const fontConf = path.join(fontDir, 'fonts.conf');

if (!fs.existsSync(fontDir)) fs.mkdirSync(fontDir, { recursive: true });
if (!fs.existsSync(fontDst)) fs.copyFileSync(fontSrc, fontDst);
if (!fs.existsSync(fontConf)) {
  fs.writeFileSync(fontConf, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/tmp/fonts</dir>
</fontconfig>`);
}

process.env.FONTCONFIG_PATH = fontDir;
console.log('✓ Font setup complete');

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/api/test', (req, res) => {
  res.json({ received: req.body });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/products', require('./routes/products'));
app.use('/api/movements', require('./routes/movements'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/units', require('./routes/units'));
app.use('/api/workers', require('./routes/workers'));

app.get('/', (req, res) => res.send('Inventory API running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));