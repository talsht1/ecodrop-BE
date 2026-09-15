ALTER TABLE bins DROP CONSTRAINT IF EXISTS bins_type_allowed;

UPDATE bins
SET type = CASE type
    WHEN 'mixed' THEN 'general_waste'
    WHEN 'plastic' THEN 'packaging'
    WHEN 'metal' THEN 'packaging'
END
WHERE type IN ('mixed', 'plastic', 'metal');

ALTER TABLE bins ADD CONSTRAINT bins_type_allowed CHECK (
    type IN (
        'general_waste',
        'packaging',
        'glass',
        'paper',
        'textile',
        'electronics',
        'cardboard',
        'bulky_waste',
        'bottle_recycling_machine',
        'yard_waste'
    )
);
