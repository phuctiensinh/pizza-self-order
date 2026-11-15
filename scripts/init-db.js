// Tạo bảng + dữ liệu mẫu trên PostgreSQL từ database/PizzaDB.sql
// Cần biến môi trường DATABASE_URL (và DB_SSL=true nếu CSDL cloud yêu cầu SSL)
const fs = require('fs');
const path = require('path');
const { pool } = require('../server/db');

(async () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'database', 'PizzaDB.sql'), 'utf8');
  try {
    await pool.query(text); // pg chạy được cả file nhiều lệnh khi không có tham số
    console.log('Đã tạo CSDL và dữ liệu mẫu.');
  } catch (e) {
    console.error('Lỗi:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
