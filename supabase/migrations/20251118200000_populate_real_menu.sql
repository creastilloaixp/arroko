-- IKU Sushi Menu Items - Corrected Categorization (Sample)
-- Generated from PDF extraction and manual categorization

-- Clear existing test data if any
TRUNCATE TABLE menu_items RESTART IDENTITY;

-- Insert sample of corrected menu items (30 items)
INSERT INTO menu_items (name, category, price, description, pairing_notes, is_available) VALUES
    -- Entradas (6 items)
    ('Queso Manchego', 'entradas', 132.0, 'Queso manchego servido con crackers', 'Sake seco o vino blanco', true),
    ('Edamames', 'entradas', 154.0, 'Frijol de soya salteado con toque de soya y picante', 'Sake seco o vino blanco', true),
    ('Ceviche IKU', 'entradas', 320.0, 'Especial de la casa con pescado blanco marinado', 'Sake seco o vino blanco', true),
    ('Taco IKU', 'entradas', 132.0, 'Taco especial de la casa (30g c/u)', 'Sake seco o vino blanco', true),
    ('Vegetales Tempura', 'entradas', 165.0, 'Vegetales frescos en tempura crujiente', 'Sake seco o vino blanco', true),
    ('Camarón Tempura', 'entradas', 253.0, 'Camarón fresco en tempura dorado', 'Sake seco o vino blanco', true),
    
    -- Nigiri (5 items)
    ('Salmón Nigiri', 'nigiri', 295.0, 'Salmón fresco sobre arroz de sushi', 'Sake premium o vino blanco seco', true),
    ('Atún Nigiri', 'nigiri', 253.0, 'Atún fresco sobre arroz de sushi', 'Sake premium o vino blanco seco', true),
    ('Camarón Nigiri', 'nigiri', 199.0, 'Camarón fresco sobre arroz (80g)', 'Sake premium o vino blanco seco', true),
    ('3 Piezas Nigiri Mixto', 'nigiri', 242.0, 'Selección de 3 piezas de nigiri', 'Sake premium o vino blanco seco', true),
    ('5 Piezas Nigiri Mixto', 'nigiri', 300.0, 'Selección de 5 piezas de nigiri', 'Sake premium o vino blanco seco', true),
    
    -- Roll (12 items)
    ('Tokyo Roll', 'roll', 253.0, 'Roll con aderezo de cilantro y salsa de anguila', 'Sake seco o cerveza ligera', true),
    ('Saitama Roll', 'roll', 264.0, 'Aguacate coronado de atún spicy y tobiko (65g)', 'Sake seco o cerveza ligera', true),
    ('Tomorokoshi Roll', 'roll', 242.0, 'Gratinado con serrano, salsa de anguila y sriracha', 'Sake seco o cerveza ligera', true),
    ('Kitakami Roll', 'roll', 314.0, 'Roll con sweet chilli', 'Sake seco o cerveza ligera', true),
    ('Tanjiro Roll', 'roll', 280.0, 'Foie gras flameado con salsa de anguila', 'Sake seco o cerveza ligera', true),
    ('Tokushima Roll', 'roll', 264.0, 'Roll con aderezo spicy', 'Sake seco o cerveza ligera', true),
    ('Shiawase Roll', 'roll', 264.0, 'Crocante de camote y aguacate', 'Sake seco o cerveza ligera', true),
    ('Katsura Roll', 'roll', 275.0, 'Roll con sweet chilli', 'Sake seco o cerveza ligera', true),
    ('Sawayaka Roll', 'roll', 275.0, 'Tampico bañado con salsa agripicante', 'Sake seco o cerveza ligera', true),
    ('Kokonatsu Roll', 'roll', 264.0, 'Mango con toque de togarashi', 'Sake seco o cerveza ligera', true),
    ('Sanyugo Roll', 'roll', 310.0, 'Roll de aguacate', 'Sake seco o cerveza ligera', true),
    ('Sakura Roll', 'roll', 300.0, 'Aguacate coronado con masago', 'Sake seco o cerveza ligera', true),
    
    -- Bebidas (6 items)
    ('Agua De Frutas', 'bebida', 80.0, 'Agua de frutas natural (1L)', 'Acompañamiento perfecto', true),
    ('Refresco', 'bebida', 55.0, 'Refresco nacional (600ml)', 'Acompañamiento perfecto', true),
    ('Limonada', 'bebida', 80.0, 'Limonada natural (1L)', 'Acompañamiento perfecto', true),
    ('Sake Japonés', 'bebida', 250.0, 'Sake japonés tradicional (300ml)', 'Acompañamiento perfecto', true),
    ('Cerveza Nacional', 'bebida', 55.0, 'Cerveza nacional', 'Acompañamiento perfecto', true),
    ('Cerveza Importada', 'bebida', 75.0, 'Cerveza importada', 'Acompañamiento perfecto', true),
    
    -- Postres (1 item)
    ('Togushi Roll', 'postre', 235.0, 'Roll de caramelo limón y nuez garapiñada', 'Sake dulce o té verde', true);