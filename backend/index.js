const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
const path = require('path');
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

app.get('/', (req, res) => res.send('Inventory API running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));