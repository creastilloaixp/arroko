-- Create menu_items table
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'Nigiri', 'Roll', 'Sashimi', 'Kitchen', 'Drink', 'Dessert'
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    pairing_notes TEXT, -- Specific somm notes for this item
    is_available BOOLEAN DEFAULT TRUE,
    image_url TEXT
);

-- Enable RLS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow read access to menu_items" ON public.menu_items FOR SELECT USING (true);

-- Insert Initial Data (IKU Sushi Menu)
INSERT INTO public.menu_items (name, category, description, price, pairing_notes) VALUES
-- Nigiris
('Nigiri de Salmón', 'Nigiri', 'Corte fresco de salmón noruego sobre arroz shari.', 85.00, 'Va perfecto con un Sake Junmai ligero.'),
('Nigiri de Atún', 'Nigiri', 'Atún aleta azul fresco.', 95.00, 'Marida con una cerveza Sapporo bien fría.'),
('Nigiri de Hamachi', 'Nigiri', 'Pez cola amarilla, suave y mantequilloso.', 110.00, 'Ideal con vino blanco seco.'),

-- Rolls
('Dragon Roll', 'Roll', 'Camarón tempura, pepino, aguacate, cubierto de anguila y salsa de anguila.', 220.00, 'La dulzura de la anguila pide un Sake Nigori.'),
('Spicy Tuna Roll', 'Roll', 'Atún picante, pepino, cebollín.', 180.00, 'Contrasta el picante con una limonada de jengibre o cerveza clara.'),
('IKU Especial', 'Roll', 'Salmón, queso crema, mango, cubierto de aguacate y salsa de maracuyá.', 210.00, 'Notas frutales que van bien con coctelería a base de Gin.'),
('Veggie Roll', 'Roll', 'Espárragos, aguacate, pepino, zanahoria encurtida.', 150.00, 'Té verde helado o agua mineral con cítricos.'),

-- Kitchen / Entradas
('Edamames Asados', 'Kitchen', 'Vainas de soya asadas con sal de mar y togarashi.', 90.00, 'Cerveza Asahi Super Dry.'),
('Kushiagues de Queso', 'Kitchen', 'Brochetas de queso manchego empanizadas (3 pzas).', 110.00, 'Refresco de Yuzu o Calpico.'),
('Miso Soup', 'Kitchen', 'Sopa tradicional con tofu, algas y cebollín.', 65.00, 'Té Hojicha caliente.'),

-- Drinks
('Sake Junmai (Copa)', 'Drink', 'Sake de la casa, notas florales.', 150.00, null),
('Cerveza Sapporo', 'Drink', 'Cerveza japonesa premium.', 95.00, null),
('Limonada de Jengibre', 'Drink', 'Refrescante limonada con toque picante de jengibre.', 60.00, null),
('Calpico', 'Drink', 'Bebida láctea fermentada japonesa.', 55.00, null),

-- Desserts
('Mochi Helado', 'Dessert', 'Pastel de arroz relleno de helado (Té verde, Vainilla, Chocolate).', 80.00, 'Té Matcha caliente.'),
('Tempura Helado', 'Dessert', 'Helado de vainilla frito en tempura.', 95.00, 'Sake dulce o café.')
ON CONFLICT DO NOTHING;
