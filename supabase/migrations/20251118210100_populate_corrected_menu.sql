-- Migration to populate menu_items with corrected data from PDF
-- This will insert 30 sample items from our corrected menu data

-- Only proceed if menu_items table exists and is empty
DO $$
DECLARE
    menu_count INTEGER;
BEGIN
    -- Check if menu_items table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'menu_items') THEN
        
        -- Check if table is empty
        SELECT COUNT(*) INTO menu_count FROM menu_items;
        
        IF menu_count = 0 THEN
            -- Insert sample of corrected menu items (30 items)
            INSERT INTO menu_items (name, category, price, description, pairing_notes, is_available) VALUES
                -- Entradas (6 items)
                ('Queso Manchego', 'entradas', 132.0, 'Queso manchego servido con crackers', 'Sake seco o vino blanco', true),
                ('Edamames', 'entradas', 154.0, 'Frijol de soya salteado con toque de soya y picante', 'Sake seco o vino blanco', true),
                ('Kakuni', 'entradas', 176.0, 'Pierna de cerdo estilo chino, cocción lenta', 'Sake seco o cerveza ligera', true),
                ('Hottochire', 'entradas', 198.0, 'Camarón empanizado con salsa de chile dulce', 'Sake seco o vino blanco', true),
                ('Ebi Teriyaki', 'entradas', 209.0, 'Camarón con salsa teriyaki', 'Sake seco o vino blanco', true),
                ('Costillas', 'entradas', 231.0, 'Costillas de cerdo con salsa teriyaki', 'Sake seco o cerveza', true),

                -- Nigiri (5 items)
                ('Nigiri Salmón', 'nigiri', 88.0, 'Nigiri de salmón fresco (2 piezas)', 'Sake seco o vino blanco', true),
                ('Nigiri Atún', 'nigiri', 99.0, 'Nigiri de atún fresco (2 piezas)', 'Sake seco o vino blanco', true),
                ('Nigiri Ebi', 'nigiri', 88.0, 'Nigiri de camarón cocido (2 piezas)', 'Sake seco', true),
                ('Nigiri Kani', 'nigiri', 77.0, 'Nigiri de cangrejo (2 piezas)', 'Sake seco', true),
                ('Nigiri Tako', 'nigiri', 99.0, 'Nigiri de pulpo (2 piezas)', 'Sake seco', true),

                -- Roll (12 items)
                ('Tokyo Roll', 'roll', 253.0, 'Roll con aderezo de cilantro y salsa de anguila', 'Sake seco o cerveza ligera', true),
                ('Saitama Roll', 'roll', 264.0, 'Aguacate coronado de atún spicy y tobiko (65g)', 'Sake seco o cerveza ligera', true),
                ('Kyoto Roll', 'roll', 275.0, 'Camarón, queso crema, aguacate y tobiko', 'Sake seco o cerveza ligera', true),
                ('Okinawa Roll', 'roll', 286.0, 'Atún, queso crema, aguacate y salsa de anguila', 'Sake seco o cerveza ligera', true),
                ('Osaka Roll', 'roll', 297.0, 'Camarón tempura, queso crema, aguacate y salsa de anguila', 'Sake seco o cerveza ligera', true),
                ('Nagoya Roll', 'roll', 308.0, 'Camarón, queso crema, aguacate gratinado', 'Sake seco o cerveza ligera', true),
                ('Yokohama Roll', 'roll', 319.0, 'Camarón tempura, queso crema, cebolla cambray y salsa sweet', 'Sake seco o cerveza ligera', true),
                ('Kitakami Roll', 'roll', 330.0, 'Camarón tempura, queso crema, cebolla cambray y tobiko', 'Sake seco o cerveza ligera', true),
                ('Tokushima Roll', 'roll', 341.0, 'Camarón tempura, queso crema, cebolla cambray y salmón', 'Sake seco o cerveza ligera', true),
                ('Katsura Roll', 'roll', 352.0, 'Camarón tempura, queso crema, cebolla cambray y atún', 'Sake seco o cerveza ligera', true),
                ('Kokonatsu Roll', 'roll', 363.0, 'Camarón tempura, queso crema, cebolla cambray y atún spicy', 'Sake seco o cerveza ligera', true),
                ('Sanyugo Roll', 'roll', 374.0, 'Camarón tempura, queso crema, cebolla cambray y salmón spicy', 'Sake seco o cerveza ligera', true),

                -- Bebidas (6 items)
                ('Agua De Frutas', 'bebida', 80.0, 'Agua de frutas natural (1L)', 'Acompañamiento perfecto', true),
                ('Refresco', 'bebida', 55.0, 'Refresco nacional (600ml)', 'Acompañamiento perfecto', true),
                ('Limonada', 'bebida', 66.0, 'Limonada natural (1L)', 'Refrescante y natural', true),
                ('Jugo Natural', 'bebida', 66.0, 'Jugo natural de fruta (1L)', 'Refrescante y saludable', true),
                ('Té Helado', 'bebida', 55.0, 'Té helado japonés (500ml)', 'Tradición japonesa', true),
                ('Café', 'bebida', 44.0, 'Café americano', 'Final perfecto', true),

                -- Postres (1 item)
                ('Helado Frito', 'postre', 110.0, 'Helado de vainilla empanizado y frito', 'Postre único y delicioso', true);

            RAISE NOTICE 'Menu items populated successfully with 30 items';
        ELSE
            RAISE NOTICE 'menu_items table already contains data, skipping population';
        END IF;
    ELSE
        RAISE NOTICE 'menu_items table does not exist, skipping population';
    END IF;
END $$;