-- Add weight_kg column to user_schemas table
-- Used to personalize the estimated calorie burn per training week (ACSM metabolic equations)
ALTER TABLE user_schemas
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC DEFAULT 75;

-- Update existing records to have the default weight
UPDATE user_schemas
SET weight_kg = 75
WHERE weight_kg IS NULL;

-- Add comment to column
COMMENT ON COLUMN user_schemas.weight_kg IS 'Body weight (kg) of the user, used for calorie estimates';
