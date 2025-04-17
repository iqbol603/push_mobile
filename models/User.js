const pool = require('../config/db');

class User {
  static async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM push_users WHERE email = ?', [email]);
    return rows[0];
  }

  static async create({ email, password }) {
    const [result] = await pool.query(
      'INSERT INTO users (email, password) VALUES (?, ?)',
      [email, password]
    );
    return result.insertId;
  }
}

module.exports = User;