const multer = require('multer');
const { REPORT_SCHEMA, REPORT_IMAGE_LIMIT, REPORT_IMAGE_TYPES } = require('../schemas/report');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: REPORT_IMAGE_LIMIT, files: 1, fields: 5, parts: 6, fieldSize: 40000, fieldNameSize: 100 },
  fileFilter(req, file, callback) {
    if (!Object.hasOwn(REPORT_IMAGE_TYPES, file.mimetype)) {
      const error = new Error('Image must be JPEG, PNG, or WebP.');
      error.code = 'UNSUPPORTED_IMAGE_TYPE';
      return callback(error);
    }
    return callback(null, true);
  }
}).single('image');

function parseReportUpload(req, res, next) {
  if (!req.is('multipart/form-data')) {
    return res.status(415).json({ error: 'Content-Type must be multipart/form-data.' });
  }
  return upload(req, res, error => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Image must not exceed 5 MiB.' });
    }
    if (error.code === 'LIMIT_FIELD_VALUE') {
      return res.status(413).json({ error: 'Report text field is too large.' });
    }
    if (error.code === 'UNSUPPORTED_IMAGE_TYPE') {
      return res.status(415).json({ error: error.message });
    }
    return res.status(400).json({ error: 'Invalid multipart report. Send each field once and at most one image.' });
  });
}

function isIncidentTime(value) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1] && Number.isFinite(Date.parse(value));
}

function matchesImageType(file) {
  const buffer = file.buffer;
  if (file.mimetype === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (file.mimetype === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
}

function validateReport(req, res, next) {
  const body = req.body || {};
  for (const field of Object.keys(body)) {
    if (field === 'image' || !Object.hasOwn(REPORT_SCHEMA.properties, field)) {
      return res.status(400).json({ error: `Unexpected report field: ${field}.` });
    }
    if (typeof body[field] !== 'string') {
      return res.status(400).json({ error: `${field} must be a single text field.` });
    }
  }

  const report = {};
  for (const field of ['latitude', 'longitude']) {
    const value = body[field]?.trim();
    if (!value) return res.status(400).json({ error: `${field} is required.` });
    const number = Number(value);
    const schema = REPORT_SCHEMA.properties[field];
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ||
        !Number.isFinite(number) || number < schema.minimum || number > schema.maximum) {
      return res.status(400).json({ error: `${field} must be a number between ${schema.minimum} and ${schema.maximum}.` });
    }
    report[field] = number;
  }

  for (const field of ['reporterName', 'message', 'incidentTime']) {
    const value = body[field]?.trim() || null;
    const maxLength = REPORT_SCHEMA.properties[field].maxLength || 64;
    if (value !== null && (value.includes('\0') || [...value].length > maxLength)) {
      return res.status(400).json({ error: `${field} must not contain null characters or exceed ${maxLength} characters.` });
    }
    report[field] = value;
  }
  if (report.incidentTime !== null) {
    if (!isIncidentTime(report.incidentTime)) {
      return res.status(400).json({ error: 'incidentTime must be a valid RFC 3339 timestamp including timezone.' });
    }
    report.incidentTime = new Date(report.incidentTime).toISOString();
  }

  if (req.file) {
    if (!matchesImageType(req.file)) {
      return res.status(400).json({ error: 'Image content does not match its JPEG, PNG, or WebP content type.' });
    }
    report.image = {
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      filename: `report-image.${REPORT_IMAGE_TYPES[req.file.mimetype]}`
    };
  }
  res.locals.report = report;
  return next();
}

module.exports = { parseReportUpload, validateReport };
