-- Check-in instructions stored at property level (template for all bookings)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS checkin_instructions TEXT;
