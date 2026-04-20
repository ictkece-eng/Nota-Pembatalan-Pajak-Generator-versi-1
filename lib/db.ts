import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export async function getDb() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || 'mysql://3cmJDj1dFPpqYxA.root:hBPtj3S977s7dK9Z@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/Billing';
    pool = mysql.createPool({
      uri: connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
}

export async function initDb() {
  const db = await getDb();
  
  // Create table for nota pembatalan
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nota_pajak (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nomor VARCHAR(255),
      faktur_nomor VARCHAR(255),
      faktur_tanggal DATE,
      penerima_name VARCHAR(255),
      penerima_address TEXT,
      penerima_npwp VARCHAR(20),
      pemberi_name VARCHAR(255),
      pemberi_address TEXT,
      pemberi_npwp VARCHAR(20),
      items JSON,
      tanggal_dokumen DATE,
      penandatangan VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
