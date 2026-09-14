ALTER TABLE bins
    ADD COLUMN IF NOT EXISTS address TEXT
        CONSTRAINT bins_address_nonblank CHECK (address ~ '[^[:space:]]'),
    ADD COLUMN IF NOT EXISTS type VARCHAR(32)
        CONSTRAINT bins_type_allowed CHECK (
            type IN ('glass', 'paper', 'plastic', 'metal', 'electronics', 'mixed')
        );

-- Only backfill the original mock records, without overwriting supplied metadata.
UPDATE bins AS b
SET address = COALESCE(b.address, v.address),
    type = COALESCE(b.type, v.type)
FROM (VALUES
    ('Downtown Recycling Hub', -73.9857, 40.7484, '350 Fifth Avenue, New York, NY', 'mixed'),
    ('Central Park Collection Point', -73.9654, 40.7829, 'Central Park, New York, NY', 'paper'),
    ('Hudson Yards Recycle Station', -74.0021, 40.7536, 'Hudson Yards, New York, NY', 'glass')
) AS v(name, longitude, latitude, address, type)
WHERE b.name = v.name
    AND ST_Equals(b.location, ST_SetSRID(ST_MakePoint(v.longitude, v.latitude), 4326));
