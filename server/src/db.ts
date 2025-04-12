// server/src/db.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'carlogic',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Test the connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client for DB connection test:', err.stack);
  }
  // Check if client is defined before using it
  if (client) {
    client.query('SELECT NOW()', (queryErr, result) => {
      release(); // Release the client back to the pool
      if (queryErr) {
        return console.error('Error executing query for DB connection test:', queryErr.stack);
      }
      console.log('PostgreSQL Database connected successfully.');
      // console.log('Current time from DB:', result.rows[0].now);
    });
  } else {
    // Handle case where client is undefined even without an error (should be rare)
    console.error('DB client is undefined after connect, cannot test query.');
    release(); // Still release, just in case
  }
});

export default pool;