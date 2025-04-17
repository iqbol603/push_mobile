require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Подключаем роуты
const mainRouter = require('./routes');
app.use('/', mainRouter); // Используем как корневой роутер

const deviceRoutes = require('./routes/api/devices');
app.use('/api/devices', deviceRoutes);

// Обработка 404 ошибок
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});


// Запуск сервера
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});