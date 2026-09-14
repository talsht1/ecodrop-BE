const BIN_TYPES = Object.freeze([
  'glass',
  'paper',
  'plastic',
  'metal',
  'electronics',
  'mixed'
]);

const CREATE_BIN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'latitude', 'longitude'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255, pattern: '\\S', description: 'Trimmed before storage.' },
    address: { type: 'string', nullable: true, minLength: 1, pattern: '\\S', default: null, description: 'Trimmed before storage; omit or use null if unknown.' },
    type: { type: 'string', nullable: true, enum: [...BIN_TYPES, null], default: null },
    latitude: { type: 'number', minimum: -90, maximum: 90 },
    longitude: { type: 'number', minimum: -180, maximum: 180 }
  }
};

module.exports = { BIN_TYPES, CREATE_BIN_SCHEMA };
