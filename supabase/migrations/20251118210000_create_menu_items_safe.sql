-- Migration to create menu_items table with safety checks
-- This migration will skip if tables already exist

-- Create menu_items table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                  WHERE table_schema = 'public' 
                  AND table_name = 'menu_items') THEN
        
        CREATE TABLE menu_items (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            category VARCHAR(50) NOT NULL CHECK (category IN ('entradas', 'nigiri', 'roll', 'bebida', 'postre')),
            price DECIMAL(10,2) NOT NULL CHECK (price > 0),
            description TEXT,
            pairing_notes TEXT,
            is_available BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create index for better performance on category queries
        CREATE INDEX idx_menu_items_category ON menu_items(category);
        
        -- Create index for availability queries
        CREATE INDEX idx_menu_items_available ON menu_items(is_available);
        
        -- Create trigger for updated_at
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER update_menu_items_updated_at
            BEFORE UPDATE ON menu_items
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();

        -- Enable RLS
        ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies
        CREATE POLICY "Anyone can view available menu items" ON menu_items
            FOR SELECT USING (is_available = true);

        CREATE POLICY "Anyone can view all menu items" ON menu_items
            FOR SELECT USING (true);

        RAISE NOTICE 'menu_items table created successfully';
    ELSE
        RAISE NOTICE 'menu_items table already exists, skipping creation';
    END IF;
END $$;