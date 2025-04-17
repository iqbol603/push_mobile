const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

router.get('/:token/notifications', async (req, res) => {
  try {
    // Получаем все уведомления для данного устройства
    const [notifications] = await pool.query(`
      SELECT 
        n.id,
        n.title,
        n.message,
        n.type,
        n.priority,
        n.created_at,
        d.delivered,
        d.delivered_at,
        d.is_read,
        d.read_at
      FROM notifications n
      JOIN notification_delivery d ON n.id = d.notification_id
      WHERE d.device_token = ?
      ORDER BY n.created_at DESC
    `, [req.params.token]);

    // Статистика по устройству
    const [stats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(d.delivered) as delivered,
        SUM(d.is_read) as read_count
      FROM notification_delivery d
      WHERE d.device_token = ?
    `, [req.params.token]);

    res.json({
      deviceToken: req.params.token,
      stats: stats[0],
      notifications
    });

  } catch (err) {
    console.error('Device notifications error:', err);
    res.status(500).json({ error: 'Failed to get device notifications' });
  }
});

module.exports = router;