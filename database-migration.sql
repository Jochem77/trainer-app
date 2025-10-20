-- Add schema_name and is_active columns to user_schemas table
-- This script is safe to run multiple times

DO $$ 
BEGIN 
    -- Add schema_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_schemas' 
        AND column_name = 'schema_name'
    ) THEN
        ALTER TABLE user_schemas ADD COLUMN schema_name VARCHAR(255) DEFAULT 'Mijn Trainingsschema';
        RAISE NOTICE 'Added schema_name column';
    ELSE
        RAISE NOTICE 'schema_name column already exists';
    END IF;
    
    -- Add is_active column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_schemas' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE user_schemas ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added is_active column';
    ELSE
        RAISE NOTICE 'is_active column already exists';
    END IF;
END $$;

-- Update existing records to have proper schema_name and is_active values
UPDATE user_schemas 
SET 
    schema_name = COALESCE(schema_name, 'Mijn Trainingsschema'),
    is_active = COALESCE(is_active, true)
WHERE schema_name IS NULL OR is_active IS NULL;

-- Extract embedded schema names from JSON and update database column
UPDATE user_schemas 
SET schema_name = (schema_data->>'schema_name')
WHERE schema_data ? 'schema_name' 
AND (schema_data->>'schema_name') IS NOT NULL 
AND (schema_data->>'schema_name') != '';

-- Clean up JSON data - remove embedded schema_name and extract weeks
UPDATE user_schemas 
SET schema_data = (schema_data->'weeks')
WHERE schema_data ? 'weeks' 
AND schema_data ? 'schema_name';

-- Add unique constraint on user_id and schema_name if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_schemas_user_id_schema_name_key'
    ) THEN
        ALTER TABLE user_schemas ADD CONSTRAINT user_schemas_user_id_schema_name_key UNIQUE (user_id, schema_name);
        RAISE NOTICE 'Added unique constraint on user_id, schema_name';
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
END $$;

-- Create index for better performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_user_schemas_active ON user_schemas(user_id, is_active) WHERE is_active = true;

RAISE NOTICE 'Database migration completed successfully';