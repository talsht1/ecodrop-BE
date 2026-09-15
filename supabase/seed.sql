INSERT INTO bins (name, address, type, location)
SELECT v.name, v.address, v.type, v.location
FROM (
  VALUES
    ('Downtown Recycling Hub', '350 Fifth Avenue, New York, NY', 'general_waste', ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326)),
    ('Central Park Collection Point', 'Central Park, New York, NY', 'paper', ST_SetSRID(ST_MakePoint(-73.9654, 40.7829), 4326)),
    ('Hudson Yards Recycle Station', 'Hudson Yards, New York, NY', 'glass', ST_SetSRID(ST_MakePoint(-74.0021, 40.7536), 4326)),
    ('Battery Park Glass Point', 'The Battery, New York, NY', 'glass', ST_SetSRID(ST_MakePoint(-74.0170, 40.7033), 4326)),
    ('City Hall Paper Point', 'City Hall Park, New York, NY', 'paper', ST_SetSRID(ST_MakePoint(-74.0060, 40.7127), 4326)),
    ('Union Square Plastic Point', 'Union Square Park, New York, NY', 'packaging', ST_SetSRID(ST_MakePoint(-73.9911, 40.7359), 4326)),
    ('Washington Square Mixed Point', 'Washington Square Park, New York, NY', 'general_waste', ST_SetSRID(ST_MakePoint(-73.9973, 40.7308), 4326)),
    ('Flatiron Metal Point', '175 Fifth Avenue, New York, NY', 'packaging', ST_SetSRID(ST_MakePoint(-73.9897, 40.7411), 4326)),
    ('Times Square Electronics Point', 'Broadway and West 45th Street, New York, NY', 'electronics', ST_SetSRID(ST_MakePoint(-73.9855, 40.7580), 4326)),
    ('Bryant Park Paper Point', 'Bryant Park, New York, NY', 'paper', ST_SetSRID(ST_MakePoint(-73.9832, 40.7536), 4326)),
    ('Columbus Circle Glass Point', 'Columbus Circle, New York, NY', 'glass', ST_SetSRID(ST_MakePoint(-73.9819, 40.7681), 4326)),
    ('Lincoln Center Plastic Point', 'Lincoln Center Plaza, New York, NY', 'packaging', ST_SetSRID(ST_MakePoint(-73.9835, 40.7725), 4326)),
    ('Museum Mile Metal Point', '1000 Fifth Avenue, New York, NY', 'packaging', ST_SetSRID(ST_MakePoint(-73.9632, 40.7794), 4326)),
    ('Madison Square Mixed Point', 'Madison Square Park, New York, NY', 'general_waste', ST_SetSRID(ST_MakePoint(-73.9880, 40.7420), 4326)),
    ('Harlem Electronics Point', '253 West 125th Street, New York, NY', 'electronics', ST_SetSRID(ST_MakePoint(-73.9500, 40.8100), 4326)),
    ('Morningside Heights Plastic Point', '116th Street and Broadway, New York, NY', 'packaging', ST_SetSRID(ST_MakePoint(-73.9626, 40.8075), 4326)),
    ('Fort Tryon Metal Point', 'Fort Tryon Park, New York, NY', 'packaging', ST_SetSRID(ST_MakePoint(-73.9313, 40.8617), 4326)),
    ('Inwood Electronics Point', 'Inwood Hill Park, New York, NY', 'electronics', ST_SetSRID(ST_MakePoint(-73.9218, 40.8726), 4326)),
    -- Illustrative positions around Kibbutz Moran, not verified recycling facilities.
    ('Moran Mixed Demo Point', 'Mock location 1, Moran, Misgav, Israel', 'general_waste', ST_SetSRID(ST_MakePoint(35.3956, 32.9194), 4326)),
    ('Moran Glass Demo Point', 'Mock location 2, Moran, Misgav, Israel', 'glass', ST_SetSRID(ST_MakePoint(35.3945, 32.9198), 4326)),
    ('Moran Paper Demo Point', 'Mock location 3, Moran, Misgav, Israel', 'paper', ST_SetSRID(ST_MakePoint(35.3965, 32.9200), 4326)),
    ('Moran Plastic Demo Point', 'Mock location 4, Moran, Misgav, Israel', 'packaging', ST_SetSRID(ST_MakePoint(35.3950, 32.9186), 4326)),
    ('Moran Metal Demo Point', 'Mock location 5, Moran, Misgav, Israel', 'packaging', ST_SetSRID(ST_MakePoint(35.3970, 32.9190), 4326)),
    ('Moran Electronics Demo Point', 'Mock location 6, Moran, Misgav, Israel', 'electronics', ST_SetSRID(ST_MakePoint(35.3940, 32.9190), 4326)),
    -- Illustrative positions around Almagor, not verified recycling facilities.
    ('Almagor Mixed Demo Point', 'Mock location 1, Almagor, Emek HaYarden, Israel', 'general_waste', ST_SetSRID(ST_MakePoint(35.6021, 32.9125), 4326)),
    ('Almagor Glass Demo Point', 'Mock location 2, Almagor, Emek HaYarden, Israel', 'glass', ST_SetSRID(ST_MakePoint(35.6012, 32.9130), 4326)),
    ('Almagor Paper Demo Point', 'Mock location 3, Almagor, Emek HaYarden, Israel', 'paper', ST_SetSRID(ST_MakePoint(35.6030, 32.9131), 4326)),
    ('Almagor Plastic Demo Point', 'Mock location 4, Almagor, Emek HaYarden, Israel', 'packaging', ST_SetSRID(ST_MakePoint(35.6015, 32.9118), 4326)),
    ('Almagor Metal Demo Point', 'Mock location 5, Almagor, Emek HaYarden, Israel', 'packaging', ST_SetSRID(ST_MakePoint(35.6032, 32.9120), 4326)),
    ('Almagor Electronics Demo Point', 'Mock location 6, Almagor, Emek HaYarden, Israel', 'electronics', ST_SetSRID(ST_MakePoint(35.6008, 32.9124), 4326))
) AS v(name, address, type, location)
WHERE NOT EXISTS (
  SELECT 1 FROM bins b WHERE b.name = v.name
);
