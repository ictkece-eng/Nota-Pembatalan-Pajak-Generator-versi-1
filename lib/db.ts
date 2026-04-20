import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export async function getDb() {
  if (!pool) {
    let connectionString = process.env.DATABASE_URL || 'mysql://3cmJDj1dFPpqYxA.root:hBPtj3S977s7dK9Z@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/Billing';
    
    // Clean string from potential quotes and ALL whitespace/newlines
    connectionString = connectionString.replace(/\s/g, '').replace(/['"]/g, '');

    const sslConfig = {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: false
    };

    // Use a custom regex to parse the MySQL connection string
    // Format: mysql://user:password@host:port/database
    const regex = /^mysql:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/(.+)$/;
    const match = connectionString.match(regex);

    if (match) {
      const [, user, password, host, port, database] = match;
      pool = mysql.createPool({
        host: host,
        port: parseInt(port) || 4000,
        user: decodeURIComponent(user),
        password: decodeURIComponent(password),
        database: decodeURIComponent(database),
        ssl: sslConfig,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
      });
    } else {
      // Fallback to the uri property if regex fails
      pool = mysql.createPool({
        uri: connectionString,
        ssl: sslConfig,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
      });
    }
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
