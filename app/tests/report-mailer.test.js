const test = require('node:test');
const assert = require('node:assert/strict');
const { createReportMailer } = require('../services/report-mailer');

const settings = {
  apiKey: 'test-key',
  targetEmail: 'reports@example.com',
  fromEmail: 'sender@example.com',
  apiUrl: 'https://api.resend.com/emails',
  timeoutMs: 10000
};
const report = {
  id: 'report-id',
  latitude: 32.9194,
  longitude: 35.3956,
  reporterName: 'Alex',
  incidentTime: '2026-09-15T06:00:00.000Z',
  submittedAt: '2026-09-15T07:00:00.000Z',
  message: 'Bin is full. <b>Plain text only.</b>'
};

test('mailer uses only the configured destination and sends report fields as plain text', async (t) => {
  const fetchMock = t.mock.fn(async () => ({ ok: true, json: async () => ({ id: 'email-id' }) }));
  const mailer = createReportMailer(settings, fetchMock);
  assert.equal(mailer.configured, true);
  assert.equal(await mailer.send({ ...report, to: 'unwanted@example.com' }), 'email-id');
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, settings.apiUrl);
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, 'Bearer test-key');
  assert.equal(options.headers['Idempotency-Key'], report.id);
  assert.ok(options.signal instanceof AbortSignal);
  const body = JSON.parse(options.body);
  assert.deepEqual(body.to, [settings.targetEmail]);
  assert.equal(body.from, settings.fromEmail);
  assert.equal(body.subject, 'EcoDrop map incident report');
  for (const value of [report.id, report.reporterName, report.incidentTime, report.submittedAt, report.message, '32.9194', '35.3956']) {
    assert.ok(body.text.includes(value));
  }
  assert.equal(body.html, undefined);
  assert.equal(body.attachments, undefined);
});

test('mailer attaches uploaded bytes, never a URL or filesystem path', async () => {
  let payload;
  const mailer = createReportMailer(settings, async (url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ id: 'email-id' }) };
  });
  const buffer = Buffer.from('image bytes');
  await mailer.send({ ...report, image: { filename: 'report-image.png', contentType: 'image/png', buffer } });
  assert.deepEqual(payload.attachments, [{
    filename: 'report-image.png', content: buffer.toString('base64'), content_type: 'image/png'
  }]);
});

for (const override of [
  { apiKey: '' }, { targetEmail: '' }, { fromEmail: '' },
  { targetEmail: 'a@example.com,b@example.com' }, { fromEmail: 'not-an-email' }
]) {
  test(`mailer rejects missing/invalid configuration ${Object.keys(override)[0]}`, async (t) => {
    const fetchMock = t.mock.fn();
    const mailer = createReportMailer({ ...settings, ...override }, fetchMock);
    assert.equal(mailer.configured, false);
    await assert.rejects(mailer.send(report), /configuration is missing or invalid/);
    assert.equal(fetchMock.mock.callCount(), 0);
  });
}

for (const status of [401, 403, 429, 500]) {
  test(`mailer surfaces provider HTTP ${status} for background logging`, async () => {
    const mailer = createReportMailer(settings, async () => ({ ok: false, status }));
    await assert.rejects(mailer.send(report), new RegExp(`HTTP ${status}`));
  });
}

test('mailer surfaces network and timeout failures', async () => {
  const mailer = createReportMailer(settings, async () => { throw new Error('Network timeout'); });
  await assert.rejects(mailer.send(report), /Network timeout/);
});

test('mailer enforces its configured HTTP deadline', { timeout: 3000 }, async () => {
  const mailer = createReportMailer({ ...settings, timeoutMs: 10 }, (url, options) => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(() => reject(new Error('Abort signal was not triggered')), 1000);
    options.signal.addEventListener('abort', () => {
      clearTimeout(keepAlive);
      reject(options.signal.reason);
    }, { once: true });
  }));
  await assert.rejects(mailer.send(report), error => error.name === 'TimeoutError');
});

test('mailer rejects success-shaped responses with no email ID', async () => {
  const mailer = createReportMailer(settings, async () => ({ ok: true, json: async () => ({}) }));
  await assert.rejects(mailer.send(report), /no message ID/);
});
