const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const swaggerUi = require('swagger-ui-express');
const pkg = require('../package.json');
const config = require('./config');
const { swaggerSpec } = require('./swagger');
const { BIN_TYPES } = require('./schemas/bin');

function parseCoordinate(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${name} is required.`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return parsed;
}

function validateCoordinates(lat, lng) {
  if (lat < -90 || lat > 90) {
    throw new Error('lat must be between -90 and 90.');
  }

  if (lng < -180 || lng > 180) {
    throw new Error('lng must be between -180 and 180.');
  }
}

function validateNearestBinQuery(req, res, next) {
  try {
    const lat = parseCoordinate(req.query.lat, 'lat');
    const lng = parseCoordinate(req.query.lng, 'lng');
    validateCoordinates(lat, lng);
    req.nearestBinQuery = { lat, lng };
    return next();
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

function validateBinRecord(bin) {
  if (!bin || typeof bin !== 'object') {
    throw new Error('Invalid bin record returned from database.');
  }

  const id = Number(bin.id);
  if (!Number.isInteger(id) || id < 0) {
    throw new Error('Invalid bin id returned from database.');
  }

  if (typeof bin.name !== 'string' || !bin.name.trim()) {
    throw new Error('Invalid bin name returned from database.');
  }

  if (bin.address !== null && (typeof bin.address !== 'string' || !bin.address.trim())) {
    throw new Error('Invalid bin address returned from database.');
  }

  if (bin.type !== null && !BIN_TYPES.includes(bin.type)) {
    throw new Error('Invalid bin type returned from database.');
  }

  const latitude = Number(bin.latitude);
  const longitude = Number(bin.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Invalid bin coordinates returned from database.');
  }

  validateCoordinates(latitude, longitude);

  return {
    id,
    name: bin.name.trim(),
    address: bin.address === null ? null : bin.address.trim(),
    type: bin.type,
    latitude,
    longitude
  };
}

function createApp({ pool } = {}) {
  const app = express();
  const databasePool = pool || new Pool({ connectionString: config.database.url });

  app.use(cors({ origin: config.cors.origin === '*' ? true : config.cors.origin }));
  app.use(express.json());

  app.use('/docs', swaggerUi.serve);
  app.get('/docs', swaggerUi.setup(swaggerSpec));

  /**
   * @openapi
   * /whoami:
   *   get:
   *     summary: Application identity
   *     responses:
   *       200:
   *         description: Service name, version, and environment
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Identity'
   */
  app.get('/whoami', (req, res) => {
    res.json({
      name: pkg.name,
      version: pkg.version,
      environment: config.app.env
    });
  });

  /**
   * @openapi
   * /health:
   *   get:
   *     summary: Process liveness (does not query the database)
   *     responses:
   *       200:
   *         description: API is healthy
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Health'
   */
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: pkg.name,
      version: pkg.version,
      uptimeSeconds: Number(process.uptime().toFixed(2))
    });
  });

  /**
   * @openapi
   * /ready:
   *   get:
   *     summary: Database readiness, query timing, and PostgreSQL version
   *     responses:
   *       200:
   *         description: Database is reachable
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Readiness'
   *       503:
   *         description: Database readiness check failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Readiness'
   */
  app.get('/ready', async (req, res) => {
    const startedAt = Date.now();

    try {
      const result = await databasePool.query(
        'SELECT NOW() AS current_time, version() AS server_version;'
      );
      const dbInfo = result.rows[0] || {};
      const latencyMs = Date.now() - startedAt;

      res.json({
        status: 'ready',
        service: pkg.name,
        version: pkg.version,
        database: {
          status: 'connected',
          latencyMs,
          currentTime: dbInfo.current_time || null,
          serverVersion: dbInfo.server_version || null
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'not_ready',
        service: pkg.name,
        version: pkg.version,
        database: {
          status: 'disconnected',
          latencyMs: Date.now() - startedAt,
          currentTime: null,
          serverVersion: null
        },
        error: 'Database readiness check failed.'
      });
    }
  });

  /**
   * @openapi
   * /api/bins:
   *   get:
   *     summary: List all recycling bins
   *     responses:
   *       200:
   *         description: A collection of bins
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Bin'
   *       500:
   *         description: Database query or bin data validation failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get('/api/bins', async (req, res, next) => {
    try {
      const result = await databasePool.query(
        `SELECT id, name, address, type, ST_X(location::geometry) AS longitude, ST_Y(location::geometry) AS latitude FROM bins ORDER BY id ASC;`
      );

      const bins = result.rows.map((bin) => validateBinRecord(bin));
      return res.json(bins);
    } catch (error) {
      if (error.message && error.message.includes('Invalid bin')) {
        return res.status(500).json({ error: error.message });
      }

      next(error);
      return null;
    }
  });

  /**
   * @openapi
   * /api/bins/nearest:
   *   get:
   *     summary: Find the nearest recycling bin
   *     parameters:
   *       - in: query
   *         name: lat
   *         required: true
   *         schema:
   *           type: number
   *           minimum: -90
   *           maximum: 90
   *         description: Latitude in decimal degrees
   *       - in: query
   *         name: lng
   *         required: true
   *         schema:
   *           type: number
   *           minimum: -180
   *           maximum: 180
   *         description: Longitude in decimal degrees
   *     responses:
   *       200:
   *         description: The nearest recycling bin
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NearestBinResponse'
   *       400:
   *         description: Invalid latitude or longitude
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: No recycling bins were found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Database query or bin data validation failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get('/api/bins/nearest', validateNearestBinQuery, async (req, res, next) => {
    try {
      const { lat, lng } = req.nearestBinQuery;

      if (!databasePool) {
        return res.status(500).json({ error: 'Database connection pool is not configured.' });
      }

      const result = await databasePool.query(
        `
          SELECT
            id,
            name,
            address,
            type,
            ST_X(location::geometry) AS longitude,
            ST_Y(location::geometry) AS latitude,
            ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
          FROM bins
          ORDER BY location <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
          LIMIT 1;
        `,
        [lng, lat]
      );

      const bin = result.rows[0];
      if (!bin) {
        return res.status(404).json({ error: 'No recycling bins were found.' });
      }

      const validatedBin = validateBinRecord(bin);

      const distanceMeters = Number(bin.distance_meters);
      if (!Number.isFinite(distanceMeters)) {
        throw new Error('Invalid distance returned from database.');
      }

      const responsePayload = {
        nearestBin: {
          ...validatedBin,
          distanceMeters
        },
        latitude: lat,
        longitude: lng,
        distanceMeters
      };

      return res.json(responsePayload);
    } catch (error) {
      if (
        error.message &&
        (error.message.includes('required') ||
          error.message.includes('must be a valid number') ||
          error.message.includes('must be between'))
      ) {
        return res.status(400).json({ error: error.message });
      }

      if (error.message && error.message.includes('Invalid')) {
        return res.status(500).json({ error: error.message });
      }

      next(error);
      return null;
    }
  });

  app.use((err, req, res, next) => {
    console.error(err);
    const message = err && err.message ? err.message : 'Failed to fetch nearest recycling bin.';
    res.status(500).json({
      error: message
    });
  });

  return app;
}

const pool = new Pool({ connectionString: config.database.url });

if (require.main === module) {
  const app = createApp({ pool });
  app.listen(config.app.port, () => {
    console.log(`EcoDrop API listening on port ${config.app.port}`);
  });
}

module.exports = {
  createApp,
  pool
};
