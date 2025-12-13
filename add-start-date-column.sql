-- Add start_date column to user_schemas table
ALTER TABLE user_schemas 
ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT '2025-08-31';

-- Update existing records to have the default start date
UPDATE user_schemas 
SET start_date = '2025-08-31' 
WHERE start_date IS NULL;

-- Add comment to column
COMMENT ON COLUMN user_schemas.start_date IS 'Start date of the training program for this schema';
