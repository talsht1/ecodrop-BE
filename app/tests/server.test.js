const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../server');
const { swaggerSpec } = require('../swagger');

const mockPool = {
  async query(sql, params) {
    if (sql.includes('ORDER BY')) {
      return {
        rows: [
          {
            id: 2,
            name: 'Central Park Collection Point',
            address: 'Central Park, New York, NY',
            type: 'paper',
            latitude: 40.7829,
            longitude: -73.9654,
            distance_meters: 422.96
          }
        ]
      };
    }

    if (sql.includes('version()')) {
      return {
        rows: [{
          current_time: '2026-09-14T18:05:52.188Z',
          server_version: 'PostgreSQL 16.3 on x86_64-pc-linux-gnu'
        }]
      };
    }

    return { rows: [] };
  }
};

const invalidDatabasePool = {
  async query(sql, params) {
    if (sql.includes('ORDER BY')) {
      return {
        rows: [
          {
            id: 'abc',
            name: 'Central Park Collection Point',
            address: 'Central Park, New York, NY',
            type: 'paper',
            latitude: 40.7829,
            longitude: -73.9654,
            distance_meters: 422.96
          }
        ]
      };
    }

    if (sql.includes('version()')) {
      return {
        rows: [{
          current_time: '2026-09-14T18:05:52.188Z',
          server_version: 'PostgreSQL 16.3 on x86_64-pc-linux-gnu'
        }]
      };
    }

    return { rows: [] };
  }
};

const downDatabasePool = {
  async query(sql, params) {
    throw new Error('Database connection failed');
  }
};

test('GET /api/bins/nearest returns nearest bin data for valid coordinates', async () => {
  const app = createApp({ pool: mockPool });

  const response = await request(app)
    .get('/api/bins/nearest')
    .query({ lat: '40.7829', lng: '-73.9654' });

  assert.equal(response.status, 200);
  assert.equal(response.body.nearestBin.name, 'Central Park Collection Point');
  assert.equal(response.body.nearestBin.address, 'Central Park, New York, NY');
  assert.equal(response.body.nearestBin.type, 'paper');
  assert.equal(response.body.distanceMeters, 422.96);
  assert.equal(response.body.latitude, 40.7829);
  assert.equal(response.body.longitude, -73.9654);
});

test('GET /api/bins/nearest rejects invalid latitude values', async () => {
  const app = createApp({ pool: mockPool });

  const response = await request(app)
    .get('/api/bins/nearest')
    .query({ lat: '99', lng: '-73.9654' });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /lat must be between -90 and 90/i);
});

test('GET /api/bins/nearest rejects malformed DB responses', async () => {
  const app = createApp({ pool: invalidDatabasePool });

  const response = await request(app)
    .get('/api/bins/nearest')
    .query({ lat: '40.7829', lng: '-73.9654' });

  assert.equal(response.status, 500);
  assert.match(response.body.error, /invalid bin id returned from database/i);
});

test('GET /api/bins rejects malformed DB rows', async () => {
  const app = createApp({ pool: invalidDatabasePool });

  const response = await request(app).get('/api/bins');

  assert.equal(response.status, 500);
  assert.match(response.body.error, /invalid bin id returned from database/i);
});

test('GET /whoami returns app metadata', async () => {
  const app = createApp({ pool: mockPool });

  const response = await request(app).get('/whoami');

  assert.equal(response.status, 200);
  assert.equal(response.body.name, 'ecodrop-api');
  assert.equal(response.body.version, '1.0.0');
  assert.ok(response.body.environment);
});

test('GET /health reports app liveness', async () => {
  const app = createApp({ pool: mockPool });

  const response = await request(app).get('/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.service, 'ecodrop-api');
  assert.ok(Number.isFinite(response.body.uptimeSeconds));
});

test('GET /ready reports database readiness', async () => {
  const app = createApp({ pool: mockPool });

  const response = await request(app).get('/ready');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ready');
  assert.equal(response.body.database.status, 'connected');
  assert.ok(Number.isFinite(response.body.database.latencyMs));
  assert.equal(response.body.database.serverVersion, 'PostgreSQL 16.3 on x86_64-pc-linux-gnu');
});

test('GET /ready fails when the database is unavailable', async () => {
  const app = createApp({ pool: downDatabasePool });

  const response = await request(app).get('/ready');

  assert.equal(response.status, 503);
  assert.equal(response.body.status, 'not_ready');
  assert.equal(response.body.database.status, 'disconnected');
  assert.match(response.body.error, /database readiness check failed/i);
});

for (const endpoint of ['/api/bins', '/api/bins/nearest']) {
  for (const type of ['glass', 'paper', 'plastic', 'metal', 'electronics', 'mixed', null]) {
    test(`${endpoint} returns map metadata for type ${type}`, async (t) => {
      const row = {
        id: 2,
        name: 'Central Park Collection Point',
        address: type === null ? null : '  Central Park, New York, NY  ',
        type,
        latitude: 40.7829,
        longitude: -73.9654,
        distance_meters: 422.96
      };
      const query = t.mock.fn(async () => ({ rows: [row] }));
      const app = createApp({ pool: { query } });
      const response = await request(app).get(endpoint).query({ lat: '40.7829', lng: '-73.9654' });

      assert.equal(response.status, 200);
      const bin = endpoint === '/api/bins' ? response.body[0] : response.body.nearestBin;
      assert.deepEqual(bin, {
        id: row.id,
        name: row.name,
        address: row.address === null ? null : row.address.trim(),
        type,
        latitude: row.latitude,
        longitude: row.longitude,
        ...(endpoint === '/api/bins' ? {} : { distanceMeters: row.distance_meters })
      });
      assert.equal(query.mock.callCount(), 1);
      const [sql, params] = query.mock.calls[0].arguments;
      assert.match(sql, /SELECT\s+id,\s*name,\s*address,\s*type,/);
      if (endpoint === '/api/bins/nearest') {
        assert.deepEqual(params, [-73.9654, 40.7829]);
      }
    });
  }

  for (const [field, values] of Object.entries({
    address: [undefined, '', ' \t\n ', 123, {}, []],
    type: [undefined, '', 'wood', 'Paper', ' paper ', 123, {}, []]
  })) {
    for (const value of values) {
      test(`${endpoint} rejects invalid ${field}: ${JSON.stringify(value)}`, async () => {
        const row = {
          id: 2,
          name: 'Central Park Collection Point',
          address: 'Central Park, New York, NY',
          type: 'paper',
          latitude: 40.7829,
          longitude: -73.9654,
          distance_meters: 422.96,
          [field]: value
        };
        const app = createApp({ pool: { async query() { return { rows: [row] }; } } });
        const response = await request(app).get(endpoint).query({ lat: '40.7829', lng: '-73.9654' });

        assert.equal(response.status, 500);
        assert.equal(response.body.error, `Invalid bin ${field} returned from database.`);
      });
    }
  }
}

test('Swagger documents map metadata on both bin endpoints', () => {
  const schema = swaggerSpec.components.schemas.Bin;
  assert.ok(schema.required.includes('address'));
  assert.ok(schema.required.includes('type'));
  assert.equal(schema.properties.address.nullable, true);
  assert.equal(schema.properties.type.nullable, true);
  assert.deepEqual(schema.properties.type.enum,
    ['glass', 'paper', 'plastic', 'metal', 'electronics', 'mixed', null]);
  for (const endpoint of ['/api/bins', '/api/bins/nearest']) {
    assert.ok(swaggerSpec.paths[endpoint].get.responses['200']);
  }
});
