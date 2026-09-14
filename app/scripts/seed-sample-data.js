const { Pool } = require('pg');
const config = require('../config');
const { readFileSync } = require('node:fs');
const path = require('node:path');

async function seedSampleData() {
  const pool = new Pool({ connectionString: config.database.url });

  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bins (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location GEOMETRY(Point, 4326) NOT NULL
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS bins_location_gist_idx
      ON bins USING GIST (location);
    `);
    const migration = readFileSync(path.join(
      __dirname, '..', '..', 'supabase', 'migrations',
      '20260914151214_add_bin_address_and_type.sql'
    ), 'utf8');
    const seed = readFileSync(path.join(__dirname, '..', '..', 'supabase', 'seed.sql'), 'utf8');
    await pool.query(`BEGIN;\n${migration}\n${seed}\nCOMMIT;`);

    const result = await pool.query('SELECT COUNT(*) AS total FROM bins;');
    console.log(`Seeded ${result.rows[0].total} bins.`);
  } catch (error) {
    console.error('Failed to seed sample data:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedSampleData();
