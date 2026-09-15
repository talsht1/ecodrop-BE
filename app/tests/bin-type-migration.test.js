const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const sqlRoot = path.join(__dirname, '..', '..', 'supabase');
const migration = readFileSync(path.join(sqlRoot, 'migrations', '20260915060000_replace_bin_types.sql'), 'utf8');

test('type migration preserves bin data, enforces new types, and supports seed reruns', {
  skip: !process.env.TEST_DATABASE_URL
}, async () => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Shadow the real table for this connection; rollback removes all test data and DDL.
    await client.query(`
      CREATE TEMP TABLE bins (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location GEOMETRY(Point, 4326) NOT NULL
      ) ON COMMIT DROP;
    `);
    for (const file of [
      '20260914_000001_create_bins_table.sql',
      '20260914151214_add_bin_address_and_type.sql'
    ]) {
      await client.query(readFileSync(path.join(sqlRoot, 'migrations', file), 'utf8'));
    }
    const legacyTypes = ['mixed', 'plastic', 'metal', 'glass', 'paper', 'electronics', null];
    for (const [index, type] of legacyTypes.entries()) {
      await client.query(`
        INSERT INTO bins (name, address, type, location)
        VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint(35.3956, 32.9194), 4326));
      `, [`Migration fixture ${index}`, index === 6 ? null : 'Original address', type]);
    }
    await client.query("UPDATE bins SET type = NULL WHERE name = 'Downtown Recycling Hub'");
    const snapshotSql = 'SELECT id, name, address, type, ST_AsEWKT(location) AS location FROM bins ORDER BY id';
    const before = (await client.query(snapshotSql)).rows;
    await client.query(migration);
    const mapping = { mixed: 'general_waste', plastic: 'packaging', metal: 'packaging' };
    const expected = before.map(row => ({ ...row, type: mapping[row.type] ?? row.type }));
    assert.deepEqual((await client.query(snapshotSql)).rows, expected);
    await client.query(migration);
    assert.deepEqual((await client.query(snapshotSql)).rows, expected);

    await client.query('SAVEPOINT type_probes');
    for (const type of [
      'general_waste', 'packaging', 'glass', 'paper', 'textile', 'electronics',
      'cardboard', 'bulky_waste', 'bottle_recycling_machine', 'yard_waste', null
    ]) {
      await client.query(`
        INSERT INTO bins (name, type, location)
        VALUES ('Allowed type probe', $1, ST_SetSRID(ST_MakePoint(0, 0), 4326));
      `, [type]);
    }
    await client.query('ROLLBACK TO SAVEPOINT type_probes');
    for (const type of ['mixed', 'plastic', 'metal', 'unknown', 'Packaging', ' packaging ']) {
      await client.query('SAVEPOINT invalid_type');
      await assert.rejects(client.query(`
        INSERT INTO bins (name, type, location)
        VALUES ('Rejected type probe', $1, ST_SetSRID(ST_MakePoint(0, 0), 4326));
      `, [type]), error => error.code === '23514' && error.constraint === 'bins_type_allowed');
      await client.query('ROLLBACK TO SAVEPOINT invalid_type');
    }

    const seed = readFileSync(path.join(sqlRoot, 'seed.sql'), 'utf8');
    await client.query(seed);
    const seeded = (await client.query(snapshotSql)).rows;
    assert.equal(seeded.length, 30 + legacyTypes.length);
    for (const row of expected) {
      assert.deepEqual(seeded.find(bin => bin.id === row.id), row);
    }
    await client.query(seed);
    assert.deepEqual((await client.query(snapshotSql)).rows, seeded);
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
      await pool.end();
    }
  }
});
