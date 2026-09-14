const { CREATE_BIN_SCHEMA } = require('../schemas/bin');

function validateCreateBin(req, res, next) {
  if (!req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json.' });
  }

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Body must be a JSON object.' });
  }

  for (const field of Object.keys(body)) {
    if (!Object.hasOwn(CREATE_BIN_SCHEMA.properties, field)) {
      return res.status(400).json({ error: `Unknown field: ${field}.` });
    }
  }

  const validated = {};
  for (const [field, schema] of Object.entries(CREATE_BIN_SCHEMA.properties)) {
    let value = body[field];
    if (value === undefined || value === null) {
      if (CREATE_BIN_SCHEMA.required.includes(field)) {
        return res.status(400).json({ error: `${field} is required.` });
      }
      validated[field] = null;
      continue;
    }

    if (schema.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return res.status(400).json({ error: `${field} must be a finite JSON number.` });
      }
      if (value < schema.minimum || value > schema.maximum) {
        return res.status(400).json({ error: `${field} must be between ${schema.minimum} and ${schema.maximum}.` });
      }
    } else {
      if (typeof value !== 'string' || value.includes('\0')) {
        return res.status(400).json({ error: `${field} must be a string without null characters.` });
      }
      if (schema.enum) {
        if (!schema.enum.includes(value)) {
          return res.status(400).json({ error: `${field} must be one of: ${schema.enum.filter(item => item !== null).join(', ')}.` });
        }
      } else {
        value = value.trim();
        const length = [...value].length;
        if (length < schema.minLength || (schema.maxLength !== undefined && length > schema.maxLength)) {
          return res.status(400).json({ error: `${field} must be nonblank${schema.maxLength ? ` and at most ${schema.maxLength} characters` : ''}.` });
        }
      }
    }
    validated[field] = value;
  }

  res.locals.createBin = validated;
  return next();
}

module.exports = { validateCreateBin };
