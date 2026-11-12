// Kết nối SQL Server (CSDL PizzaDB)
// Mặc định dùng Windows Authentication qua ODBC Driver 18.
// Có thể đổi bằng biến môi trường DB_CONN, ví dụ dùng tài khoản SQL:
//   Driver={ODBC Driver 18 for SQL Server};Server=localhost;Database=PizzaDB;Uid=sa;Pwd=***;TrustServerCertificate=yes;
const sql = require('mssql/msnodesqlv8');

const connectionString =
  process.env.DB_CONN ||
  'Driver={ODBC Driver 18 for SQL Server};Server=localhost;Database=PizzaDB;Trusted_Connection=yes;TrustServerCertificate=yes;';

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool({ connectionString }).connect().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

/** Chạy câu truy vấn có tham số: query('SELECT ... WHERE A = @a', { a: 1 }) */
async function query(text, params = {}, tx = null) {
  const req = tx ? new sql.Request(tx) : (await getPool()).request();
  for (const [k, v] of Object.entries(params)) req.input(k, v);
  const res = await req.query(text);
  return res.recordset || [];
}

/** Chạy một nhóm lệnh trong giao tác (transaction) */
async function transaction(fn) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await fn((text, params) => query(text, params, tx));
    await tx.commit();
    return result;
  } catch (err) {
    try { await tx.rollback(); } catch { /* bỏ qua */ }
    throw err;
  }
}

module.exports = { sql, getPool, query, transaction };
