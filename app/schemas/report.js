const REPORT_IMAGE_LIMIT = 5 * 1024 * 1024;
const REPORT_IMAGE_TYPES = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
});

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['latitude', 'longitude'],
  properties: {
    latitude: { type: 'number', minimum: -90, maximum: 90, description: 'Clicked map latitude; sent as a decimal text field in FormData.' },
    longitude: { type: 'number', minimum: -180, maximum: 180, description: 'Clicked map longitude; sent as a decimal text field in FormData.' },
    reporterName: { type: 'string', maxLength: 200, description: 'Optional reporter name; empty text is treated as absent.' },
    incidentTime: { type: 'string', format: 'date-time', maxLength: 64, description: 'Optional RFC 3339 timestamp with timezone, e.g. 2026-09-15T09:00:00+03:00. Empty text is treated as absent.' },
    message: { type: 'string', maxLength: 10000, description: 'Optional free text; empty text is treated as absent.' },
    image: { type: 'string', format: 'binary', description: 'Optional single JPEG, PNG, or WebP image, at most 5 MiB (5,242,880 bytes).' }
  }
};

module.exports = { REPORT_SCHEMA, REPORT_IMAGE_LIMIT, REPORT_IMAGE_TYPES };
