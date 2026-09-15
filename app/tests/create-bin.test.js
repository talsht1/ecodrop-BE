const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { createApp } = require('../server');
const { swaggerSpec } = require('../swagger');

const validBody = {
  name: 'New Collection Point',
  address: 'Moran, Israel',
  type: 'general_waste',
  latitude: 32.9194,
  longitude: 35.3956
};

function createMockPool(t) {
  const rows = [];
  const query = t.mock.fn(async (sql, params) => {
    if (sql.includes('INSERT INTO bins')) {
      const [name, address, type, longitude, latitude] = params;
      const row = { id: rows.length + 1, name, address, type, longitude, latitude };
      rows.push(row);
      return { rows: [row] };
    }
    return { rows };
  });
  return { query };
}

for (const type of [
  'general_waste', 'packaging', 'glass', 'paper', 'textile', 'electronics',
  'cardboard', 'bulky_waste', 'bottle_recycling_machine', 'yard_waste', null
]) {
  test(`POST /api/bins saves type ${type} and returns a generated ID`, async (t) => {
    const pool = createMockPool(t);
    const app = createApp({ pool });
    const body = { ...validBody, type };
    const response = await request(app).post('/api/bins').send(body);

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, { id: 1, ...body });
    assert.equal(pool.query.mock.callCount(), 1);
    const [sql, params] = pool.query.mock.calls[0].arguments;
    assert.match(sql, /ST_SetSRID\(ST_MakePoint\(\$4, \$5\), 4326\)/);
    assert.match(sql, /RETURNING id, name, address, type/);
    assert.deepEqual(params, [body.name, body.address, type, body.longitude, body.latitude]);

    const listing = await request(app).get('/api/bins');
    assert.equal(listing.status, 200);
    assert.deepEqual(listing.body, [response.body]);
  });
}

test('POST /api/bins trims text and keeps SQL-like input in parameters', async (t) => {
  const pool = createMockPool(t);
  const app = createApp({ pool });
  const name = "Visitor's bin'); DROP TABLE bins; --";
  const response = await request(app).post('/api/bins').send({
    ...validBody, name: `  ${name}  `, address: '  Moran, Israel  '
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.name, name);
  assert.equal(response.body.address, validBody.address);
  const [sql, params] = pool.query.mock.calls[0].arguments;
  assert.ok(!sql.includes(name));
  assert.equal(params[0], name);
});

for (const metadata of [{}, { address: null, type: null }, { address: null, type: 'general_waste' }, { address: 'Moran, Israel' }]) {
  test(`POST /api/bins allows optional metadata ${JSON.stringify(metadata)}`, async (t) => {
    const pool = createMockPool(t);
    const response = await request(createApp({ pool })).post('/api/bins').send({
      name: 'Optional metadata', latitude: 0, longitude: 0, ...metadata
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.address, metadata.address ?? null);
    assert.equal(response.body.type, metadata.type ?? null);
  });
}

for (const [latitude, longitude] of [[-90, -180], [90, 180], [0, 0]]) {
  test(`POST /api/bins accepts coordinate boundaries ${latitude}, ${longitude}`, async (t) => {
    const response = await request(createApp({ pool: createMockPool(t) }))
      .post('/api/bins').send({ ...validBody, latitude, longitude });
    assert.equal(response.status, 201);
    assert.equal(response.body.latitude, latitude);
    assert.equal(response.body.longitude, longitude);
  });
}

const invalidBodies = [
  {}, [], null, 'not an object', 42,
  ...[undefined, null, '', ' \t ', 12, {}, 'x'.repeat(256), 'bin\0name'].map(name => ({ ...validBody, name })),
  ...['', ' \n ', 12, [], {}, 'address\0'].map(address => ({ ...validBody, address })),
  ...['mixed', 'plastic', 'metal', 'wood', 'Paper', ' packaging ', '', false, []].map(type => ({ ...validBody, type })),
  ...[undefined, null, '', '32.9194', true, [], {}, -90.01, 90.01].map(latitude => ({ ...validBody, latitude })),
  ...[undefined, null, '', '35.3956', true, [], {}, -180.01, 180.01].map(longitude => ({ ...validBody, longitude })),
  { ...validBody, id: 17 },
  { ...validBody, distanceMeters: 5 },
  { ...validBody, lat: 32.9194 }
];

for (const [index, body] of invalidBodies.entries()) {
  test(`POST /api/bins rejects invalid payload ${index + 1} before DB access`, async (t) => {
    const pool = createMockPool(t);
    const response = await request(createApp({ pool }))
      .post('/api/bins').type('json').send(JSON.stringify(body));
    assert.equal(response.status, 400);
    assert.equal(typeof response.body.error, 'string');
    assert.equal(pool.query.mock.callCount(), 0);
  });
}

for (const [body, status] of [
  ['{"name":', 400],
  ['{"name":"Overflow","latitude":1e400,"longitude":0}', 400],
  [JSON.stringify({ ...validBody, address: 'x'.repeat(110 * 1024) }), 413]
]) {
  test(`POST /api/bins rejects malformed or oversized JSON with ${status}`, async (t) => {
    const pool = createMockPool(t);
    const response = await request(createApp({ pool })).post('/api/bins').type('json').send(body);
    assert.equal(response.status, status);
    assert.equal(typeof response.body.error, 'string');
    assert.equal(pool.query.mock.callCount(), 0);
  });
}

test('POST /api/bins requires JSON content type', async (t) => {
  const pool = createMockPool(t);
  const response = await request(createApp({ pool })).post('/api/bins').type('text').send('hello');
  assert.equal(response.status, 415);
  assert.equal(pool.query.mock.callCount(), 0);
});

test('POST /api/bins accepts a maximum-length name', async (t) => {
  const response = await request(createApp({ pool: createMockPool(t) }))
    .post('/api/bins').send({ ...validBody, name: 'x'.repeat(255) });
  assert.equal(response.status, 201);
});

test('POST /api/bins logs database errors without exposing details', async (t) => {
  const error = new Error('Internal database connection detail');
  const log = t.mock.method(console, 'error', () => {});
  const query = t.mock.fn(async () => { throw error; });
  const response = await request(createApp({ pool: { query } })).post('/api/bins').send(validBody);
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: 'Failed to create recycling bin.' });
  assert.equal(log.mock.callCount(), 1);
  assert.equal(log.mock.calls[0].arguments[1], error);
});

test('POST /api/bins does not report success without a returned bin', async (t) => {
  t.mock.method(console, 'error', () => {});
  const pool = { async query() { return { rows: [] }; } };
  const response = await request(createApp({ pool })).post('/api/bins').send(validBody);
  assert.equal(response.status, 500);
});

test('OpenAPI documents creation and exported JSON matches Swagger', () => {
  const schema = swaggerSpec.components.schemas.CreateBinRequest;
  assert.deepEqual(schema.required, ['name', 'latitude', 'longitude']);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.address.nullable, true);
  assert.equal(schema.properties.type.nullable, true);
  const operation = swaggerSpec.paths['/api/bins'].post;
  assert.equal(operation.requestBody.required, true);
  for (const status of [201, 400, 413, 415, 500]) {
    assert.ok(operation.responses[status]);
  }
  const exported = JSON.parse(readFileSync(path.join(__dirname, '..', '..', 'openapi.json'), 'utf8'));
  assert.deepEqual(exported, swaggerSpec);
});
