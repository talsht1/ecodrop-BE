const swaggerJsdoc = require('swagger-jsdoc');
const path = require('node:path');
const { BIN_TYPE_SCHEMA, CREATE_BIN_SCHEMA } = require('./schemas/bin');
const pkg = require('../package.json');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EcoDrop API',
      version: pkg.version,
      description: 'Nearest recycling bin lookup API powered by PostGIS.'
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server'
      }
    ],
    components: {
      schemas: {
        CreateBinRequest: CREATE_BIN_SCHEMA,
        Bin: {
          type: 'object',
          required: ['id', 'name', 'address', 'type', 'latitude', 'longitude'],
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            address: {
              type: 'string',
              nullable: true,
              minLength: 1,
              description: 'Display address for the map popup; null if unknown.',
              example: 'Central Park, New York, NY'
            },
            type: {
              ...BIN_TYPE_SCHEMA,
              example: 'paper'
            },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            distanceMeters: { type: 'number' }
          }
        },
        NearestBinResponse: {
          type: 'object',
          required: ['nearestBin', 'latitude', 'longitude', 'distanceMeters'],
          properties: {
            nearestBin: {
              allOf: [
                { $ref: '#/components/schemas/Bin' },
                { type: 'object', required: ['distanceMeters'] }
              ]
            },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            distanceMeters: { type: 'number' }
          }
        },
        ErrorResponse: {
          type: 'object',
          required: ['error'],
          properties: {
            error: { type: 'string' }
          }
        },
        Identity: {
          type: 'object',
          required: ['name', 'version', 'environment'],
          properties: {
            name: { type: 'string', example: pkg.name },
            version: { type: 'string', example: pkg.version },
            environment: { type: 'string', example: 'development' }
          }
        },
        Health: {
          type: 'object',
          required: ['status', 'service', 'version', 'uptimeSeconds'],
          properties: {
            status: { type: 'string', enum: ['ok'] },
            service: { type: 'string', example: pkg.name },
            version: { type: 'string', example: pkg.version },
            uptimeSeconds: { type: 'number', minimum: 0 }
          }
        },
        Readiness: {
          type: 'object',
          required: ['status', 'service', 'version', 'database'],
          properties: {
            status: { type: 'string', enum: ['ready', 'not_ready'] },
            service: { type: 'string', example: pkg.name },
            version: { type: 'string', example: pkg.version },
            database: {
              type: 'object',
              required: ['status', 'latencyMs', 'currentTime', 'serverVersion'],
              properties: {
                status: { type: 'string', enum: ['connected', 'disconnected'] },
                latencyMs: { type: 'number', description: 'Database probe duration in milliseconds.' },
                currentTime: { type: 'string', format: 'date-time', nullable: true },
                serverVersion: { type: 'string', nullable: true }
              }
            },
            error: { type: 'string', description: 'Present when the readiness probe fails.' }
          }
        }
      }
    }
  },
  apis: [path.join(__dirname, 'server.js')]
};

module.exports = {
  swaggerSpec: swaggerJsdoc(options)
};
