const pool = require('../config/db');

exports.registerToken = async (req, res) => {
  const {
    ls_abonenta,
    device_token,
    device_model,
    device_name,
    os,
    os_version
  } = req.body;

  try {
    // Проверяем существование токена
    const [existing] = await pool.query(
      'SELECT id FROM push_tokens WHERE device_token = ?',
      [device_token]
    );

    if (existing.length > 0) {
      // Обновляем существующую запись
      await pool.query(
        `UPDATE push_tokens SET 
          ls_abonenta = ?,
          device_model = ?,
          device_name = ?,
          os = ?,
          os_version = ?
        WHERE device_token = ?`,
        [ls_abonenta, device_model, device_name, os, os_version, device_token]
      );
    } else {
      // Создаем новую запись
      await pool.query(
        `INSERT INTO push_tokens (
          ls_abonenta,
          device_token,
          device_model,
          device_name,
          os,
          os_version
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [ls_abonenta, device_token, device_model, device_name, os, os_version]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Token registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};