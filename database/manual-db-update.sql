-- Manual database update for multi-schema support
-- Add schema_name and is_active columns to user_schemas table

-- First check if columns exist
DO $$ 
BEGIN 
    -- Add schema_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_schemas' 
        AND column_name = 'schema_name'
    ) THEN
        ALTER TABLE user_schemas ADD COLUMN schema_name TEXT DEFAULT 'Mijn Trainingsschema';
    END IF;
    
    -- Add is_active column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_schemas' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE user_schemas ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Set all existing schemas to active with default name
UPDATE user_schemas 
SET is_active = true, schema_name = COALESCE(schema_name, 'Mijn Trainingsschema')
WHERE is_active IS NULL OR schema_name IS NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_schemas_active ON user_schemas(user_id, is_active) WHERE is_active = true;