CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS bins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS bins_location_gist_idx
    ON bins USING GIST (location);

INSERT INTO bins (name, location)
VALUES
    ('Downtown Recycling Hub', ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326)),
    ('Central Park Collection Point', ST_SetSRID(ST_MakePoint(-73.9654, 40.7829), 4326)),
    ('Hudson Yards Recycle Station', ST_SetSRID(ST_MakePoint(-74.0021, 40.7536), 4326));
