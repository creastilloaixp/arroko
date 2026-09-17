-- Tabla de items del menú para IKU Sushi
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES public.restaurant_settings(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('roll', 'nigiri', 'sashimi', 'entrada', 'bebida', 'postre')),
  description TEXT,
  ingredients TEXT,
  price NUMERIC(10,2) NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  spicy_level INTEGER DEFAULT 0 CHECK (spicy_level BETWEEN 0 AND 3),
  sweetness INTEGER DEFAULT 0 CHECK (sweetness BETWEEN 0 AND 3),
  umami INTEGER DEFAULT 0 CHECK (umami BETWEEN 0 AND 3),
  pairing_notes TEXT,
  image_url TEXT
);

-- Índice para búsquedas rápidas por categoría
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON public.menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_price ON public.menu_items(price);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) - Políticas básicas
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Política para lectura pública de items disponibles
CREATE POLICY "Permitir lectura de items disponibles" ON public.menu_items
  FOR SELECT USING (is_available = TRUE);

-- Política para administración completa (requiere autenticación)
CREATE POLICY "Permitir administración completa" ON public.menu_items
  FOR ALL USING (auth.role() = 'authenticated');