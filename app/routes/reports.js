const { Router } = require('express');
const { randomUUID } = require('node:crypto');
const { parseReportUpload, validateReport } = require('../middleware/validate-report');
const { createReportMailer } = require('../services/report-mailer');

function createReportsRouter({ mailer = createReportMailer(), logger = console } = {}) {
  const router = Router();

  /**
   * @openapi
   * /api/reports:
   *   post:
   *     summary: Submit a map incident report for background email delivery
   *     description: Requires only the clicked location. Responds after upload/validation without waiting for email delivery. Best effort only; a 200 response does not guarantee delivery.
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             $ref: '#/components/schemas/ReportRequest'
   *           encoding:
   *             image:
   *               contentType: image/jpeg, image/png, image/webp
   *     responses:
   *       200:
   *         description: Report accepted for background dispatch
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ReportSubmitted'
   *       400:
   *         description: Invalid fields, duplicate fields, image signature, or multipart data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       413:
   *         description: Image exceeds 5 MiB or a text field exceeds its upload limit
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       415:
   *         description: Expected multipart/form-data with an optional JPEG, PNG, or WebP image
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       503:
   *         description: Report email configuration is unavailable
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.post('/', parseReportUpload, validateReport, (req, res) => {
    if (!mailer.configured) {
      logger.error('Report email configuration is missing or invalid.');
      return res.status(503).json({ error: 'Report email service is not configured.' });
    }

    const report = {
      ...res.locals.report,
      id: randomUUID(),
      submittedAt: new Date().toISOString()
    };
    res.status(200).json({ success: true, message: 'Report submitted successfully' });
    setImmediate(async () => {
      try {
        await mailer.send(report);
      } catch (error) {
        logger.error('Report email dispatch failed', {
          reportId: report.id,
          error: error instanceof Error ? error.message : 'Unknown email dispatch error'
        });
      }
    });
  });

  return router;
}

module.exports = { createReportsRouter };
