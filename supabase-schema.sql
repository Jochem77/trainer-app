-- Create user_schemas table for storing custom training schemas
CREATE TABLE user_schemas (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    schema_name VARCHAR(255) NOT NULL DEFAULT 'Mijn Trainingsschema',
    schema_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, schema_name)
);

-- Enable Row Level Security
ALTER TABLE user_schemas ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only access their own schemas
CREATE POLICY "Users can manage their own schemas" ON user_schemas
    FOR ALL USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_user_schemas_user_id ON user_schemas(user_id);
CREATE INDEX idx_user_schemas_active ON user_schemas(user_id, is_active) WHERE is_active = true;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_schemas_updated_at 
    BEFORE UPDATE ON user_schemas 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();