// Kết nối PostgreSQL (CSDL pizzadb)
// Cấu hình bằng biến môi trường DATABASE_URL, ví dụ:
//   postgres://postgres:matkhau@localhost:5432/pizzadb
// Khi chạy trên cloud (Render, Neon, Supabase...) đặt thêm DB_SSL=true nếu nhà cung cấp yêu cầu SSL.
// Giờ Việt Nam cho Node (Vercel mặc định UTC và không cho đặt biến TZ)
process.env.TZ = process.env.APP_TZ || 'Asia/Ho_Chi_Minh';
const { Pool, types } = require('pg');

// Trả số thay vì chuỗi cho BIGINT (COUNT) và NUMERIC (tiền); giữ DATE dạng 'YYYY-MM-DD'
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(1082, (v) => v);

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/pizzadb';
const useSsl = process.env.DB_SSL === 'true' || /sslmode=require/.test(connectionString);
const pool = new Pool({ connectionString, ssl: useSsl ? { rejectUnauthorized: false } : undefined, max: Number(process.env.DB_POOL_MAX) || 5 });

const getPool = async () => pool;

// Postgres trả tên cột chữ thường; khôi phục đúng tên viết trong câu SQL (MaDon, soDon, ...)
function restoreCase(text, rows) {
  if (!rows.length) return rows;
  const names = new Map();
  for (const w of text.match(/(?<![@\w])[A-Za-z_]\w*(?!['\w])/g) || []) names.set(w.toLowerCase(), w);
  const keys = Object.keys(rows[0]).map((k) => [k, names.get(k) || k]);
  return rows.map((r) => Object.fromEntries(keys.map(([k, n]) => [n, r[k]])));
}

/** Đổi tham số @ten thành $1, $2... */
function compile(text, params) {
  const values = [];
  const index = {};
  const sqlText = text.replace(/(?<![@\w])@(\w+)/g, (m, name) => {
    if (!(name in params)) return m;
    if (!index[name]) { values.push(params[name] === undefined ? null : params[name]); index[name] = values.length; }
    return `$${index[name]}`;
  });
  return { sqlText, values };
}

/** Chạy câu truy vấn có tham số: query('SELECT ... WHERE A = @a', { a: 1 }) */
async function query(text, params = {}, client = null) {
  const { sqlText, values } = compile(text, params);
  const res = await (client || pool).query(sqlText, values);
  return restoreCase(text, res.rows || []);
}

/** Chạy một nhóm lệnh trong giao tác (transaction) */
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn((text, params) => query(text, params, client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* bỏ qua */ }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, getPool, query, transaction };
