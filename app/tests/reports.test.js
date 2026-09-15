const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../server');
const { swaggerSpec } = require('../swagger');
const { REPORT_IMAGE_LIMIT } = require('../schemas/report');
const { createReportMailer } = require('../services/report-mailer');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2XcAAAAASUVORK5CYII=', 'base64');
const success = { success: true, message: 'Report submitted successfully' };
const drain = () => new Promise(resolve => setImmediate(resolve));

function setup(t, send = async () => 'email-id', configured = true) {
  const mailer = { configured, send: t.mock.fn(send) };
  const logger = { error: t.mock.fn() };
  const pool = { query: t.mock.fn(async () => { throw new Error('Reports must not query the DB'); }) };
  return { app: createApp({ pool, reportMailer: mailer, reportLogger: logger }), mailer, logger, pool };
}

function location(app) {
  return request(app).post('/api/reports').field('latitude', '32.9194').field('longitude', '35.3956');
}

test('reports require only location and do not wait for an unresolved email dispatch', { timeout: 4000 }, async (t) => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const { app, mailer, pool } = setup(t, () => pending);
  try {
    const response = await location(app).timeout({ response: 2000, deadline: 3000 });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, success);
    await drain();
    assert.equal(mailer.send.mock.callCount(), 1);
    const report = mailer.send.mock.calls[0].arguments[0];
    assert.equal(report.latitude, 32.9194);
    assert.equal(report.longitude, 35.3956);
    assert.equal(report.reporterName, null);
    assert.equal(report.incidentTime, null);
    assert.equal(report.message, null);
    assert.equal(report.image, undefined);
    assert.ok(report.id);
    assert.ok(Number.isFinite(Date.parse(report.submittedAt)));
    assert.equal(pool.query.mock.callCount(), 0);
  } finally {
    finish();
  }
});

test('reports accept all optional fields with one image', async (t) => {
  const { app, mailer } = setup(t);
  const response = await location(app)
    .field('reporterName', '  Alex  ')
    .field('incidentTime', '2026-09-15T09:00:00+03:00')
    .field('message', '  Bin is full.\nPlease collect it.  ')
    .attach('image', png, { filename: 'user-photo.png', contentType: 'image/png' });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body, success);
  await drain();
  const report = mailer.send.mock.calls[0].arguments[0];
  assert.equal(report.reporterName, 'Alex');
  assert.equal(report.incidentTime, '2026-09-15T06:00:00.000Z');
  assert.equal(report.message, 'Bin is full.\nPlease collect it.');
  assert.deepEqual(report.image, { filename: 'report-image.png', contentType: 'image/png', buffer: png });
});

test('empty optional report fields are treated as absent', async (t) => {
  const { app, mailer } = setup(t);
  const response = await location(app).field('reporterName', '').field('message', '  ').field('incidentTime', '');
  assert.equal(response.status, 200);
  await drain();
  const report = mailer.send.mock.calls[0].arguments[0];
  for (const field of ['reporterName', 'message', 'incidentTime']) assert.equal(report[field], null);
});

for (const [latitude, longitude] of [['0', '0'], ['-90', '-180'], ['90', '180']]) {
  test(`report location accepts boundaries ${latitude}, ${longitude}`, async (t) => {
    const { app } = setup(t);
    const response = await request(app).post('/api/reports').field('latitude', latitude).field('longitude', longitude);
    assert.equal(response.status, 200);
  });
}

for (const fields of [
  {}, { latitude: '32' }, { longitude: '35' },
  ...['', ' ', 'NaN', 'Infinity', '0x20', 'true', '1e400', '91', '-91'].map(latitude => ({ latitude, longitude: '35' })),
  ...['', ' ', '181', '-181', 'not-a-number'].map(longitude => ({ latitude: '32', longitude })),
  { latitude: '32', longitude: '35', to: 'unwanted@example.com' },
  { latitude: '32', longitude: '35', image: 'https://example.com/image.png' },
  { latitude: '32', longitude: '35', reporterName: 'x'.repeat(201) },
  { latitude: '32', longitude: '35', message: 'x'.repeat(10001) },
  { latitude: '32', longitude: '35', message: 'invalid\0text' },
  ...['today', '2026-09-15T09:00:00', '2026-02-30T09:00:00Z', '2025-02-29T09:00:00Z',
    '2026-13-01T09:00:00Z', '2026-09-15T25:00:00Z'].map(incidentTime => ({ latitude: '32', longitude: '35', incidentTime }))
]) {
  test(`reports reject invalid fields ${JSON.stringify(fields).slice(0, 120)}`, async (t) => {
    const { app, mailer } = setup(t);
    let submission = request(app).post('/api/reports');
    for (const [field, value] of Object.entries(fields)) submission = submission.field(field, value);
    if (!Object.keys(fields).length) submission = submission.set('Content-Type', 'multipart/form-data; boundary=empty').send('--empty--\r\n');
    const response = await submission;
    assert.equal(response.status, 400, JSON.stringify(response.body));
    await drain();
    assert.equal(mailer.send.mock.callCount(), 0);
  });
}

test('reports accept leap-day incident timestamps', async (t) => {
  const { app } = setup(t);
  const response = await location(app).field('incidentTime', '2024-02-29T23:59:59Z');
  assert.equal(response.status, 200);
});

test('reports reject duplicate fields', async (t) => {
  const { app, mailer } = setup(t);
  const response = await location(app).field('latitude', '33');
  assert.equal(response.status, 400);
  assert.equal(mailer.send.mock.callCount(), 0);
});

test('reports reject nested form fields', async (t) => {
  const { app, mailer } = setup(t);
  const response = await location(app).field('reporterName[first]', 'Alex');
  assert.equal(response.status, 400);
  assert.equal(mailer.send.mock.callCount(), 0);
});

for (const [contentType, buffer] of [
  ['image/png', png],
  ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9])],
  ['image/webp', Buffer.from('524946460c0000005745425056503820', 'hex')]
]) {
  test(`reports accept an image with a ${contentType} signature`, async (t) => {
    const { app, mailer } = setup(t);
    const response = await location(app).attach('image', buffer, { filename: 'photo', contentType });
    assert.equal(response.status, 200);
    await drain();
    assert.equal(mailer.send.mock.calls[0].arguments[0].image.contentType, contentType);
  });
}

test('reports accept an image exactly at the size limit', async (t) => {
  const { app } = setup(t);
  const image = Buffer.alloc(REPORT_IMAGE_LIMIT);
  png.copy(image);
  const response = await location(app).attach('image', image, { filename: 'large.png', contentType: 'image/png' });
  assert.equal(response.status, 200);
});

test('reports reject images above 5 MiB', async (t) => {
  const { app, mailer } = setup(t);
  const image = Buffer.alloc(REPORT_IMAGE_LIMIT + 1);
  png.copy(image);
  const response = await location(app).attach('image', image, { filename: 'large.png', contentType: 'image/png' });
  assert.equal(response.status, 413);
  assert.equal(mailer.send.mock.callCount(), 0);
});

for (const [contentType, status] of [['image/svg+xml', 415], ['application/pdf', 415], ['image/png', 400]]) {
  test(`reports reject invalid image content ${contentType}`, async (t) => {
    const { app, mailer } = setup(t);
    const response = await location(app).attach('image', Buffer.from('not an image'), { filename: 'fake', contentType });
    assert.equal(response.status, status);
    assert.equal(mailer.send.mock.callCount(), 0);
  });
}

test('reports reject more than one image', async (t) => {
  const { app, mailer } = setup(t);
  const response = await location(app)
    .attach('image', png, { filename: 'one.png', contentType: 'image/png' })
    .attach('image', png, { filename: 'two.png', contentType: 'image/png' });
  assert.equal(response.status, 400);
  assert.equal(mailer.send.mock.callCount(), 0);
});

test('reports require multipart content type', async (t) => {
  const { app } = setup(t);
  const response = await request(app).post('/api/reports').send({ latitude: 32, longitude: 35 });
  assert.equal(response.status, 415);
});

test('reports reject malformed multipart requests', async (t) => {
  const { app } = setup(t);
  const response = await request(app).post('/api/reports').set('Content-Type', 'multipart/form-data').send('invalid');
  assert.equal(response.status, 400);
});

test('reports return 503 and log when email is not configured', async (t) => {
  const { app, mailer, logger } = setup(t, async () => {}, false);
  const response = await location(app);
  assert.equal(response.status, 503);
  assert.equal(mailer.send.mock.callCount(), 0);
  assert.equal(logger.error.mock.callCount(), 1);
});

for (const send of [
  () => { throw new Error('Synchronous dispatch failure'); },
  async () => { throw new Error('Provider unavailable'); }
]) {
  test('background email failure is logged without changing the accepted response', async (t) => {
    const { app, logger } = setup(t, send);
    const response = await location(app);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, success);
    await drain();
    assert.equal(logger.error.mock.callCount(), 1);
    const [message, details] = logger.error.mock.calls[0].arguments;
    assert.equal(message, 'Report email dispatch failed');
    assert.ok(details.reportId);
    assert.equal(typeof details.error, 'string');
  });
}

test('OpenAPI describes report multipart fields, image types, and immediate success', () => {
  assert.deepEqual(swaggerSpec.components.schemas.ReportRequest.required, ['latitude', 'longitude']);
  const content = swaggerSpec.paths['/api/reports'].post.requestBody.content['multipart/form-data'];
  assert.match(content.encoding.image.contentType, /image\/webp/);
  assert.equal(swaggerSpec.components.schemas.ReportRequest.properties.image.format, 'binary');
  assert.deepEqual(swaggerSpec.components.schemas.ReportSubmitted.properties.message.enum, [success.message]);
});

test('report route and real mailer build the configured email with the uploaded attachment', async (t) => {
  const fetchMock = t.mock.fn(async () => ({ ok: true, json: async () => ({ id: 'provider-message-id' }) }));
  const reportMailer = createReportMailer({
    targetEmail: 'reports@example.com',
    fromEmail: 'sender@example.com',
    apiKey: 'test-key',
    apiUrl: 'https://api.resend.com/emails',
    timeoutMs: 10000
  }, fetchMock);
  const app = createApp({ reportMailer });
  const response = await location(app)
    .field('message', 'Collection needed')
    .attach('image', png, { filename: 'photo.png', contentType: 'image/png' });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, success);
  await drain();
  const payload = JSON.parse(fetchMock.mock.calls[0].arguments[1].body);
  assert.deepEqual(payload.to, ['reports@example.com']);
  assert.ok(payload.text.includes('Collection needed'));
  assert.equal(payload.attachments[0].content, png.toString('base64'));
});
