const config = require('../config');

function createReportMailer(settings = config.reports, fetchImpl = fetch) {
  const targetEmail = settings.targetEmail.trim();
  const fromEmail = settings.fromEmail.trim();
  const apiKey = settings.apiKey.trim();
  const isSingleEmail = value => /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(value);
  const configured = Boolean(apiKey && isSingleEmail(targetEmail) && isSingleEmail(fromEmail));

  return {
    configured,
    async send(report) {
      if (!configured) throw new Error('Report email configuration is missing or invalid.');
      const text = [
        `Report ID: ${report.id}`,
        `Submitted at: ${report.submittedAt}`,
        `Latitude: ${report.latitude}`,
        `Longitude: ${report.longitude}`,
        `Reporter: ${report.reporterName || 'Not provided'}`,
        `Incident time: ${report.incidentTime || 'Not provided'}`,
        '',
        'Message:',
        report.message || 'Not provided'
      ].join('\n');
      const payload = {
        from: fromEmail,
        to: [targetEmail],
        subject: 'EcoDrop map incident report',
        text
      };
      if (report.image) {
        payload.attachments = [{
          filename: report.image.filename,
          content: report.image.buffer.toString('base64'),
          content_type: report.image.contentType
        }];
      }

      const response = await fetchImpl(settings.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': report.id
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(settings.timeoutMs)
      });
      if (!response.ok) throw new Error(`Report email provider returned HTTP ${response.status}.`);
      const result = await response.json();
      if (typeof result?.id !== 'string' || !result.id) {
        throw new Error('Report email provider returned no message ID.');
      }
      return result.id;
    }
  };
}

module.exports = { createReportMailer };
