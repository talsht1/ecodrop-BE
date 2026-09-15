const BIN_TYPE_DESCRIPTIONS = Object.freeze({
  general_waste: 'Green Bin: general / mixed municipal waste.',
  packaging: 'Orange Packaging Bin: plastic, metal, and beverage carton packaging.',
  glass: 'Purple Glass Bin: glass bottles and food jars.',
  paper: 'Blue Paper Bin: newspapers, magazines, and office paper.',
  textile: 'Textile Bin: used clothing, shoes, and fabrics.',
  electronics: 'Electronics / E-Waste Bin: small electronic appliances and devices.',
  cardboard: 'Cardboard Cage / Bin: large flattened cardboard boxes.',
  bulky_waste: 'Bulky Waste Container: large items like old furniture and mattresses.',
  bottle_recycling_machine: 'Bottle Recycling Machine: reverse vending machine (RVM) for deposit bottles.',
  yard_waste: 'Yard Waste / Pruning: tree branches, leaves, and garden trimmings.'
});
const BIN_TYPES = Object.freeze(Object.keys(BIN_TYPE_DESCRIPTIONS));
const BIN_TYPE_SCHEMA = {
  type: 'string',
  nullable: true,
  enum: [...BIN_TYPES, null],
  description: [
    'Stable map icon key; null means unknown (use a generic icon).',
    ...Object.entries(BIN_TYPE_DESCRIPTIONS).map(([key, description]) => `- ${key}: ${description}`)
  ].join('\n')
};

const CREATE_BIN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'latitude', 'longitude'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255, pattern: '\\S', description: 'Trimmed before storage.' },
    address: { type: 'string', nullable: true, minLength: 1, pattern: '\\S', default: null, description: 'Trimmed before storage; omit or use null if unknown.' },
    type: { ...BIN_TYPE_SCHEMA, default: null },
    latitude: { type: 'number', minimum: -90, maximum: 90 },
    longitude: { type: 'number', minimum: -180, maximum: 180 }
  }
};

module.exports = { BIN_TYPES, BIN_TYPE_SCHEMA, CREATE_BIN_SCHEMA };
