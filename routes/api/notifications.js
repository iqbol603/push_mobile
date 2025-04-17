const express = require('express');
const router = express.Router();
// const pool = require('../../config/db');

// const express = require('express');
// const router = express.Router();
const pool = require('../../config/db');
const admin = require('../../config/firebase');

// router.post('/', async (req, res) => {
//   const { title, message, type, priority, sendPush = true } = req.body;
  
//   if (!title || !message) {
//     return res.status(400).json({ error: 'Title and message are required' });
//   }

//   try {
//     // 1. Сохраняем уведомление в БД
//     const [result] = await pool.query(
//       'INSERT INTO notifications (title, message, type, priority, is_broadcast) VALUES (?, ?, ?, ?, TRUE)',
//       [title, message, type || 'system', priority || 'medium']
//     );

//     let devicesCount = 0;
    
//     // 2. Отправляем push-уведомления если требуется
//     if (sendPush) {
//       const [tokens] = await pool.query('SELECT device_token FROM push_tokens');
      
//       if (tokens.length > 0) {
//         devicesCount = tokens.length;
//         const deviceTokens = tokens.map(t => t.device_token);
        
//         // Отправка уведомлений (можно добавить батчинг для больших объемов)
//         await admin.messaging().sendEachForMulticast({
//           tokens: deviceTokens,
//           notification: { title, body: message },
//           data: {
//             notificationId: result.insertId.toString(),
//             type: type || 'system',
//             isBroadcast: 'true'
//           },
//           android: { priority: priority === 'high' ? 'high' : 'normal' },
//           apns: { headers: { 'apns-priority': priority === 'high' ? '10' : '5' } }
//         });
//       }
//     }

//     res.status(201).json({
//       id: result.insertId,
//       title,
//       message,
//       devices: devicesCount,
//       message: `Notification sent to ${devicesCount} devices`
//     });
    
//   } catch (err) {
//     console.error('Error:', err);
//     res.status(500).json({ 
//       error: 'Failed to create notification',
//       details: err.message 
//     });
//   }
// });
router.post('/', async (req, res) => {
    const { title, message, type, priority } = req.body;
    
    try {
      // 1. Сохраняем уведомление
      const [notification] = await pool.query(
        'INSERT INTO notifications (title, message, type, priority) VALUES (?, ?, ?, ?)',
        [title, message, type, priority]
      );
  
      // 2. Получаем все активные токены
      const [tokens] = await pool.query(
        'SELECT device_token FROM push_tokens WHERE is_active = TRUE'
      );
  
      // 3. Записываем в таблицу доставки
      const deliveryRecords = tokens.map(token => [
        notification.insertId,
        token.device_token
      ]);
      
      await pool.query(
        'INSERT INTO notification_delivery (notification_id, device_token) VALUES ?',
        [deliveryRecords]
      );

      let devicesCount = 0;
  
      // 4. Отправляем push-уведомления
      if (tokens.length > 0) {
        devicesCount = tokens.length;
        const deviceTokens = tokens.map(t => t.device_token);
        
        await admin.messaging().sendEachForMulticast({
          tokens: deviceTokens,
          notification: { title, body: message },
          data: {
            notificationId: notification.insertId.toString(),
            type,
            priority
          }
        });
  
        // 5. Помечаем как доставленные
        await pool.query(
          'UPDATE notification_delivery SET delivered = TRUE, delivered_at = NOW() ' +
          'WHERE notification_id = ? AND device_token IN (?)',
          [notification.insertId, deviceTokens]
        );
      }
  
      res.status(201).json({
        success: true,
        notificationId: notification.insertId,
        devices: devicesCount,
        message: `Notification sent to ${devicesCount} devices`,
      });
  
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Notification sending failed' });
    }
  });

module.exports = router;

// GET все уведомления
router.get('/', async (req, res) => {
  try {
    const [notifications] = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC');
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// Получение статистики
router.get('/stats', async (req, res) => {
    try {
      // Статистика по типам уведомлений
      const [typesStats] = await pool.query(`
        SELECT 
          type,
          COUNT(*) as total,
          SUM(is_read = 0) as unread
        FROM notifications
        GROUP BY type
      `);
      
      // Общая статистика
      const [totalStats] = await pool.query(`
        SELECT
          COUNT(*) as total_notifications,
          (SELECT COUNT(*) FROM push_tokens) as total_devices,
          SUM(is_read = 0) as total_unread
        FROM notifications
      `);
      
      // Последние уведомления
      const [recent] = await pool.query(`
        SELECT * FROM notifications 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
  
      res.json({
        types: typesStats,
        totals: totalStats[0],
        recent
      });
      
    } catch (err) {
      console.error('Stats error:', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

router.get('/:id/stats', async (req, res) => {
    try {
      // Основная информация об уведомлении
      const [notification] = await pool.query(
        'SELECT * FROM notifications WHERE id = ?',
        [req.params.id]
      );
  
      // Статистика доставки
      const [deliveryStats] = await pool.query(
        `SELECT 
           COUNT(*) as total,
           SUM(delivered) as delivered,
           SUM(read) as read
         FROM notification_delivery
         WHERE notification_id = ?`,
        [req.params.id]
      );
  
      // Устройства с детальной информацией
      const [devices] = await pool.query(
        `SELECT 
           d.device_token,
           d.delivered,
           d.delivered_at,
           d.is_read,
           d.read_at,
           t.device_model,
           t.os
         FROM notification_delivery d
         JOIN push_tokens t ON d.device_token = t.device_token
         WHERE d.notification_id = ?`,
        [req.params.id]
      );
  
      res.json({
        notification: notification[0],
        stats: deliveryStats[0],
        devices
      });
  
    } catch (err) {
      console.error('Stats error:', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });
  
  // Отметка как прочитанного
//   router.patch('/:id/read', async (req, res) => {
//     try {
//       await pool.query(
//         'UPDATE notifications SET is_read = TRUE WHERE id = ?',
//         [req.params.id]
//       );
//       res.json({ success: true });
//     } catch (err) {
//       console.error('Mark read error:', err);
//       res.status(500).json({ error: 'Failed to mark as read' });
//     }
//   });

router.post('/mark-read', async (req, res) => {
    console.log(req);
    const { notificationId, deviceToken } = req.body;
    
    try {
      await pool.query(
        `UPDATE notification_delivery 
         SET is_read = TRUE, read_at = NOW() 
         WHERE notification_id = ? AND device_token = ?`,
        [notificationId, deviceToken]
      );
      
      res.json({ success: true });
    } catch (err) {
      console.error('Mark read error:', err);
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  });

// // POST новое уведомление
// router.post('/', async (req, res) => {
//   const { title, message, type, priority } = req.body;
  
//   if (!title || !message) {
//     return res.status(400).json({ error: 'Title and message are required' });
//   }

//   try {
//     const [result] = await pool.query(
//       'INSERT INTO notifications (title, message, type, priority) VALUES (?, ?, ?, ?)',
//       [title, message, type || 'system', priority || 'medium']
//     );
    
//     res.status(201).json({
//       id: result.insertId,
//       title,
//       message
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to create notification' });
//   }
// });

// module.exports = router;