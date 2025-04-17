const admin = require('../config/firebase');
const pool = require('../config/db');

exports.sendPush = async (tokens, title, body) => {
  try {
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      android: { priority: "high" }
    });
  } catch (err) {
    console.error('Push notification error:', err);
  }
};

exports.getStats = async (req, res) => {
    try {
      const [stats] = await pool.query(`
        SELECT 
          type,
          COUNT(*) as total,
          SUM(read_status = 0) as unread
        FROM notifications
        GROUP BY type
      `);
      res.json(stats);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  };

  exports.sendNotification = async (req, res) => {
    const { title, message, type, priority, sendPush = true } = req.body;
  
    // Валидация обязательных полей
    if (!title || !message || !type || !priority) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, message, type, priority' 
      });
    }
  
    try {
      // 1. Сохраняем уведомление в БД с пометкой о массовой рассылке
      const [notification] = await pool.query(
        `INSERT INTO notifications 
         (title, message, type, priority, is_broadcast) 
         VALUES (?, ?, ?, ?, TRUE)`,
        [title, message, type, priority]
      );
  
      // 2. Если не требуется отправка push - сразу возвращаем ответ
      if (!sendPush) {
        return res.status(201).json({
          success: true,
          notificationId: notification.insertId,
          devices: 0,
          message: 'Notification saved (no push sent)'
        });
      }
  
      // 3. Получаем ВСЕ токены устройств (без фильтра is_active)
      const [tokens] = await pool.query(
        'SELECT device_token FROM push_tokens'
      );
  
      // 4. Отправляем push-уведомления если есть токены
      let sentCount = 0;
      console.log("token", tokens);
      if (tokens.length > 0) {
        const deviceTokens = tokens.map(t => t.device_token);
        
        // Разбиваем на батчи по 500 токенов (ограничение FCM)
        const batchSize = 500;
        for (let i = 0; i < deviceTokens.length; i += batchSize) {
          const batch = deviceTokens.slice(i, i + batchSize);
          
          try {
            const response = await admin.messaging().sendEachForMulticast({
              tokens: batch,
              notification: { title, body: message },
              data: {
                notificationId: notification.insertId.toString(),
                type,
                priority,
                isBroadcast: 'true'
              },
              android: { priority: priority === 'high' ? 'high' : 'normal' },
              apns: { headers: { 'apns-priority': priority === 'high' ? '10' : '5' } }
            });
            
            sentCount += response.successCount;
          } catch (batchError) {
            console.error(`Error in batch ${i / batchSize}:`, batchError);
            // Продолжаем отправку следующих батчей при ошибке
          }
        }
      }
  
      res.status(201).json({
        success: true,
        notificationId: notification.insertId,
        devices: sentCount,
        totalDevices: tokens.length,
        message: `Notification sent to ${sentCount} of ${tokens.length} devices`
      });
  
    } catch (err) {
      console.error('Error in sendNotification:', err);
      res.status(500).json({ 
        error: 'Internal server error',
        details: err.message 
      });
    }
  };
 


// exports.sendNotification = async (req, res) => {
//   const { title, message, type, priority } = req.body;

//   try {
//     // 1. Сохраняем уведомление в БД
//     const [notification] = await pool.query(
//       'INSERT INTO notifications (title, message, type, priority) VALUES (?, ?, ?, ?)',
//       [title, message, type, priority]
//     );
    
//     // 2. Получаем активные токены устройств
//     const [tokens] = await pool.query(
//       'SELECT device_token FROM push_tokens '
//     //   'SELECT device_token FROM push_tokens WHERE is_active = TRUE'
//     );
    
//     // 3. Отправляем push-уведомления
//     if (tokens.length > 0) {
//       const deviceTokens = tokens.map(t => t.device_token);
      
//       await admin.messaging().sendEachForMulticast({
//         tokens: deviceTokens,
//         notification: {
//           title: title,
//           body: message
//         },
//         data: {
//           notificationId: notification.insertId.toString(),
//           type: type
//         },
//         android: {
//           priority: priority === 'high' ? 'high' : 'normal'
//         },
//         apns: {
//           headers: {
//             'apns-priority': priority === 'high' ? '10' : '5'
//           }
//         }
//       });
//     }

//     res.status(201).json({
//       success: true,
//       notificationId: notification.insertId
//     });
    
//   } catch (err) {
//     console.error('Error sending notification:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };