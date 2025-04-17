const express = require('express');
const router = express.Router();
const notificationsRouter = require('./api/notifications');
const devicesRouter = require('./api/devices');

// Основной маршрут для уведомлений
router.use('/api/notifications', notificationsRouter);
router.use('/api/devices', devicesRouter);

// Тестовый маршрут для проверки работы сервера
router.get('/', (req, res) => {
  res.json({ message: "Notification API is working!" });
});

module.exports = router;