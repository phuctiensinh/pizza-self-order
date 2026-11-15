// Tạo bảng + dữ liệu mẫu trên Azure SQL từ database/PizzaDB.sql
// Cần biến môi trường DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD
const fs = require('fs');
const path = require('path');
const sql = require('mssql');

(async () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'database', 'PizzaDB.sql'), 'utf8');
  const start = text.indexOf('USE PizzaDB;');
  const body = text.slice(text.indexOf('\n', start) + 1); // bỏ phần USE master / CREATE DATABASE
  const batches = body.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const pool = await sql.connect({
    server: process.env.DB_SERVER, database: process.env.DB_NAME || 'PizzaDB',
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    options: { encrypt: true }, requestTimeout: 120000,
  });
  for (const [i, b] of batches.entries()) {
    try { await pool.request().batch(b); } catch (e) { console.error(`Batch ${i + 1} lỗi:`, e.message); process.exit(1); }
  }
  console.log(`Đã chạy ${batches.length} batch.`);
  await pool.close();
})();
