-- ==============================================================================
-- ARROKÓ SUSHI PLATFORM - ESQUEMA DE BASE DE DATOS CONSOLIDADO
-- ==============================================================================
-- Este archivo contiene la estructura completa para desplegar Arrokó en un proyecto
-- nuevo e independiente de Supabase (PostgreSQL 15+).
-- Incluye:
-- 1. Tablas Core de Operaciones y Catálogos (Menú, Promociones, Participantes)
-- 2. Sistema de Fidelización, Check-in y Ruleta de Premios
-- 3. Bóveda Segura de Contactos (HMAC / Cifrado)
-- 4. ArroKids (Samurai Kid) y Scores de Gamificación
-- 5. Seguridad Row Level Security (RLS) y Funciones RPC
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251117180000_save_whatsapp_message_simple.sql
-- ------------------------------------------------------------------------------
-- Función RPC simplificada para guardar mensajes de WhatsApp desde n8n
-- Esta función trabaja con la tabla whatsapp_conversations existente
CREATE OR REPLACE FUNCTION save_whatsapp_message_simple(
  p_remote_jid VARCHAR(255),
  p_message_id VARCHAR(255),
  p_message_type VARCHAR(50),
  p_content TEXT,
  p_direction VARCHAR(20),
  p_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  p_sender_name VARCHAR(255) DEFAULT NULL,
  p_media_url TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Insertar el mensaje
  INSERT INTO whatsapp_conversations (
    remote_jid,
    message_id,
    message_type,
    content,
    direction,
    timestamp,
    sender_name,
    media_url
  )
  VALUES (
    p_remote_jid,
    p_message_id,
    p_message_type,
    p_content,
    p_direction,
    p_timestamp,
    p_sender_name,
    p_media_url
  )
  ON CONFLICT (message_id) 
  DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = NOW()
  RETURNING json_build_object(
    'success', true,
    'id', id,
    'message', 'Mensaje guardado exitosamente'
  ) INTO v_result;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION save_whatsapp_message_simple TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251117180027_create_whatsapp_conversations.sql
-- ------------------------------------------------------------------------------
-- Tabla para almacenar conversaciones de WhatsApp
CREATE TABLE whatsapp_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurant_settings(id) ON DELETE CASCADE,
  instance_name VARCHAR(255),
  remote_jid VARCHAR(255) NOT NULL, -- Número de teléfono del cliente
  message_id VARCHAR(255) UNIQUE NOT NULL,
  message_type VARCHAR(50) NOT NULL, -- text, image, audio, etc.
  content TEXT,
  direction VARCHAR(20) NOT NULL, -- inbound (del cliente) o outbound (del restaurante)
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sender_name VARCHAR(255),
  media_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas eficientes
CREATE INDEX idx_whatsapp_conversations_restaurant_id ON whatsapp_conversations(restaurant_id);
CREATE INDEX idx_whatsapp_conversations_remote_jid ON whatsapp_conversations(remote_jid);
CREATE INDEX idx_whatsapp_conversations_timestamp ON whatsapp_conversations(timestamp DESC);
CREATE INDEX idx_whatsapp_conversations_direction ON whatsapp_conversations(direction);

-- Vista para métricas por día
CREATE VIEW whatsapp_daily_metrics AS
SELECT 
  DATE(timestamp) as date,
  restaurant_id,
  COUNT(*) as total_messages,
  COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as inbound_messages,
  COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound_messages,
  COUNT(DISTINCT remote_jid) as unique_customers
FROM whatsapp_conversations 
GROUP BY DATE(timestamp), restaurant_id
ORDER BY date DESC;

-- Vista para conversaciones activas
CREATE VIEW whatsapp_active_conversations AS
SELECT 
  remote_jid,
  restaurant_id,
  MAX(timestamp) as last_message_at,
  COUNT(*) as message_count,
  MAX(CASE WHEN direction = 'inbound' THEN timestamp END) as last_inbound_at,
  MAX(CASE WHEN direction = 'outbound' THEN timestamp END) as last_outbound_at
FROM whatsapp_conversations 
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY remote_jid, restaurant_id
ORDER BY last_message_at DESC;

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251117180042_create_save_message_function.sql
-- ------------------------------------------------------------------------------
-- Función para guardar mensajes de WhatsApp
CREATE OR REPLACE FUNCTION save_whatsapp_message(
  p_restaurant_id UUID,
  p_instance_name VARCHAR(255),
  p_remote_jid VARCHAR(255),
  p_message_id VARCHAR(255),
  p_message_type VARCHAR(50),
  p_content TEXT,
  p_direction VARCHAR(20),
  p_timestamp TIMESTAMP WITH TIME ZONE,
  p_sender_name VARCHAR(255) DEFAULT NULL,
  p_media_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  INSERT INTO whatsapp_conversations (
    restaurant_id,
    instance_name,
    remote_jid,
    message_id,
    message_type,
    content,
    direction,
    timestamp,
    sender_name,
    media_url
  )
  VALUES (
    p_restaurant_id,
    p_instance_name,
    p_remote_jid,
    p_message_id,
    p_message_type,
    p_content,
    p_direction,
    p_timestamp,
    p_sender_name,
    p_media_url
  )
  ON CONFLICT (message_id) 
  DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = NOW()
  RETURNING id INTO v_conversation_id;
  
  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251117180053_create_rpc_save_message.sql
-- ------------------------------------------------------------------------------
-- Función RPC para guardar mensajes (wrapper para ser llamada desde n8n)
CREATE OR REPLACE FUNCTION rpc_save_whatsapp_message(
  p_restaurant_id UUID,
  p_instance_name VARCHAR(255),
  p_remote_jid VARCHAR(255),
  p_message_id VARCHAR(255),
  p_message_type VARCHAR(50),
  p_content TEXT,
  p_direction VARCHAR(20),
  p_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  p_sender_name VARCHAR(255) DEFAULT NULL,
  p_media_url TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_result UUID;
BEGIN
  v_result := save_whatsapp_message(
    p_restaurant_id,
    p_instance_name,
    p_remote_jid,
    p_message_id,
    p_message_type,
    p_content,
    p_direction,
    p_timestamp,
    p_sender_name,
    p_media_url
  );
  
  RETURN json_build_object(
    'success', true,
    'id', v_result,
    'message', 'Mensaje guardado exitosamente'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251118190000_create_menu_items.sql
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251118190100_seed_menu_items.sql
-- ------------------------------------------------------------------------------
-- Seed inicial de menú
INSERT INTO public.menu_items (restaurant_id, name, category, description, ingredients, price, is_available, spicy_level, umami, pairing_notes)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Rollo Dragón', 'roll', 'Tempura de camarón con aguacate y salsa unagi', 'camarón, aguacate, unagi', 169.00, TRUE, 1, 2, 'Armoniza con cerveza lager ligera o sake junmai'),
  ('00000000-0000-0000-0000-000000000001', 'Rollo IKU Especial', 'roll', 'Queso crema, salmón y topping de masago', 'salmón, queso crema, masago', 189.00, TRUE, 0, 2, 'Ideal con vino blanco seco y notas cítricas'),
  ('00000000-0000-0000-0000-000000000001', 'Nigiri de Salmón', 'nigiri', 'Salmón fresco sobre arroz avinagrado', 'salmón', 95.00, TRUE, 0, 2, 'Combina con sake ginjo frío'),
  ('00000000-0000-0000-0000-000000000001', 'Nigiri de Atún', 'nigiri', 'Atún rojo con shari de casa', 'atún', 99.00, TRUE, 0, 3, 'Acompaña con té verde suave o cerveza pilsner'),
  ('00000000-0000-0000-0000-000000000001', 'Sashimi de Salmón', 'sashimi', 'Cortes finos de salmón', 'salmón', 159.00, TRUE, 0, 2, 'Excelente con vino espumoso brut'),
  ('00000000-0000-0000-0000-000000000001', 'Edamame', 'entrada', 'Vainas de soya al vapor con sal', 'soya', 69.00, TRUE, 0, 1, 'Perfecto con cerveza lager'),
  ('00000000-0000-0000-0000-000000000001', 'Gyozas de Cerdo', 'entrada', 'Dumplings dorados con salsa ponzu', 'cerdo, harina', 99.00, TRUE, 0, 2, 'Mejora con vino tinto joven y fresco'),
  ('00000000-0000-0000-0000-000000000001', 'Té Verde', 'bebida', 'Infusión japonesa', 'té', 39.00, TRUE, 0, 0, 'Limpia paladar entre bocados'),
  ('00000000-0000-0000-0000-000000000001', 'Sake Junmai', 'bebida', 'Sake tradicional, perfil seco', 'arroz', 129.00, TRUE, 0, 1, 'Resalta sabores umami del pescado'),
  ('00000000-0000-0000-0000-000000000001', 'Helado de Té Matcha', 'postre', 'Helado cremoso de matcha', 'lácteos, matcha', 79.00, TRUE, 0, 1, 'Termina con notas herbales suaves');

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251118200000_populate_real_menu.sql
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251118210000_create_menu_items_safe.sql
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251118210100_populate_corrected_menu.sql
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251119000000_create_admin_auth.sql
-- ------------------------------------------------------------------------------
-- Migration: Create Admin Authentication System
-- This replaces the hardcoded password with proper Supabase Auth

-- Step 1: Create admin_users table to track admin roles
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Step 2: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

-- Step 3: Enable RLS on admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for admin_users
DROP POLICY IF EXISTS "Admins can view their own record" ON admin_users;
CREATE POLICY "Admins can view their own record" ON admin_users
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all admin users" ON admin_users;
CREATE POLICY "Service role can manage all admin users" ON admin_users
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Step 5: Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users
        WHERE user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Update existing tables to add admin-only policies

-- Participants: Admins can view all
DROP POLICY IF EXISTS "Admins can view all participants" ON participants;
CREATE POLICY "Admins can view all participants" ON participants
    FOR SELECT USING (is_admin());

-- Spins: Admins can view and update all
DROP POLICY IF EXISTS "Admins can view all spins" ON spins;
CREATE POLICY "Admins can view all spins" ON spins
    FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update spins" ON spins;
CREATE POLICY "Admins can update spins" ON spins
    FOR UPDATE USING (is_admin());

-- WhatsApp Messages: Admins can view all
DROP POLICY IF EXISTS "Admins can view all whatsapp messages" ON whatsapp_messages;
CREATE POLICY "Admins can view all whatsapp messages" ON whatsapp_messages
    FOR SELECT USING (is_admin());

-- Reservations: Admins can view and manage all
DROP POLICY IF EXISTS "Admins can view all reservations" ON reservations;
CREATE POLICY "Admins can view all reservations" ON reservations
    FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update reservations" ON reservations;
CREATE POLICY "Admins can update reservations" ON reservations
    FOR UPDATE USING (is_admin());

-- Restaurant Settings: Admins can view and update
DROP POLICY IF EXISTS "Admins can view restaurant settings" ON restaurant_settings;
CREATE POLICY "Admins can view restaurant settings" ON restaurant_settings
    FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update restaurant settings" ON restaurant_settings;
CREATE POLICY "Admins can update restaurant settings" ON restaurant_settings
    FOR UPDATE USING (is_admin());

-- Step 7: Create trigger for updated_at
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Create function to register first admin (run manually after migration)
-- IMPORTANT: After running this migration, create your first admin user with:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Create a new user with email/password
-- 3. Copy the user ID
-- 4. Run: INSERT INTO admin_users (user_id, role) VALUES ('YOUR_USER_ID', 'admin');

COMMENT ON TABLE admin_users IS 'Stores admin user roles. Link auth.users to admin privileges.';
COMMENT ON FUNCTION is_admin() IS 'Helper function to check if current user is an admin.';


-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251119000001_create_admin_auth_fixed.sql
-- ------------------------------------------------------------------------------
-- Migration: Create Admin Authentication System (Fixed Version)
-- This replaces the hardcoded password with proper Supabase Auth
-- Execute this script in Supabase SQL Editor

-- =====================================================
-- PART 1: Create admin_users table
-- =====================================================

-- Drop existing table if it exists (for clean migration)
DROP TABLE IF EXISTS admin_users CASCADE;

-- Create admin_users table to track admin roles
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'moderator', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);

-- Add comment for documentation
COMMENT ON TABLE admin_users IS 'Stores admin user roles. Links auth.users to admin privileges.';
COMMENT ON COLUMN admin_users.user_id IS 'References auth.users(id) - the Supabase Auth user ID';

-- =====================================================
-- PART 2: Enable Row Level Security
-- =====================================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view their own record
DROP POLICY IF EXISTS "Admins can view their own record" ON admin_users;
CREATE POLICY "Admins can view their own record" ON admin_users
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Service role can manage all (for migrations and admin tools)
DROP POLICY IF EXISTS "Service role can manage all admin users" ON admin_users;
CREATE POLICY "Service role can manage all admin users" ON admin_users
    FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- PART 3: Create helper function to check admin status
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS is_admin();

-- Create function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if the current authenticated user exists in admin_users table
    RETURN EXISTS (
        SELECT 1
        FROM admin_users
        WHERE user_id = auth.uid()
    );
EXCEPTION
    WHEN OTHERS THEN
        -- If any error occurs, return false (not admin)
        RETURN FALSE;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION is_admin() IS 'Helper function to check if current user has admin privileges';

-- =====================================================
-- PART 4: Create trigger for updated_at
-- =====================================================

-- Ensure update_updated_at_column function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for admin_users
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PART 5: Update RLS policies for existing tables
-- =====================================================

-- Participants: Allow admins to view all
DROP POLICY IF EXISTS "Admins can view all participants" ON participants;
CREATE POLICY "Admins can view all participants" ON participants
    FOR SELECT
    USING (is_admin());

-- Spins: Allow admins to view and update all
DROP POLICY IF EXISTS "Admins can view all spins" ON spins;
CREATE POLICY "Admins can view all spins" ON spins
    FOR SELECT
    USING (is_admin());

DROP POLICY IF EXISTS "Admins can update spins" ON spins;
CREATE POLICY "Admins can update spins" ON spins
    FOR UPDATE
    USING (is_admin());

-- WhatsApp Messages: Allow admins to view all
DROP POLICY IF EXISTS "Admins can view all whatsapp messages" ON whatsapp_messages;
CREATE POLICY "Admins can view all whatsapp messages" ON whatsapp_messages
    FOR SELECT
    USING (is_admin());

-- Reservations: Allow admins to view and manage all
DROP POLICY IF EXISTS "Admins can view all reservations" ON reservations;
CREATE POLICY "Admins can view all reservations" ON reservations
    FOR SELECT
    USING (is_admin());

DROP POLICY IF EXISTS "Admins can update reservations" ON reservations;
CREATE POLICY "Admins can update reservations" ON reservations
    FOR UPDATE
    USING (is_admin());

-- Restaurant Settings: Allow admins to view and update
DROP POLICY IF EXISTS "Admins can view restaurant settings" ON restaurant_settings;
CREATE POLICY "Admins can view restaurant settings" ON restaurant_settings
    FOR SELECT
    USING (is_admin());

DROP POLICY IF EXISTS "Admins can update restaurant settings" ON restaurant_settings;
CREATE POLICY "Admins can update restaurant settings" ON restaurant_settings
    FOR UPDATE
    USING (is_admin());

-- =====================================================
-- PART 6: Verification query
-- =====================================================

-- Test the setup (you can run this separately)
DO $$
BEGIN
    RAISE NOTICE '✅ Admin authentication system created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Next steps:';
    RAISE NOTICE '1. Go to Supabase Dashboard > Authentication > Users';
    RAISE NOTICE '2. Create a new user or use an existing one';
    RAISE NOTICE '3. Copy the user ID';
    RAISE NOTICE '4. Run: INSERT INTO admin_users (user_id) VALUES (''YOUR_USER_ID'');';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 To verify your admin users, run:';
    RAISE NOTICE 'SELECT id, user_id, role, created_at FROM admin_users;';
END $$;


-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251119011000_add_terms_fields.sql
-- ------------------------------------------------------------------------------
ALTER TABLE participants ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS terms_version TEXT;

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251119012000_create_feature_flags.sql
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  org_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view feature flags" ON feature_flags;
CREATE POLICY "Admins can view feature flags" ON feature_flags
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage feature flags" ON feature_flags;
CREATE POLICY "Admins can manage feature flags" ON feature_flags
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Anon can read public flags" ON feature_flags;
CREATE POLICY "Anon can read public flags" ON feature_flags
  FOR SELECT USING (org_id IS NULL);

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251119013000_rls_public_policies.sql
-- ------------------------------------------------------------------------------
-- Participants
DROP POLICY IF EXISTS "Anon can insert participants" ON participants;
CREATE POLICY "Anon can insert participants" ON participants
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update participants" ON participants;
CREATE POLICY "Admins can update participants" ON participants
  FOR UPDATE USING (is_admin());

-- Spins
DROP POLICY IF EXISTS "Anon can insert spins" ON spins;
CREATE POLICY "Anon can insert spins" ON spins
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update spins" ON spins;
CREATE POLICY "Admins can update spins" ON spins
  FOR UPDATE USING (is_admin());

-- User Interactions
DROP POLICY IF EXISTS "Anon can insert interactions" ON user_interactions;
CREATE POLICY "Anon can insert interactions" ON user_interactions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view interactions" ON user_interactions;
CREATE POLICY "Admins can view interactions" ON user_interactions
  FOR SELECT USING (is_admin());

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251119014000_add_org_fields.sql
-- ------------------------------------------------------------------------------
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.spins ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

CREATE INDEX IF NOT EXISTS idx_participants_org_id ON public.participants(org_id);
CREATE INDEX IF NOT EXISTS idx_spins_org_id ON public.spins(org_id);

UPDATE public.participants SET org_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE org_id IS NULL;
UPDATE public.spins SET org_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE org_id IS NULL;

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251119224439_parches_de_seguridad_rls_criticos.sql
-- ------------------------------------------------------------------------------
-- =====================================================================
-- PARCHE DE SEGURIDAD CRÍTICO PARA TABLAS PUBLIC
-- =====================================================================

-- -----------------------------------------------------
-- SECCIÓN 1: Tabla 'customers'
-- Corrige: RLS deshabilitado.
-- -----------------------------------------------------

-- Paso 1.1: Habilitar la Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Paso 1.2: Crear política para que los usuarios solo gestionen su propia información
-- Se asume que la columna 'id' es la clave foránea a auth.users.id
CREATE POLICY "Los clientes pueden gestionar su propia información"
ON public.customers
FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);


-- -----------------------------------------------------
-- SECCIÓN 2: Tabla 'admin_users'
-- Corrige: Políticas que permiten a cualquier usuario leer y gestionar administradores.
-- -----------------------------------------------------

-- Paso 2.1: Eliminar las políticas inseguras existentes
DROP POLICY IF EXISTS "Allow authenticated users to read admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "allow_all" ON public.admin_users;

-- Paso 2.2: Crear una política segura que solo da acceso a los propios administradores
-- Se asume que 'admin_users' tiene una columna 'user_id' que referencia a auth.users.id
CREATE POLICY "Los administradores pueden gestionar la tabla de administradores"
ON public.admin_users
FOR ALL
USING (
  -- Permite la operación si el ID del usuario actual existe en la tabla de admins
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);


-- -----------------------------------------------------
-- SECCIÓN 3: Tabla 'menu_items'
-- Corrige: Política que permite a cualquier usuario autenticado gestionar el menú.
-- -----------------------------------------------------

-- Paso 3.1: Eliminar la política de administración insegura
DROP POLICY IF EXISTS "Permitir administración completa" ON public.menu_items;

-- Paso 3.2: Crear una política segura que solo permite a los administradores gestionar el menú
CREATE POLICY "Los administradores pueden gestionar el menú"
ON public.menu_items
FOR ALL -- Aplica a INSERT, UPDATE, DELETE
USING (
  -- Reutiliza la lógica: solo si el usuario es un administrador
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251123143000_add_expires_at_to_spins.sql
-- ------------------------------------------------------------------------------
-- Add expires_at column to spins table
ALTER TABLE public.spins 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Update existing spins to have an expiration date (e.g., 30 days from creation)
UPDATE public.spins 
SET expires_at = created_at + INTERVAL '30 days' 
WHERE expires_at IS NULL;


-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251124000000_add_preferences_to_participants.sql
-- ------------------------------------------------------------------------------
-- Add preferences column to participants table
ALTER TABLE participants 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Comment on column
COMMENT ON COLUMN participants.preferences IS 'Stores user preferences from onboarding (flavors, group size, etc.)';


-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251124010000_create_menu_items.sql
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20251129000000_create_whatsapp_customers_schema.sql
-- ------------------------------------------------------------------------------
-- Migration: Create WhatsApp Customers Memory System
-- Description: Creates tables and functions for persistent customer memory in WhatsApp agent
-- Date: 2025-11-29

-- =====================================================
-- TABLE: whatsapp_customers
-- Purpose: Store basic customer information
-- =====================================================
CREATE TABLE IF NOT EXISTS whatsapp_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT UNIQUE NOT NULL,
    name TEXT,
    first_contact TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_contact TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_messages INTEGER DEFAULT 0,
    preferences JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast phone number lookup
CREATE INDEX IF NOT EXISTS idx_whatsapp_customers_phone ON whatsapp_customers(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_customers_last_contact ON whatsapp_customers(last_contact DESC);

-- =====================================================
-- TABLE: whatsapp_conversation_history
-- Purpose: Store complete conversation history
-- =====================================================
CREATE TABLE IF NOT EXISTS whatsapp_conversation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES whatsapp_customers(id) ON DELETE CASCADE,
    message_id TEXT,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    message_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast history retrieval
CREATE INDEX IF NOT EXISTS idx_conversation_history_customer ON whatsapp_conversation_history(customer_id, message_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_history_timestamp ON whatsapp_conversation_history(message_timestamp DESC);

-- =====================================================
-- TABLE: whatsapp_customer_context
-- Purpose: Store current conversation context per customer
-- =====================================================
CREATE TABLE IF NOT EXISTS whatsapp_customer_context (
    customer_id UUID PRIMARY KEY REFERENCES whatsapp_customers(id) ON DELETE CASCADE,
    current_intent TEXT,
    conversation_summary TEXT,
    pending_actions JSONB DEFAULT '[]'::jsonb,
    last_topic TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- FUNCTION: get_or_create_customer
-- Purpose: Get existing customer or create new one
-- =====================================================
CREATE OR REPLACE FUNCTION get_or_create_customer(p_phone_number TEXT)
RETURNS TABLE (
    customer_id UUID,
    customer_name TEXT,
    is_new_customer BOOLEAN,
    total_messages INTEGER,
    last_contact TIMESTAMP WITH TIME ZONE,
    preferences JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id UUID;
    v_customer_name TEXT;
    v_is_new BOOLEAN;
    v_total_messages INTEGER;
    v_last_contact TIMESTAMP WITH TIME ZONE;
    v_preferences JSONB;
BEGIN
    -- Try to find existing customer
    SELECT id, name, total_messages, last_contact, preferences
    INTO v_customer_id, v_customer_name, v_total_messages, v_last_contact, v_preferences
    FROM whatsapp_customers
    WHERE phone_number = p_phone_number;

    IF v_customer_id IS NULL THEN
        -- Create new customer
        INSERT INTO whatsapp_customers (phone_number)
        VALUES (p_phone_number)
        RETURNING id, name, total_messages, last_contact, preferences
        INTO v_customer_id, v_customer_name, v_total_messages, v_last_contact, v_preferences;
        
        v_is_new := TRUE;
        
        -- Create initial context
        INSERT INTO whatsapp_customer_context (customer_id)
        VALUES (v_customer_id);
    ELSE
        -- Update last contact
        UPDATE whatsapp_customers
        SET last_contact = NOW(),
            updated_at = NOW()
        WHERE id = v_customer_id;
        
        v_is_new := FALSE;
    END IF;

    RETURN QUERY SELECT 
        v_customer_id,
        v_customer_name,
        v_is_new,
        v_total_messages,
        v_last_contact,
        v_preferences;
END;
$$;

-- =====================================================
-- FUNCTION: get_customer_history
-- Purpose: Retrieve conversation history for a customer
-- =====================================================
CREATE OR REPLACE FUNCTION get_customer_history(
    p_customer_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    role TEXT,
    content TEXT,
    message_timestamp TIMESTAMP WITH TIME ZONE,
    metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.role,
        h.content,
        h.message_timestamp,
        h.metadata
    FROM whatsapp_conversation_history h
    WHERE h.customer_id = p_customer_id
    ORDER BY h.message_timestamp DESC
    LIMIT p_limit;
END;
$$;

-- =====================================================
-- FUNCTION: save_customer_message
-- Purpose: Save a message to conversation history
-- =====================================================
CREATE OR REPLACE FUNCTION save_customer_message(
    p_customer_id UUID,
    p_role TEXT,
    p_content TEXT,
    p_message_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_id UUID;
BEGIN
    -- Validate role
    IF p_role NOT IN ('user', 'assistant') THEN
        RAISE EXCEPTION 'Invalid role: %. Must be user or assistant', p_role;
    END IF;

    -- Insert message
    INSERT INTO whatsapp_conversation_history (
        customer_id,
        message_id,
        role,
        content,
        metadata
    )
    VALUES (
        p_customer_id,
        p_message_id,
        p_role,
        p_content,
        p_metadata
    )
    RETURNING id INTO v_message_id;

    -- Update customer stats
    UPDATE whatsapp_customers
    SET 
        total_messages = total_messages + 1,
        last_contact = NOW(),
        updated_at = NOW()
    WHERE id = p_customer_id;

    RETURN v_message_id;
END;
$$;

-- =====================================================
-- FUNCTION: update_customer_context
-- Purpose: Update customer's conversation context
-- =====================================================
CREATE OR REPLACE FUNCTION update_customer_context(
    p_customer_id UUID,
    p_current_intent TEXT DEFAULT NULL,
    p_conversation_summary TEXT DEFAULT NULL,
    p_pending_actions JSONB DEFAULT NULL,
    p_last_topic TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO whatsapp_customer_context (
        customer_id,
        current_intent,
        conversation_summary,
        pending_actions,
        last_topic,
        updated_at
    )
    VALUES (
        p_customer_id,
        p_current_intent,
        p_conversation_summary,
        COALESCE(p_pending_actions, '[]'::jsonb),
        p_last_topic,
        NOW()
    )
    ON CONFLICT (customer_id) DO UPDATE SET
        current_intent = COALESCE(EXCLUDED.current_intent, whatsapp_customer_context.current_intent),
        conversation_summary = COALESCE(EXCLUDED.conversation_summary, whatsapp_customer_context.conversation_summary),
        pending_actions = COALESCE(EXCLUDED.pending_actions, whatsapp_customer_context.pending_actions),
        last_topic = COALESCE(EXCLUDED.last_topic, whatsapp_customer_context.last_topic),
        updated_at = NOW();
END;
$$;

-- =====================================================
-- FUNCTION: update_customer_name
-- Purpose: Update customer's name
-- =====================================================
CREATE OR REPLACE FUNCTION update_customer_name(
    p_customer_id UUID,
    p_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE whatsapp_customers
    SET 
        name = p_name,
        updated_at = NOW()
    WHERE id = p_customer_id;
END;
$$;

-- =====================================================
-- FUNCTION: get_customer_context
-- Purpose: Get customer's current context
-- =====================================================
CREATE OR REPLACE FUNCTION get_customer_context(p_customer_id UUID)
RETURNS TABLE (
    current_intent TEXT,
    conversation_summary TEXT,
    pending_actions JSONB,
    last_topic TEXT,
    updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.current_intent,
        c.conversation_summary,
        c.pending_actions,
        c.last_topic,
        c.updated_at
    FROM whatsapp_customer_context c
    WHERE c.customer_id = p_customer_id;
END;
$$;

-- =====================================================
-- RLS POLICIES
-- Purpose: Enable Row Level Security
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE whatsapp_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_customer_context ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role has full access to customers"
    ON whatsapp_customers
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to history"
    ON whatsapp_conversation_history
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to context"
    ON whatsapp_customer_context
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Allow anon role to use RPC functions (for n8n)
CREATE POLICY "Anon can read customers via RPC"
    ON whatsapp_customers
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Anon can insert customers via RPC"
    ON whatsapp_customers
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Anon can update customers via RPC"
    ON whatsapp_customers
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Anon can read history via RPC"
    ON whatsapp_conversation_history
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Anon can insert history via RPC"
    ON whatsapp_conversation_history
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Anon can read context via RPC"
    ON whatsapp_customer_context
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Anon can insert/update context via RPC"
    ON whatsapp_customer_context
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE whatsapp_customers IS 'Stores WhatsApp customer information for persistent memory';
COMMENT ON TABLE whatsapp_conversation_history IS 'Complete conversation history for all customers';
COMMENT ON TABLE whatsapp_customer_context IS 'Current conversation context and state per customer';
COMMENT ON FUNCTION get_or_create_customer IS 'Gets existing customer or creates new one by phone number';
COMMENT ON FUNCTION get_customer_history IS 'Retrieves conversation history for a customer';
COMMENT ON FUNCTION save_customer_message IS 'Saves a message to conversation history';
COMMENT ON FUNCTION update_customer_context IS 'Updates customer conversation context';


-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20260910120000_arroko_control_core.sql
-- ------------------------------------------------------------------------------
-- Arroko Control backend foundation.
--
-- Scope: multi-tenant operational model for clients, supplies, operations,
-- reporting and advertising decisions. No production organization or demo data
-- is inserted by this migration.
--
-- Rollback (before productive data exists): drop objects prefixed arroko_ in
-- reverse dependency order. Once productive data exists, use a forward migration.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.arroko_has_org_role(
  target_org_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.org_members membership
    where membership.org_id = target_org_id
      and membership.user_id = (select auth.uid())
      and lower(membership.role) = any (allowed_roles)
  );
$$;

revoke all on function public.arroko_has_org_role(uuid, text[]) from public;
grant execute on function public.arroko_has_org_role(uuid, text[]) to authenticated;
grant execute on function public.arroko_has_org_role(uuid, text[]) to service_role;

create or replace function public.arroko_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.arroko_set_updated_at() from public;

create table public.arroko_locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  code text,
  timezone text not null default 'America/Mazatlan',
  currency text not null default 'MXN' check (currency ~ '^[A-Z]{3}$'),
  softrestaurant_company_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, code),
  unique (org_id, softrestaurant_company_id)
);

create table public.arroko_clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_id text,
  display_name text,
  phone_last4 text check (phone_last4 is null or phone_last4 ~ '^[0-9]{4}$'),
  email_masked text,
  contact_ref text,
  marketing_consent boolean not null default false,
  consent_source text,
  consent_recorded_at timestamptz,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  visit_count integer not null default 0 check (visit_count >= 0),
  lifetime_value numeric(14,2) not null default 0 check (lifetime_value >= 0),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_seen_at >= first_seen_at),
  check (marketing_consent = false or consent_recorded_at is not null),
  unique (org_id, id),
  unique (org_id, external_id)
);

comment on column public.arroko_clients.contact_ref is
  'Opaque reference to contact data in an approved PII store; never place raw phone or email here.';

create table public.arroko_products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_id text not null,
  sku text,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  category text,
  price numeric(14,2) not null check (price >= 0),
  active boolean not null default true,
  source_updated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, external_id),
  unique (org_id, sku)
);

create table public.arroko_ingredients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_id text,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  unit text not null check (unit in ('g','kg','ml','l','piece','pack','portion')),
  current_cost numeric(14,4) check (current_cost is null or current_cost >= 0),
  reorder_point numeric(14,4) check (reorder_point is null or reorder_point >= 0),
  active boolean not null default true,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, external_id)
);

create table public.arroko_recipes (
  org_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  ingredient_id uuid not null,
  quantity numeric(14,4) not null check (quantity > 0),
  yield_loss_pct numeric(6,3) not null default 0 check (yield_loss_pct between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (product_id, ingredient_id),
  foreign key (org_id, product_id)
    references public.arroko_products(org_id, id) on delete cascade,
  foreign key (org_id, ingredient_id)
    references public.arroko_ingredients(org_id, id) on delete restrict
);

create table public.arroko_inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null,
  ingredient_id uuid not null,
  quantity numeric(14,4) not null check (quantity >= 0),
  captured_at timestamptz not null,
  source text not null default 'manual' check (source in ('manual','softrestaurant','bridge','import')),
  source_event_id text,
  created_at timestamptz not null default now(),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete cascade,
  foreign key (org_id, ingredient_id)
    references public.arroko_ingredients(org_id, id) on delete cascade,
  unique (org_id, location_id, ingredient_id, source_event_id)
);

create table public.arroko_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null,
  ingredient_id uuid not null,
  kind text not null check (kind in ('purchase','sale_usage','waste','adjustment','transfer_in','transfer_out')),
  quantity numeric(14,4) not null check (quantity <> 0),
  unit_cost numeric(14,4) check (unit_cost is null or unit_cost >= 0),
  note text,
  occurred_at timestamptz not null,
  external_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete cascade,
  foreign key (org_id, ingredient_id)
    references public.arroko_ingredients(org_id, id) on delete restrict,
  unique (org_id, external_id)
);

create table public.arroko_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null,
  external_id text not null,
  client_id uuid,
  channel text not null default 'unknown' check (channel in ('dine_in','counter','takeaway','delivery','whatsapp','phone','unknown')),
  status text not null check (status in ('open','preparing','ready','completed','cancelled','refunded')),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  tax numeric(14,2) not null default 0 check (tax >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  opened_at timestamptz not null,
  closed_at timestamptz,
  source_updated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closed_at is null or closed_at >= opened_at),
  check (total <= subtotal + tax),
  unique (org_id, id),
  unique (org_id, external_id),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete restrict,
  foreign key (org_id, client_id)
    references public.arroko_clients(org_id, id) on delete set null
);

create table public.arroko_order_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null,
  product_id uuid,
  external_line_id text not null,
  product_name_snapshot text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  net_amount numeric(14,2) not null check (net_amount >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (org_id, order_id)
    references public.arroko_orders(org_id, id) on delete cascade,
  foreign key (org_id, product_id)
    references public.arroko_products(org_id, id) on delete set null,
  unique (order_id, external_line_id)
);

create table public.arroko_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null,
  external_id text,
  method text not null check (method in ('cash','card','transfer','delivery_platform','other')),
  amount numeric(14,2) not null check (amount >= 0),
  paid_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (org_id, order_id)
    references public.arroko_orders(org_id, id) on delete cascade,
  unique (order_id, external_id)
);

create table public.arroko_operation_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null,
  kind text not null,
  severity text not null check (severity in ('info','attention','critical')),
  summary text not null check (char_length(btrim(summary)) between 1 and 280),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  owner_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open','acknowledged','resolved','dismissed')),
  occurred_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (resolved_at is null or resolved_at >= occurred_at),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete cascade
);

create table public.arroko_connectors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid,
  provider text not null check (provider in ('softrestaurant','meta','google_ads','manual_import')),
  status text not null default 'draft' check (status in ('draft','active','paused','error','revoked')),
  external_account_id text,
  secret_ref text,
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete cascade,
  unique nulls not distinct (org_id, location_id, provider, external_account_id)
);

comment on column public.arroko_connectors.secret_ref is
  'Reference to a Supabase secret or external vault entry. Secret values are prohibited.';

create table public.arroko_sync_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connector_id uuid not null,
  location_id uuid,
  cursor_value text,
  status text not null check (status in ('running','succeeded','partial','failed')),
  rows_received integer not null default 0 check (rows_received >= 0),
  rows_applied integer not null default 0 check (rows_applied >= 0),
  rows_rejected integer not null default 0 check (rows_rejected >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_code text,
  error_summary text,
  created_at timestamptz not null default now(),
  check (finished_at is null or finished_at >= started_at),
  foreign key (org_id, connector_id)
    references public.arroko_connectors(org_id, id) on delete cascade,
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete set null
);

create table public.arroko_raw_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connector_id uuid not null,
  source_event_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (org_id, connector_id)
    references public.arroko_connectors(org_id, id) on delete cascade,
  unique (connector_id, source_event_id)
);

create table public.arroko_campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid,
  platform text not null check (platform in ('meta','google_ads','tiktok','other')),
  external_id text not null,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  objective text,
  status text not null check (status in ('draft','active','paused','completed','archived')),
  daily_budget numeric(14,2) check (daily_budget is null or daily_budget >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at),
  unique (org_id, id),
  unique (org_id, platform, external_id),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete set null
);

create table public.arroko_campaign_metrics_daily (
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null,
  metric_date date not null,
  spend numeric(14,2) not null default 0 check (spend >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  messages bigint not null default 0 check (messages >= 0),
  platform_conversions numeric(14,3) not null default 0 check (platform_conversions >= 0),
  attributed_orders integer not null default 0 check (attributed_orders >= 0),
  attributed_revenue numeric(14,2) not null default 0 check (attributed_revenue >= 0),
  attribution_model text not null default 'unverified' check (attribution_model in ('unverified','platform','coupon','phone','first_party')),
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, metric_date),
  foreign key (org_id, campaign_id)
    references public.arroko_campaigns(org_id, id) on delete cascade
);

create table public.arroko_campaign_decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null,
  recommendation text not null check (char_length(btrim(recommendation)) between 1 and 500),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  proposed_change jsonb not null check (jsonb_typeof(proposed_change) = 'object'),
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','executed','expired')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  executed_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, campaign_id)
    references public.arroko_campaigns(org_id, id) on delete cascade,
  check ((status <> 'approved') or (approved_by is not null and approved_at is not null)),
  check (executed_at is null or approved_at is not null)
);

create table public.arroko_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('user','connector','system')),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create trigger arroko_locations_updated_at
before update on public.arroko_locations
for each row execute function public.arroko_set_updated_at();

create trigger arroko_clients_updated_at
before update on public.arroko_clients
for each row execute function public.arroko_set_updated_at();

create trigger arroko_products_updated_at
before update on public.arroko_products
for each row execute function public.arroko_set_updated_at();

create trigger arroko_ingredients_updated_at
before update on public.arroko_ingredients
for each row execute function public.arroko_set_updated_at();

create trigger arroko_orders_updated_at
before update on public.arroko_orders
for each row execute function public.arroko_set_updated_at();

create trigger arroko_operation_events_updated_at
before update on public.arroko_operation_events
for each row execute function public.arroko_set_updated_at();

create trigger arroko_connectors_updated_at
before update on public.arroko_connectors
for each row execute function public.arroko_set_updated_at();

create trigger arroko_campaigns_updated_at
before update on public.arroko_campaigns
for each row execute function public.arroko_set_updated_at();

create trigger arroko_campaign_metrics_updated_at
before update on public.arroko_campaign_metrics_daily
for each row execute function public.arroko_set_updated_at();

create trigger arroko_campaign_decisions_updated_at
before update on public.arroko_campaign_decisions
for each row execute function public.arroko_set_updated_at();

-- Foreign keys and the principal dashboard access paths are indexed explicitly.
create index arroko_locations_org_active_idx on public.arroko_locations (org_id, active);
create index arroko_clients_org_last_seen_idx on public.arroko_clients (org_id, last_seen_at desc, id);
create index arroko_clients_org_consent_idx on public.arroko_clients (org_id, last_seen_at desc)
  where marketing_consent;
create index arroko_products_org_active_idx on public.arroko_products (org_id, category, name)
  where active;
create index arroko_ingredients_org_active_idx on public.arroko_ingredients (org_id, name)
  where active;
create index arroko_recipes_org_ingredient_idx on public.arroko_recipes (org_id, ingredient_id);
create index arroko_inventory_snapshots_latest_idx on public.arroko_inventory_snapshots
  (org_id, location_id, ingredient_id, captured_at desc, id desc);
create index arroko_inventory_movements_timeline_idx on public.arroko_inventory_movements
  (org_id, location_id, occurred_at desc, id desc);
create index arroko_inventory_movements_ingredient_idx on public.arroko_inventory_movements
  (org_id, ingredient_id, occurred_at desc);
create index arroko_orders_timeline_idx on public.arroko_orders
  (org_id, location_id, opened_at desc, id desc);
create index arroko_orders_status_idx on public.arroko_orders
  (org_id, location_id, status, opened_at desc)
  where status in ('open','preparing','ready');
create index arroko_orders_client_idx on public.arroko_orders (org_id, client_id, opened_at desc)
  where client_id is not null;
create index arroko_order_items_order_idx on public.arroko_order_items (org_id, order_id);
create index arroko_order_items_product_idx on public.arroko_order_items (org_id, product_id)
  where product_id is not null;
create index arroko_payments_order_idx on public.arroko_payments (org_id, order_id);
create index arroko_operation_events_open_idx on public.arroko_operation_events
  (org_id, location_id, severity, occurred_at desc)
  where status in ('open','acknowledged');
create index arroko_connectors_org_idx on public.arroko_connectors (org_id, status, provider);
create index arroko_sync_runs_connector_idx on public.arroko_sync_runs
  (connector_id, started_at desc, id desc);
create index arroko_sync_runs_org_failed_idx on public.arroko_sync_runs
  (org_id, started_at desc)
  where status in ('failed','partial');
create index arroko_raw_events_unprocessed_idx on public.arroko_raw_events
  (connector_id, occurred_at, id)
  where processed_at is null;
create index arroko_campaigns_org_status_idx on public.arroko_campaigns
  (org_id, status, started_at desc);
create index arroko_campaign_metrics_org_date_idx on public.arroko_campaign_metrics_daily
  (org_id, metric_date desc, campaign_id);
create index arroko_campaign_decisions_open_idx on public.arroko_campaign_decisions
  (org_id, created_at desc, id desc)
  where status = 'proposed';
create index arroko_audit_events_timeline_idx on public.arroko_audit_events
  (org_id, created_at desc, id desc);

alter table public.arroko_locations enable row level security;
alter table public.arroko_clients enable row level security;
alter table public.arroko_products enable row level security;
alter table public.arroko_ingredients enable row level security;
alter table public.arroko_recipes enable row level security;
alter table public.arroko_inventory_snapshots enable row level security;
alter table public.arroko_inventory_movements enable row level security;
alter table public.arroko_orders enable row level security;
alter table public.arroko_order_items enable row level security;
alter table public.arroko_payments enable row level security;
alter table public.arroko_operation_events enable row level security;
alter table public.arroko_connectors enable row level security;
alter table public.arroko_sync_runs enable row level security;
alter table public.arroko_raw_events enable row level security;
alter table public.arroko_campaigns enable row level security;
alter table public.arroko_campaign_metrics_daily enable row level security;
alter table public.arroko_campaign_decisions enable row level security;
alter table public.arroko_audit_events enable row level security;

-- Read policies. Raw connector events remain service-role only.
create policy "Arroko members read locations" on public.arroko_locations for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko CRM roles read clients" on public.arroko_clients for select
  to authenticated using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko members read products" on public.arroko_products for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read ingredients" on public.arroko_ingredients for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read recipes" on public.arroko_recipes for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read inventory snapshots" on public.arroko_inventory_snapshots for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read inventory movements" on public.arroko_inventory_movements for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read orders" on public.arroko_orders for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read order items" on public.arroko_order_items for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read payments" on public.arroko_payments for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read operation events" on public.arroko_operation_events for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko admins read connectors" on public.arroko_connectors for select
  to authenticated using (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko operators read sync runs" on public.arroko_sync_runs for select
  to authenticated using (public.arroko_has_org_role(org_id, array['ops','admin','owner']));
create policy "Arroko members read campaigns" on public.arroko_campaigns for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read campaign metrics" on public.arroko_campaign_metrics_daily for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read campaign decisions" on public.arroko_campaign_decisions for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko admins read audit events" on public.arroko_audit_events for select
  to authenticated using (public.arroko_has_org_role(org_id, array['admin','owner']));

-- Human write policies. Imported commerce and metrics remain service-role writes.
create policy "Arroko admins insert locations" on public.arroko_locations for insert
  to authenticated with check (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko admins update locations" on public.arroko_locations for update
  to authenticated using (public.arroko_has_org_role(org_id, array['admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['admin','owner']));

create policy "Arroko CRM roles insert clients" on public.arroko_clients for insert
  to authenticated with check (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko CRM roles update clients" on public.arroko_clients for update
  to authenticated using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));

create policy "Arroko operators insert ingredients" on public.arroko_ingredients for insert
  to authenticated with check (public.arroko_has_org_role(org_id, array['ops','admin','owner']));
create policy "Arroko operators update ingredients" on public.arroko_ingredients for update
  to authenticated using (public.arroko_has_org_role(org_id, array['ops','admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['ops','admin','owner']));
create policy "Arroko operators insert recipes" on public.arroko_recipes for insert
  to authenticated with check (public.arroko_has_org_role(org_id, array['ops','admin','owner']));
create policy "Arroko operators update recipes" on public.arroko_recipes for update
  to authenticated using (public.arroko_has_org_role(org_id, array['ops','admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['ops','admin','owner']));
create policy "Arroko operators delete recipes" on public.arroko_recipes for delete
  to authenticated using (public.arroko_has_org_role(org_id, array['ops','admin','owner']));
create policy "Arroko operators insert inventory movements" on public.arroko_inventory_movements for insert
  to authenticated with check (
    public.arroko_has_org_role(org_id, array['ops','admin','owner'])
    and created_by = (select auth.uid())
  );

create policy "Arroko operators insert operation events" on public.arroko_operation_events for insert
  to authenticated with check (public.arroko_has_org_role(org_id, array['ops','admin','owner']));
create policy "Arroko operators update operation events" on public.arroko_operation_events for update
  to authenticated using (public.arroko_has_org_role(org_id, array['ops','admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['ops','admin','owner']));

create policy "Arroko admins insert connectors" on public.arroko_connectors for insert
  to authenticated with check (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko admins update connectors" on public.arroko_connectors for update
  to authenticated using (public.arroko_has_org_role(org_id, array['admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['admin','owner']));

create policy "Arroko admins insert campaigns" on public.arroko_campaigns for insert
  to authenticated with check (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko admins update campaigns" on public.arroko_campaigns for update
  to authenticated using (public.arroko_has_org_role(org_id, array['admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko admins insert campaign decisions" on public.arroko_campaign_decisions for insert
  to authenticated with check (
    public.arroko_has_org_role(org_id, array['admin','owner'])
    and created_by = (select auth.uid())
    and status = 'proposed'
  );

revoke all on table
  public.arroko_locations,
  public.arroko_clients,
  public.arroko_products,
  public.arroko_ingredients,
  public.arroko_recipes,
  public.arroko_inventory_snapshots,
  public.arroko_inventory_movements,
  public.arroko_orders,
  public.arroko_order_items,
  public.arroko_payments,
  public.arroko_operation_events,
  public.arroko_connectors,
  public.arroko_sync_runs,
  public.arroko_raw_events,
  public.arroko_campaigns,
  public.arroko_campaign_metrics_daily,
  public.arroko_campaign_decisions,
  public.arroko_audit_events
from anon, authenticated;

grant select, insert, update on public.arroko_locations to authenticated;
grant select, insert, update on public.arroko_clients to authenticated;
grant select on public.arroko_products to authenticated;
grant select, insert, update on public.arroko_ingredients to authenticated;
grant select, insert, update, delete on public.arroko_recipes to authenticated;
grant select on public.arroko_inventory_snapshots to authenticated;
grant select, insert on public.arroko_inventory_movements to authenticated;
grant select on public.arroko_orders to authenticated;
grant select on public.arroko_order_items to authenticated;
grant select on public.arroko_payments to authenticated;
grant select, insert, update on public.arroko_operation_events to authenticated;
grant select, insert, update on public.arroko_connectors to authenticated;
grant select on public.arroko_sync_runs to authenticated;
grant select, insert, update on public.arroko_campaigns to authenticated;
grant select on public.arroko_campaign_metrics_daily to authenticated;
grant select, insert on public.arroko_campaign_decisions to authenticated;
grant select on public.arroko_audit_events to authenticated;

grant all on public.arroko_locations to service_role;
grant all on public.arroko_clients to service_role;
grant all on public.arroko_products to service_role;
grant all on public.arroko_ingredients to service_role;
grant all on public.arroko_recipes to service_role;
grant all on public.arroko_inventory_snapshots to service_role;
grant all on public.arroko_inventory_movements to service_role;
grant all on public.arroko_orders to service_role;
grant all on public.arroko_order_items to service_role;
grant all on public.arroko_payments to service_role;
grant all on public.arroko_operation_events to service_role;
grant all on public.arroko_connectors to service_role;
grant all on public.arroko_sync_runs to service_role;
grant all on public.arroko_raw_events to service_role;
grant all on public.arroko_campaigns to service_role;
grant all on public.arroko_campaign_metrics_daily to service_role;
grant all on public.arroko_campaign_decisions to service_role;
grant all on public.arroko_audit_events to service_role;

notify pgrst, 'reload schema';

commit;


-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20260910121000_arroko_control_reporting_and_approvals.sql
-- ------------------------------------------------------------------------------
-- Read models and governed decisions for Arroko Control.
-- Depends on 20260910120000_arroko_control_core.sql.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create view public.arroko_latest_inventory
with (security_invoker = true)
as
select distinct on (snapshot.org_id, snapshot.location_id, snapshot.ingredient_id)
  snapshot.org_id,
  snapshot.location_id,
  snapshot.ingredient_id,
  ingredient.name as ingredient_name,
  ingredient.unit,
  ingredient.current_cost,
  ingredient.reorder_point,
  snapshot.quantity,
  snapshot.captured_at,
  snapshot.source,
  case
    when ingredient.reorder_point is null then 'unclassified'
    when snapshot.quantity <= ingredient.reorder_point then 'critical'
    when snapshot.quantity <= ingredient.reorder_point * 1.5 then 'watch'
    else 'healthy'
  end as stock_status
from public.arroko_inventory_snapshots snapshot
join public.arroko_ingredients ingredient
  on ingredient.org_id = snapshot.org_id
 and ingredient.id = snapshot.ingredient_id
order by
  snapshot.org_id,
  snapshot.location_id,
  snapshot.ingredient_id,
  snapshot.captured_at desc,
  snapshot.id desc;

create view public.arroko_daily_sales
with (security_invoker = true)
as
select
  orders.org_id,
  orders.location_id,
  (orders.closed_at at time zone locations.timezone)::date as sale_date,
  count(*)::bigint as order_count,
  count(orders.client_id)::bigint as identified_order_count,
  coalesce(sum(orders.total), 0)::numeric(14,2) as net_sales,
  coalesce(avg(orders.total), 0)::numeric(14,2) as average_ticket,
  coalesce(sum(orders.discount), 0)::numeric(14,2) as discounts
from public.arroko_orders orders
join public.arroko_locations locations
  on locations.org_id = orders.org_id
 and locations.id = orders.location_id
where orders.status = 'completed'
  and orders.closed_at is not null
group by orders.org_id, orders.location_id, sale_date;

revoke all on public.arroko_latest_inventory from anon, authenticated;
revoke all on public.arroko_daily_sales from anon, authenticated;
grant select on public.arroko_latest_inventory to authenticated;
grant select on public.arroko_daily_sales to authenticated;
grant select on public.arroko_latest_inventory to service_role;
grant select on public.arroko_daily_sales to service_role;

create or replace function public.arroko_dashboard_summary(
  p_org_id uuid,
  p_location_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_to <= p_from then
    raise exception 'invalid_date_range' using errcode = '22007';
  end if;

  if not public.arroko_has_org_role(
    p_org_id,
    array['viewer','sales','ops','admin','owner']
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.arroko_locations location
    where location.org_id = p_org_id
      and location.id = p_location_id
  ) then
    raise exception 'location_not_found' using errcode = 'P0002';
  end if;

  with sales as (
    select
      count(*)::integer as order_count,
      coalesce(sum(orders.total), 0)::numeric(14,2) as net_sales,
      coalesce(avg(orders.total), 0)::numeric(14,2) as average_ticket,
      coalesce(
        round(100.0 * count(orders.client_id) / nullif(count(*), 0), 1),
        0
      ) as identified_pct
    from public.arroko_orders orders
    where orders.org_id = p_org_id
      and orders.location_id = p_location_id
      and orders.status = 'completed'
      and orders.closed_at >= p_from
      and orders.closed_at < p_to
  ), campaign as (
    select
      coalesce(sum(metrics.spend), 0)::numeric(14,2) as spend,
      coalesce(sum(metrics.attributed_revenue), 0)::numeric(14,2) as attributed_revenue,
      coalesce(sum(metrics.attributed_orders), 0)::integer as attributed_orders
    from public.arroko_campaign_metrics_daily metrics
    join public.arroko_campaigns campaign
      on campaign.org_id = metrics.org_id
     and campaign.id = metrics.campaign_id
    where metrics.org_id = p_org_id
      and (campaign.location_id is null or campaign.location_id = p_location_id)
      and metrics.metric_date >= p_from::date
      and metrics.metric_date < p_to::date
  ), inventory as (
    select count(*) filter (where latest.stock_status = 'critical')::integer as critical_count
    from public.arroko_latest_inventory latest
    where latest.org_id = p_org_id
      and latest.location_id = p_location_id
  ), operations as (
    select count(*)::integer as open_incident_count
    from public.arroko_operation_events event
    where event.org_id = p_org_id
      and event.location_id = p_location_id
      and event.status in ('open','acknowledged')
  ), decisions as (
    select count(*)::integer as proposed_decision_count
    from public.arroko_campaign_decisions decision
    join public.arroko_campaigns campaign
      on campaign.org_id = decision.org_id
     and campaign.id = decision.campaign_id
    where decision.org_id = p_org_id
      and decision.status = 'proposed'
      and (campaign.location_id is null or campaign.location_id = p_location_id)
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'sales', jsonb_build_object(
      'net', sales.net_sales,
      'orders', sales.order_count,
      'average_ticket', sales.average_ticket,
      'identified_client_pct', sales.identified_pct
    ),
    'inventory', jsonb_build_object('critical_count', inventory.critical_count),
    'operations', jsonb_build_object('open_incident_count', operations.open_incident_count),
    'campaigns', jsonb_build_object(
      'spend', campaign.spend,
      'attributed_revenue', campaign.attributed_revenue,
      'attributed_orders', campaign.attributed_orders,
      'roas', case
        when campaign.spend > 0 then round(campaign.attributed_revenue / campaign.spend, 2)
        else 0
      end,
      'proposed_decision_count', decisions.proposed_decision_count
    )
  )
  into result
  from sales, campaign, inventory, operations, decisions;

  return result;
end;
$$;

revoke all on function public.arroko_dashboard_summary(uuid, uuid, timestamptz, timestamptz) from public;
grant execute on function public.arroko_dashboard_summary(uuid, uuid, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.arroko_dashboard_summary(uuid, uuid, timestamptz, timestamptz)
  to service_role;

create or replace function public.arroko_decide_campaign(
  p_decision_id uuid,
  p_action text,
  p_reason text default null
)
returns public.arroko_campaign_decisions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  decision public.arroko_campaign_decisions;
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_action not in ('approve','reject') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;

  select *
  into decision
  from public.arroko_campaign_decisions row_to_lock
  where row_to_lock.id = p_decision_id
  for update;

  if not found then
    raise exception 'decision_not_found' using errcode = 'P0002';
  end if;

  if not public.arroko_has_org_role(decision.org_id, array['admin','owner']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if decision.status <> 'proposed' then
    raise exception 'decision_already_resolved' using errcode = '55000';
  end if;

  if decision.expires_at is not null and decision.expires_at <= now() then
    update public.arroko_campaign_decisions
    set status = 'expired'
    where id = decision.id
    returning * into decision;

    insert into public.arroko_audit_events (
      org_id,
      actor_id,
      actor_type,
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      decision.org_id,
      actor,
      'user',
      'campaign_decision.expired',
      'campaign_decision',
      decision.id::text,
      jsonb_build_object('attempted_action', p_action, 'campaign_id', decision.campaign_id)
    );

    return decision;
  end if;

  update public.arroko_campaign_decisions
  set
    status = case when p_action = 'approve' then 'approved' else 'rejected' end,
    approved_by = case when p_action = 'approve' then actor else null end,
    approved_at = case when p_action = 'approve' then now() else null end
  where id = decision.id
  returning * into decision;

  insert into public.arroko_audit_events (
    org_id,
    actor_id,
    actor_type,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    decision.org_id,
    actor,
    'user',
    'campaign_decision.' || decision.status,
    'campaign_decision',
    decision.id::text,
    jsonb_build_object('reason', p_reason, 'campaign_id', decision.campaign_id)
  );

  return decision;
end;
$$;

revoke all on function public.arroko_decide_campaign(uuid, text, text) from public;
grant execute on function public.arroko_decide_campaign(uuid, text, text) to authenticated;
grant execute on function public.arroko_decide_campaign(uuid, text, text) to service_role;

notify pgrst, 'reload schema';

commit;


-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20260910122000_arroko_control_ingestion.sql
-- ------------------------------------------------------------------------------
-- Atomic normalized-event ingestion for Arroko Control.
-- Only service_role may call this function. Transport authentication lives in
-- the arroko-sync-ingest Edge Function; this function owns idempotency and writes.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.arroko_ingest_event(
  p_connector_id uuid,
  p_source_event_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_payload jsonb,
  p_payload_sha256 text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  connector public.arroko_connectors;
  raw_event_id uuid;
  target_id uuid;
  target_location_id uuid;
  target_ingredient_id uuid;
  target_order_id uuid;
  target_product_id uuid;
  target_campaign_id uuid;
  item jsonb;
  payment jsonb;
begin
  if p_source_event_id is null or char_length(p_source_event_id) not between 1 and 180 then
    raise exception 'invalid_source_event_id' using errcode = '22023';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  if p_payload_sha256 is null or p_payload_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_payload_hash' using errcode = '22023';
  end if;

  select *
  into connector
  from public.arroko_connectors row_to_lock
  where row_to_lock.id = p_connector_id
    and row_to_lock.status = 'active'
  for share;

  if not found then
    raise exception 'connector_not_active' using errcode = 'P0002';
  end if;

  insert into public.arroko_raw_events (
    org_id,
    connector_id,
    source_event_id,
    event_type,
    occurred_at,
    payload,
    payload_sha256
  ) values (
    connector.org_id,
    connector.id,
    p_source_event_id,
    p_event_type,
    p_occurred_at,
    p_payload,
    p_payload_sha256
  )
  on conflict (connector_id, source_event_id) do nothing
  returning id into raw_event_id;

  if raw_event_id is null then
    return jsonb_build_object(
      'applied', false,
      'duplicate', true,
      'source_event_id', p_source_event_id
    );
  end if;

  if p_event_type = 'product.upsert' then
    insert into public.arroko_products (
      org_id,
      external_id,
      sku,
      name,
      category,
      price,
      active,
      source_updated_at,
      metadata
    ) values (
      connector.org_id,
      p_payload->>'external_id',
      nullif(p_payload->>'sku', ''),
      p_payload->>'name',
      nullif(p_payload->>'category', ''),
      (p_payload->>'price')::numeric,
      coalesce((p_payload->>'active')::boolean, true),
      coalesce((p_payload->>'source_updated_at')::timestamptz, p_occurred_at),
      coalesce(p_payload->'metadata', '{}'::jsonb)
    )
    on conflict (org_id, external_id) do update set
      sku = excluded.sku,
      name = excluded.name,
      category = excluded.category,
      price = excluded.price,
      active = excluded.active,
      source_updated_at = excluded.source_updated_at,
      metadata = excluded.metadata
    where public.arroko_products.source_updated_at is null
       or excluded.source_updated_at >= public.arroko_products.source_updated_at
    returning id into target_id;

  elsif p_event_type = 'ingredient.upsert' then
    insert into public.arroko_ingredients (
      org_id,
      external_id,
      name,
      unit,
      current_cost,
      reorder_point,
      active,
      source_updated_at
    ) values (
      connector.org_id,
      p_payload->>'external_id',
      p_payload->>'name',
      p_payload->>'unit',
      nullif(p_payload->>'current_cost', '')::numeric,
      nullif(p_payload->>'reorder_point', '')::numeric,
      coalesce((p_payload->>'active')::boolean, true),
      coalesce((p_payload->>'source_updated_at')::timestamptz, p_occurred_at)
    )
    on conflict (org_id, external_id) do update set
      name = excluded.name,
      unit = excluded.unit,
      current_cost = excluded.current_cost,
      reorder_point = excluded.reorder_point,
      active = excluded.active,
      source_updated_at = excluded.source_updated_at
    where public.arroko_ingredients.source_updated_at is null
       or excluded.source_updated_at >= public.arroko_ingredients.source_updated_at
    returning id into target_id;

  elsif p_event_type = 'client.upsert' then
    if p_payload ?| array['phone','email','whatsapp'] then
      raise exception 'raw_pii_not_allowed' using errcode = '22023';
    end if;

    insert into public.arroko_clients (
      org_id,
      external_id,
      display_name,
      phone_last4,
      email_masked,
      contact_ref,
      marketing_consent,
      consent_source,
      consent_recorded_at,
      first_seen_at,
      last_seen_at,
      visit_count,
      lifetime_value,
      attributes
    ) values (
      connector.org_id,
      p_payload->>'external_id',
      nullif(p_payload->>'display_name', ''),
      nullif(p_payload->>'phone_last4', ''),
      nullif(p_payload->>'email_masked', ''),
      nullif(p_payload->>'contact_ref', ''),
      coalesce((p_payload->>'marketing_consent')::boolean, false),
      nullif(p_payload->>'consent_source', ''),
      nullif(p_payload->>'consent_recorded_at', '')::timestamptz,
      coalesce((p_payload->>'first_seen_at')::timestamptz, p_occurred_at),
      coalesce((p_payload->>'last_seen_at')::timestamptz, p_occurred_at),
      coalesce((p_payload->>'visit_count')::integer, 0),
      coalesce((p_payload->>'lifetime_value')::numeric, 0),
      coalesce(p_payload->'attributes', '{}'::jsonb)
    )
    on conflict (org_id, external_id) do update set
      display_name = excluded.display_name,
      phone_last4 = excluded.phone_last4,
      email_masked = excluded.email_masked,
      contact_ref = excluded.contact_ref,
      marketing_consent = excluded.marketing_consent,
      consent_source = excluded.consent_source,
      consent_recorded_at = excluded.consent_recorded_at,
      first_seen_at = least(public.arroko_clients.first_seen_at, excluded.first_seen_at),
      last_seen_at = greatest(public.arroko_clients.last_seen_at, excluded.last_seen_at),
      visit_count = greatest(public.arroko_clients.visit_count, excluded.visit_count),
      lifetime_value = greatest(public.arroko_clients.lifetime_value, excluded.lifetime_value),
      attributes = public.arroko_clients.attributes || excluded.attributes
    returning id into target_id;

  elsif p_event_type = 'inventory.snapshot' then
    target_location_id := connector.location_id;
    if target_location_id is null then
      select location.id into target_location_id
      from public.arroko_locations location
      where location.org_id = connector.org_id
        and location.softrestaurant_company_id = p_payload->>'location_external_id';
    end if;

    select ingredient.id into target_ingredient_id
    from public.arroko_ingredients ingredient
    where ingredient.org_id = connector.org_id
      and ingredient.external_id = p_payload->>'ingredient_external_id';

    if target_location_id is null or target_ingredient_id is null then
      raise exception 'inventory_reference_not_found' using errcode = 'P0002';
    end if;

    insert into public.arroko_inventory_snapshots (
      org_id,
      location_id,
      ingredient_id,
      quantity,
      captured_at,
      source,
      source_event_id
    ) values (
      connector.org_id,
      target_location_id,
      target_ingredient_id,
      (p_payload->>'quantity')::numeric,
      coalesce((p_payload->>'captured_at')::timestamptz, p_occurred_at),
      case when connector.provider = 'softrestaurant' then 'softrestaurant' else 'bridge' end,
      p_source_event_id
    ) returning id into target_id;

  elsif p_event_type = 'order.upsert' then
    target_location_id := connector.location_id;
    if target_location_id is null then
      select location.id into target_location_id
      from public.arroko_locations location
      where location.org_id = connector.org_id
        and location.softrestaurant_company_id = p_payload->>'location_external_id';
    end if;

    if target_location_id is null then
      raise exception 'order_location_not_found' using errcode = 'P0002';
    end if;

    insert into public.arroko_orders (
      org_id,
      location_id,
      external_id,
      client_id,
      channel,
      status,
      subtotal,
      discount,
      tax,
      total,
      opened_at,
      closed_at,
      source_updated_at,
      metadata
    ) values (
      connector.org_id,
      target_location_id,
      p_payload->>'external_id',
      (
        select client.id
        from public.arroko_clients client
        where client.org_id = connector.org_id
          and client.external_id = p_payload->>'client_external_id'
      ),
      coalesce(nullif(p_payload->>'channel', ''), 'unknown'),
      p_payload->>'status',
      coalesce((p_payload->>'subtotal')::numeric, 0),
      coalesce((p_payload->>'discount')::numeric, 0),
      coalesce((p_payload->>'tax')::numeric, 0),
      coalesce((p_payload->>'total')::numeric, 0),
      (p_payload->>'opened_at')::timestamptz,
      nullif(p_payload->>'closed_at', '')::timestamptz,
      coalesce((p_payload->>'source_updated_at')::timestamptz, p_occurred_at),
      coalesce(p_payload->'metadata', '{}'::jsonb)
    )
    on conflict (org_id, external_id) do update set
      location_id = excluded.location_id,
      client_id = coalesce(excluded.client_id, public.arroko_orders.client_id),
      channel = excluded.channel,
      status = excluded.status,
      subtotal = excluded.subtotal,
      discount = excluded.discount,
      tax = excluded.tax,
      total = excluded.total,
      opened_at = excluded.opened_at,
      closed_at = excluded.closed_at,
      source_updated_at = excluded.source_updated_at,
      metadata = excluded.metadata
    where public.arroko_orders.source_updated_at is null
       or excluded.source_updated_at >= public.arroko_orders.source_updated_at
    returning id into target_order_id;

    if target_order_id is null then
      select existing_order.id into target_order_id
      from public.arroko_orders existing_order
      where existing_order.org_id = connector.org_id
        and existing_order.external_id = p_payload->>'external_id';
    end if;

    if coalesce((p_payload->>'replace_lines')::boolean, false) then
      delete from public.arroko_order_items where order_id = target_order_id;
      delete from public.arroko_payments where order_id = target_order_id;
    end if;

    for item in select value from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb))
    loop
      select product.id into target_product_id
      from public.arroko_products product
      where product.org_id = connector.org_id
        and product.external_id = item->>'product_external_id';

      insert into public.arroko_order_items (
        org_id,
        order_id,
        product_id,
        external_line_id,
        product_name_snapshot,
        quantity,
        unit_price,
        discount,
        net_amount,
        metadata
      ) values (
        connector.org_id,
        target_order_id,
        target_product_id,
        item->>'external_line_id',
        item->>'name',
        (item->>'quantity')::numeric,
        (item->>'unit_price')::numeric,
        coalesce((item->>'discount')::numeric, 0),
        (item->>'net_amount')::numeric,
        coalesce(item->'metadata', '{}'::jsonb)
      )
      on conflict (order_id, external_line_id) do update set
        product_id = excluded.product_id,
        product_name_snapshot = excluded.product_name_snapshot,
        quantity = excluded.quantity,
        unit_price = excluded.unit_price,
        discount = excluded.discount,
        net_amount = excluded.net_amount,
        metadata = excluded.metadata;
    end loop;

    for payment in select value from jsonb_array_elements(coalesce(p_payload->'payments', '[]'::jsonb))
    loop
      insert into public.arroko_payments (
        org_id,
        order_id,
        external_id,
        method,
        amount,
        paid_at
      ) values (
        connector.org_id,
        target_order_id,
        nullif(payment->>'external_id', ''),
        coalesce(nullif(payment->>'method', ''), 'other'),
        (payment->>'amount')::numeric,
        coalesce((payment->>'paid_at')::timestamptz, p_occurred_at)
      )
      on conflict (order_id, external_id) do update set
        method = excluded.method,
        amount = excluded.amount,
        paid_at = excluded.paid_at;
    end loop;

    target_id := target_order_id;

  elsif p_event_type = 'operation.event' then
    target_location_id := connector.location_id;
    if target_location_id is null then
      raise exception 'operation_location_not_found' using errcode = 'P0002';
    end if;

    insert into public.arroko_operation_events (
      org_id,
      location_id,
      kind,
      severity,
      summary,
      details,
      status,
      occurred_at
    ) values (
      connector.org_id,
      target_location_id,
      p_payload->>'kind',
      p_payload->>'severity',
      p_payload->>'summary',
      coalesce(p_payload->'details', '{}'::jsonb),
      coalesce(nullif(p_payload->>'status', ''), 'open'),
      coalesce((p_payload->>'occurred_at')::timestamptz, p_occurred_at)
    ) returning id into target_id;

  elsif p_event_type = 'campaign.upsert' then
    insert into public.arroko_campaigns (
      org_id,
      location_id,
      platform,
      external_id,
      name,
      objective,
      status,
      daily_budget,
      started_at,
      ended_at,
      source_updated_at
    ) values (
      connector.org_id,
      connector.location_id,
      p_payload->>'platform',
      p_payload->>'external_id',
      p_payload->>'name',
      nullif(p_payload->>'objective', ''),
      p_payload->>'status',
      nullif(p_payload->>'daily_budget', '')::numeric,
      nullif(p_payload->>'started_at', '')::timestamptz,
      nullif(p_payload->>'ended_at', '')::timestamptz,
      coalesce((p_payload->>'source_updated_at')::timestamptz, p_occurred_at)
    )
    on conflict (org_id, platform, external_id) do update set
      location_id = excluded.location_id,
      name = excluded.name,
      objective = excluded.objective,
      status = excluded.status,
      daily_budget = excluded.daily_budget,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      source_updated_at = excluded.source_updated_at
    where public.arroko_campaigns.source_updated_at is null
       or excluded.source_updated_at >= public.arroko_campaigns.source_updated_at
    returning id into target_id;

  elsif p_event_type = 'campaign.metrics' then
    select campaign.id into target_campaign_id
    from public.arroko_campaigns campaign
    where campaign.org_id = connector.org_id
      and campaign.platform = p_payload->>'platform'
      and campaign.external_id = p_payload->>'campaign_external_id';

    if target_campaign_id is null then
      raise exception 'campaign_not_found' using errcode = 'P0002';
    end if;

    insert into public.arroko_campaign_metrics_daily (
      org_id,
      campaign_id,
      metric_date,
      spend,
      impressions,
      clicks,
      messages,
      platform_conversions,
      attributed_orders,
      attributed_revenue,
      attribution_model,
      source_updated_at
    ) values (
      connector.org_id,
      target_campaign_id,
      (p_payload->>'metric_date')::date,
      coalesce((p_payload->>'spend')::numeric, 0),
      coalesce((p_payload->>'impressions')::bigint, 0),
      coalesce((p_payload->>'clicks')::bigint, 0),
      coalesce((p_payload->>'messages')::bigint, 0),
      coalesce((p_payload->>'platform_conversions')::numeric, 0),
      coalesce((p_payload->>'attributed_orders')::integer, 0),
      coalesce((p_payload->>'attributed_revenue')::numeric, 0),
      coalesce(nullif(p_payload->>'attribution_model', ''), 'unverified'),
      coalesce((p_payload->>'source_updated_at')::timestamptz, p_occurred_at)
    )
    on conflict (campaign_id, metric_date) do update set
      spend = excluded.spend,
      impressions = excluded.impressions,
      clicks = excluded.clicks,
      messages = excluded.messages,
      platform_conversions = excluded.platform_conversions,
      attributed_orders = excluded.attributed_orders,
      attributed_revenue = excluded.attributed_revenue,
      attribution_model = excluded.attribution_model,
      source_updated_at = excluded.source_updated_at
    where public.arroko_campaign_metrics_daily.source_updated_at is null
       or excluded.source_updated_at >= public.arroko_campaign_metrics_daily.source_updated_at;

    target_id := target_campaign_id;

  else
    raise exception 'unsupported_event_type: %', p_event_type using errcode = '22023';
  end if;

  update public.arroko_raw_events
  set processed_at = now()
  where id = raw_event_id;

  return jsonb_build_object(
    'applied', true,
    'duplicate', false,
    'event_id', raw_event_id,
    'target_id', target_id,
    'event_type', p_event_type
  );
end;
$$;

revoke all on function public.arroko_ingest_event(uuid, text, text, timestamptz, jsonb, text) from public;
grant execute on function public.arroko_ingest_event(uuid, text, text, timestamptz, jsonb, text)
  to service_role;

notify pgrst, 'reload schema';

commit;


-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20260914120000_arroko_customer_memory_and_checkins.sql
-- ------------------------------------------------------------------------------
-- Arroko customer memory, NFC/QR check-ins and ArroKids engagement.
-- Extends the existing Arroko Control schema without changing prior migrations.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.arroko_households (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  primary_client_id uuid not null,
  display_label text,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, primary_client_id)
    references public.arroko_clients(org_id, id) on delete restrict
);

create table public.arroko_household_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null,
  client_id uuid not null,
  relationship text not null default 'responsible_adult'
    check (relationship in ('responsible_adult','adult_member')),
  created_at timestamptz not null default now(),
  primary key (household_id, client_id),
  foreign key (org_id, household_id)
    references public.arroko_households(org_id, id) on delete cascade,
  foreign key (org_id, client_id)
    references public.arroko_clients(org_id, id) on delete cascade
);

create table public.arroko_child_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null,
  alias text not null check (char_length(btrim(alias)) between 1 and 40),
  age_band text check (age_band is null or age_band in ('3-5','6-8','9-12','13-15')),
  avatar_key text,
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (household_id, alias),
  foreign key (org_id, household_id)
    references public.arroko_households(org_id, id) on delete cascade
);

comment on table public.arroko_child_profiles is
  'Pseudonymous child profiles. Never store phone, email, address or full birth date here.';

create table public.arroko_checkin_points (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  label text not null check (char_length(btrim(label)) between 1 and 100),
  channel text not null default 'nfc' check (channel in ('nfc','qr','table','staff','campaign')),
  campaign_id uuid,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (slug),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete cascade,
  foreign key (org_id, campaign_id)
    references public.arroko_campaigns(org_id, id) on delete set null
);

create table public.arroko_visits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null,
  client_id uuid not null,
  household_id uuid,
  checkin_point_id uuid,
  access_token_hash text not null check (access_token_hash ~ '^[a-f0-9]{64}$'),
  source text not null default 'nfc' check (source in ('nfc','qr','table','staff','campaign','import')),
  status text not null default 'open' check (status in ('open','closed','cancelled')),
  party_size integer check (party_size is null or party_size between 1 and 40),
  table_ref text,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (access_token_hash),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete restrict,
  foreign key (org_id, client_id)
    references public.arroko_clients(org_id, id) on delete restrict,
  foreign key (org_id, household_id)
    references public.arroko_households(org_id, id) on delete set null,
  foreign key (org_id, checkin_point_id)
    references public.arroko_checkin_points(org_id, id) on delete set null,
  check (checked_out_at is null or checked_out_at >= checked_in_at)
);

create table public.arroko_visit_orders (
  org_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid not null,
  order_id uuid not null,
  match_method text not null default 'manual'
    check (match_method in ('external_customer','table_time','receipt_code','manual')),
  confidence numeric(4,3) not null default 1 check (confidence between 0 and 1),
  linked_at timestamptz not null default now(),
  primary key (visit_id, order_id),
  unique (order_id),
  foreign key (org_id, visit_id)
    references public.arroko_visits(org_id, id) on delete cascade,
  foreign key (org_id, order_id)
    references public.arroko_orders(org_id, id) on delete cascade
);

create table public.arroko_game_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  game_key text not null check (game_key ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  points_rule jsonb not null default '{}'::jsonb check (jsonb_typeof(points_rule) = 'object'),
  active boolean not null default true,
  seasonal_from date,
  seasonal_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, game_key),
  check (seasonal_until is null or seasonal_from is null or seasonal_until >= seasonal_from)
);

create table public.arroko_game_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid not null,
  child_profile_id uuid not null,
  game_definition_id uuid not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  status text not null default 'completed' check (status in ('started','completed','abandoned','invalidated')),
  score integer not null default 0 check (score >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 10800),
  points_awarded integer not null default 0 check (points_awarded >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, idempotency_key),
  foreign key (org_id, visit_id)
    references public.arroko_visits(org_id, id) on delete cascade,
  foreign key (org_id, child_profile_id)
    references public.arroko_child_profiles(org_id, id) on delete restrict,
  foreign key (org_id, game_definition_id)
    references public.arroko_game_definitions(org_id, id) on delete restrict,
  check (completed_at is null or completed_at >= started_at)
);

create table public.arroko_reward_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null,
  child_profile_id uuid,
  visit_id uuid,
  game_session_id uuid,
  points_delta integer not null check (points_delta <> 0),
  reason text not null check (reason in ('game_score','visit_bonus','manual_adjustment','redemption','expiration')),
  reference_key text not null check (char_length(reference_key) between 3 and 160),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, reference_key),
  foreign key (org_id, household_id)
    references public.arroko_households(org_id, id) on delete cascade,
  foreign key (org_id, child_profile_id)
    references public.arroko_child_profiles(org_id, id) on delete set null,
  foreign key (org_id, visit_id)
    references public.arroko_visits(org_id, id) on delete set null,
  foreign key (org_id, game_session_id)
    references public.arroko_game_sessions(org_id, id) on delete set null
);

create table public.arroko_reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null,
  child_profile_id uuid,
  visit_id uuid,
  reward_key text not null,
  reward_label text not null,
  points_cost integer not null check (points_cost > 0),
  status text not null default 'requested' check (status in ('requested','approved','fulfilled','cancelled')),
  approved_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (org_id, id),
  foreign key (org_id, household_id)
    references public.arroko_households(org_id, id) on delete restrict,
  foreign key (org_id, child_profile_id)
    references public.arroko_child_profiles(org_id, id) on delete set null,
  foreign key (org_id, visit_id)
    references public.arroko_visits(org_id, id) on delete set null,
  check (fulfilled_at is null or fulfilled_at >= requested_at)
);

create table public.arroko_consent_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  household_id uuid,
  scope text not null check (scope in ('service','loyalty','marketing_whatsapp','marketing_email','personalization','child_participation')),
  granted boolean not null,
  policy_version text not null,
  source text not null check (source in ('checkin','staff','web','import','withdrawal')),
  evidence_ref text,
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  foreign key (org_id, client_id)
    references public.arroko_clients(org_id, id) on delete cascade,
  foreign key (org_id, household_id)
    references public.arroko_households(org_id, id) on delete set null
);

create table public.arroko_knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  node_type text not null check (node_type in ('client','household','child','visit','order','product','game','reward','campaign','preference','segment')),
  entity_id uuid,
  canonical_key text not null,
  label text,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, canonical_key)
);

create table public.arroko_knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject_node_id uuid not null,
  predicate text not null check (predicate ~ '^[a-z][a-z0-9_]{1,63}$'),
  object_node_id uuid,
  value jsonb,
  assertion_kind text not null default 'fact' check (assertion_kind in ('fact','inference')),
  confidence numeric(4,3) not null default 1 check (confidence between 0 and 1),
  provenance_type text not null check (provenance_type in ('checkin','softrestaurant','game','staff','campaign','model','derived')),
  provenance_ref text not null,
  consent_scope text,
  observed_at timestamptz not null default now(),
  valid_until timestamptz,
  superseded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (org_id, subject_node_id)
    references public.arroko_knowledge_nodes(org_id, id) on delete cascade,
  foreign key (org_id, object_node_id)
    references public.arroko_knowledge_nodes(org_id, id) on delete cascade,
  check ((object_node_id is not null) <> (value is not null)),
  check (valid_until is null or valid_until >= observed_at)
);

-- Foreign-key and timeline indexes used by CRM and reporting queries.
create index arroko_households_primary_client_idx on public.arroko_households (org_id, primary_client_id);
create unique index arroko_clients_contact_ref_uidx on public.arroko_clients (org_id, contact_ref) where contact_ref is not null;
create index arroko_household_members_client_idx on public.arroko_household_members (org_id, client_id);
create index arroko_child_profiles_household_idx on public.arroko_child_profiles (org_id, household_id) where active;
create index arroko_checkin_points_location_idx on public.arroko_checkin_points (org_id, location_id) where active;
create index arroko_visits_client_time_idx on public.arroko_visits (org_id, client_id, checked_in_at desc);
create index arroko_visits_location_open_idx on public.arroko_visits (org_id, location_id, checked_in_at desc) where status = 'open';
create index arroko_visits_household_idx on public.arroko_visits (org_id, household_id, checked_in_at desc);
create index arroko_visit_orders_visit_idx on public.arroko_visit_orders (org_id, visit_id);
create index arroko_game_sessions_child_time_idx on public.arroko_game_sessions (org_id, child_profile_id, completed_at desc);
create index arroko_game_sessions_visit_idx on public.arroko_game_sessions (org_id, visit_id);
create index arroko_reward_ledger_household_idx on public.arroko_reward_ledger (org_id, household_id, created_at desc);
create index arroko_reward_ledger_child_idx on public.arroko_reward_ledger (org_id, child_profile_id, created_at desc);
create index arroko_reward_redemptions_status_idx on public.arroko_reward_redemptions (org_id, status, requested_at desc);
create index arroko_consent_events_client_idx on public.arroko_consent_events (org_id, client_id, scope, recorded_at desc);
create index arroko_knowledge_nodes_entity_idx on public.arroko_knowledge_nodes (org_id, node_type, entity_id);
create index arroko_knowledge_edges_subject_idx on public.arroko_knowledge_edges (org_id, subject_node_id, observed_at desc) where superseded_at is null;
create index arroko_knowledge_edges_object_idx on public.arroko_knowledge_edges (org_id, object_node_id) where object_node_id is not null and superseded_at is null;

-- Keep mutable entities timestamped consistently with the existing schema.
create trigger arroko_households_set_updated_at before update on public.arroko_households
  for each row execute function public.arroko_set_updated_at();
create trigger arroko_child_profiles_set_updated_at before update on public.arroko_child_profiles
  for each row execute function public.arroko_set_updated_at();
create trigger arroko_checkin_points_set_updated_at before update on public.arroko_checkin_points
  for each row execute function public.arroko_set_updated_at();
create trigger arroko_visits_set_updated_at before update on public.arroko_visits
  for each row execute function public.arroko_set_updated_at();
create trigger arroko_game_definitions_set_updated_at before update on public.arroko_game_definitions
  for each row execute function public.arroko_set_updated_at();
create trigger arroko_knowledge_nodes_set_updated_at before update on public.arroko_knowledge_nodes
  for each row execute function public.arroko_set_updated_at();

-- One row per adult client, with visit ticket and family engagement kept separate.
create view public.arroko_customer_360
with (security_invoker = true)
as
select
  c.org_id,
  c.id as client_id,
  c.display_name,
  c.phone_last4,
  c.marketing_consent,
  c.first_seen_at,
  coalesce(v.last_visit_at, c.last_seen_at) as last_visit_at,
  coalesce(v.visit_count, 0) as visit_count,
  coalesce(o.total_spend, 0)::numeric(14,2) as total_spend,
  coalesce(o.average_ticket, 0)::numeric(14,2) as average_ticket,
  coalesce(g.game_sessions, 0) as family_game_sessions,
  coalesce(g.points_balance, 0) as family_points_balance
from public.arroko_clients c
left join lateral (
  select count(*)::integer as visit_count, max(checked_in_at) as last_visit_at
  from public.arroko_visits v0
  where v0.org_id = c.org_id and v0.client_id = c.id and v0.status <> 'cancelled'
) v on true
left join lateral (
  select sum(ord.total) as total_spend, avg(ord.total) as average_ticket
  from public.arroko_visits v1
  join public.arroko_visit_orders vo on vo.org_id = v1.org_id and vo.visit_id = v1.id
  join public.arroko_orders ord on ord.org_id = vo.org_id and ord.id = vo.order_id
  where v1.org_id = c.org_id and v1.client_id = c.id and ord.status not in ('cancelled','voided')
) o on true
left join lateral (
  select
    (select count(*)::integer from public.arroko_game_sessions gs
      join public.arroko_visits gv on gv.org_id = gs.org_id and gv.id = gs.visit_id
      where gv.org_id = c.org_id and gv.client_id = c.id and gs.status = 'completed') as game_sessions,
    (select coalesce(sum(rl.points_delta),0)::integer from public.arroko_reward_ledger rl
      join public.arroko_households h on h.org_id = rl.org_id and h.id = rl.household_id
      where h.org_id = c.org_id and h.primary_client_id = c.id) as points_balance
) g on true;

alter table public.arroko_households enable row level security;
alter table public.arroko_household_members enable row level security;
alter table public.arroko_child_profiles enable row level security;
alter table public.arroko_checkin_points enable row level security;
alter table public.arroko_visits enable row level security;
alter table public.arroko_visit_orders enable row level security;
alter table public.arroko_game_definitions enable row level security;
alter table public.arroko_game_sessions enable row level security;
alter table public.arroko_reward_ledger enable row level security;
alter table public.arroko_reward_redemptions enable row level security;
alter table public.arroko_consent_events enable row level security;
alter table public.arroko_knowledge_nodes enable row level security;
alter table public.arroko_knowledge_edges enable row level security;

create policy "Arroko CRM roles read households" on public.arroko_households for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko CRM roles read household members" on public.arroko_household_members for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko CRM roles read child aliases" on public.arroko_child_profiles for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko members read checkin points" on public.arroko_checkin_points for select to authenticated
  using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko CRM roles read visits" on public.arroko_visits for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko CRM roles read visit orders" on public.arroko_visit_orders for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko members read games" on public.arroko_game_definitions for select to authenticated
  using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko CRM roles read game sessions" on public.arroko_game_sessions for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko CRM roles read rewards" on public.arroko_reward_ledger for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko CRM roles read redemptions" on public.arroko_reward_redemptions for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko admins read consents" on public.arroko_consent_events for select to authenticated
  using (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko CRM roles read knowledge nodes" on public.arroko_knowledge_nodes for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko CRM roles read knowledge edges" on public.arroko_knowledge_edges for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));

-- Human changes are restricted; public NFC/QR traffic is accepted only by the Edge Function using service_role.
create policy "Arroko admins manage checkin points" on public.arroko_checkin_points for all to authenticated
  using (public.arroko_has_org_role(org_id, array['admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko admins manage games" on public.arroko_game_definitions for all to authenticated
  using (public.arroko_has_org_role(org_id, array['admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko staff update visits" on public.arroko_visits for update to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko staff manage redemptions" on public.arroko_reward_redemptions for all to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));

-- Atomic write boundary used by the public check-in Edge Function. The raw phone never enters SQL.
create or replace function public.arroko_public_checkin(
  p_checkin_slug text,
  p_contact_ref text,
  p_phone_last4 text,
  p_display_name text,
  p_access_token_hash text,
  p_marketing_consent boolean,
  p_child_participation_consent boolean,
  p_policy_version text,
  p_party_size integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_point public.arroko_checkin_points%rowtype;
  v_client public.arroko_clients%rowtype;
  v_household public.arroko_households%rowtype;
  v_visit public.arroko_visits%rowtype;
  v_client_node_id uuid;
  v_visit_node_id uuid;
begin
  if p_contact_ref is null or char_length(p_contact_ref) < 32 then
    raise exception 'invalid_contact_ref';
  end if;
  if p_phone_last4 !~ '^[0-9]{4}$' or p_access_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_public_identifier';
  end if;
  if p_party_size is not null and (p_party_size < 1 or p_party_size > 40) then
    raise exception 'invalid_party_size';
  end if;

  select * into v_point
  from public.arroko_checkin_points
  where slug = p_checkin_slug and active
  limit 1;
  if not found then raise exception 'checkin_point_not_found'; end if;

  insert into public.arroko_clients (
    org_id, display_name, phone_last4, contact_ref, marketing_consent,
    consent_source, consent_recorded_at, first_seen_at, last_seen_at, visit_count
  ) values (
    v_point.org_id, nullif(btrim(p_display_name), ''), p_phone_last4, p_contact_ref,
    p_marketing_consent, 'checkin', case when p_marketing_consent then now() else null end,
    now(), now(), 1
  )
  on conflict (org_id, contact_ref) where contact_ref is not null do update set
    display_name = coalesce(excluded.display_name, public.arroko_clients.display_name),
    phone_last4 = excluded.phone_last4,
    marketing_consent = excluded.marketing_consent,
    consent_source = 'checkin',
    consent_recorded_at = case when excluded.marketing_consent then now() else public.arroko_clients.consent_recorded_at end,
    last_seen_at = now(),
    visit_count = public.arroko_clients.visit_count + 1
  returning * into v_client;

  select * into v_household
  from public.arroko_households
  where org_id = v_point.org_id and primary_client_id = v_client.id
  order by created_at asc limit 1;
  if not found then
    insert into public.arroko_households (org_id, primary_client_id, display_label)
    values (v_point.org_id, v_client.id, coalesce(v_client.display_name, 'Familia Arroko'))
    returning * into v_household;
    insert into public.arroko_household_members (org_id, household_id, client_id)
    values (v_point.org_id, v_household.id, v_client.id);
  end if;

  insert into public.arroko_visits (
    org_id, location_id, client_id, household_id, checkin_point_id,
    access_token_hash, source, party_size, metadata
  ) values (
    v_point.org_id, v_point.location_id, v_client.id, v_household.id, v_point.id,
    p_access_token_hash, v_point.channel, p_party_size, coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_visit;

  insert into public.arroko_consent_events
    (org_id, client_id, household_id, scope, granted, policy_version, source, evidence_ref)
  values
    (v_point.org_id, v_client.id, v_household.id, 'service', true, p_policy_version, 'checkin', v_visit.id::text),
    (v_point.org_id, v_client.id, v_household.id, 'marketing_whatsapp', p_marketing_consent, p_policy_version, 'checkin', v_visit.id::text),
    (v_point.org_id, v_client.id, v_household.id, 'child_participation', p_child_participation_consent, p_policy_version, 'checkin', v_visit.id::text);

  insert into public.arroko_knowledge_nodes (org_id, node_type, entity_id, canonical_key, label)
  values (v_point.org_id, 'client', v_client.id, 'client:' || v_client.id, v_client.display_name)
  on conflict (org_id, canonical_key) do update set label = coalesce(excluded.label, public.arroko_knowledge_nodes.label)
  returning id into v_client_node_id;
  insert into public.arroko_knowledge_nodes (org_id, node_type, entity_id, canonical_key, label)
  values (v_point.org_id, 'visit', v_visit.id, 'visit:' || v_visit.id, 'Visita ' || to_char(v_visit.checked_in_at, 'YYYY-MM-DD HH24:MI'))
  returning id into v_visit_node_id;
  insert into public.arroko_knowledge_edges (
    org_id, subject_node_id, predicate, object_node_id, assertion_kind,
    provenance_type, provenance_ref, consent_scope, observed_at
  ) values (
    v_point.org_id, v_client_node_id, 'checked_in', v_visit_node_id, 'fact',
    'checkin', v_visit.id::text, 'service', v_visit.checked_in_at
  );

  return jsonb_build_object(
    'visit_id', v_visit.id,
    'client_id', v_client.id,
    'household_id', v_household.id,
    'checked_in_at', v_visit.checked_in_at
  );
end;
$$;

create or replace function public.arroko_public_game_complete(
  p_access_token_hash text,
  p_game_key text,
  p_child_alias text,
  p_age_band text,
  p_idempotency_key text,
  p_score integer,
  p_duration_seconds integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.arroko_visits%rowtype;
  v_child public.arroko_child_profiles%rowtype;
  v_game public.arroko_game_definitions%rowtype;
  v_session public.arroko_game_sessions%rowtype;
  v_consent boolean;
  v_points integer;
  v_balance integer;
  v_child_node_id uuid;
  v_game_node_id uuid;
begin
  select * into v_visit from public.arroko_visits
  where access_token_hash = p_access_token_hash and status = 'open'
    and checked_in_at >= now() - interval '18 hours'
  limit 1;
  if not found then raise exception 'visit_not_found_or_expired'; end if;
  if v_visit.household_id is null then raise exception 'household_required'; end if;

  select granted into v_consent from public.arroko_consent_events
  where org_id = v_visit.org_id and client_id = v_visit.client_id and scope = 'child_participation'
  order by recorded_at desc limit 1;
  if coalesce(v_consent, false) is not true then raise exception 'child_consent_required'; end if;

  select * into v_game from public.arroko_game_definitions
  where org_id = v_visit.org_id and game_key = p_game_key and active
    and (seasonal_from is null or seasonal_from <= current_date)
    and (seasonal_until is null or seasonal_until >= current_date)
  limit 1;
  if not found then raise exception 'game_not_available'; end if;

  insert into public.arroko_child_profiles (org_id, household_id, alias, age_band)
  values (v_visit.org_id, v_visit.household_id, btrim(p_child_alias), p_age_band)
  on conflict (household_id, alias) do update set
    age_band = coalesce(excluded.age_band, public.arroko_child_profiles.age_band), active = true
  returning * into v_child;

  v_points := least(
    coalesce((v_game.points_rule ->> 'max_points')::integer, 250),
    coalesce((v_game.points_rule ->> 'base_points')::integer, 10)
      + floor(greatest(p_score, 0)::numeric / greatest(coalesce((v_game.points_rule ->> 'score_divisor')::integer, 10), 1))::integer
  );

  insert into public.arroko_game_sessions (
    org_id, visit_id, child_profile_id, game_definition_id, idempotency_key,
    status, score, duration_seconds, points_awarded, completed_at, metadata
  ) values (
    v_visit.org_id, v_visit.id, v_child.id, v_game.id, p_idempotency_key,
    'completed', greatest(p_score, 0), p_duration_seconds, v_points, now(), coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (org_id, idempotency_key) do nothing
  returning * into v_session;

  if not found then
    select * into v_session from public.arroko_game_sessions
    where org_id = v_visit.org_id and idempotency_key = p_idempotency_key;
  else
    insert into public.arroko_reward_ledger (
      org_id, household_id, child_profile_id, visit_id, game_session_id,
      points_delta, reason, reference_key
    ) values (
      v_visit.org_id, v_visit.household_id, v_child.id, v_visit.id, v_session.id,
      v_points, 'game_score', 'game-session:' || v_session.id
    );

    insert into public.arroko_knowledge_nodes (org_id, node_type, entity_id, canonical_key, label)
    values (v_visit.org_id, 'child', v_child.id, 'child:' || v_child.id, v_child.alias)
    on conflict (org_id, canonical_key) do update set label = excluded.label
    returning id into v_child_node_id;
    insert into public.arroko_knowledge_nodes (org_id, node_type, entity_id, canonical_key, label)
    values (v_visit.org_id, 'game', v_game.id, 'game:' || v_game.id, v_game.name)
    on conflict (org_id, canonical_key) do update set label = excluded.label
    returning id into v_game_node_id;
    insert into public.arroko_knowledge_edges (
      org_id, subject_node_id, predicate, object_node_id, assertion_kind,
      confidence, provenance_type, provenance_ref, consent_scope, observed_at,
      metadata
    ) values (
      v_visit.org_id, v_child_node_id, 'played_game', v_game_node_id, 'fact',
      1, 'game', v_session.id::text, 'child_participation', v_session.completed_at,
      jsonb_build_object('score', v_session.score, 'points', v_session.points_awarded)
    );
  end if;

  select coalesce(sum(points_delta), 0)::integer into v_balance
  from public.arroko_reward_ledger
  where org_id = v_visit.org_id and household_id = v_visit.household_id;

  return jsonb_build_object(
    'game_session_id', v_session.id,
    'child_profile_id', v_child.id,
    'score', v_session.score,
    'points_awarded', v_session.points_awarded,
    'points_balance', v_balance
  );
end;
$$;

revoke all on function public.arroko_public_checkin(text,text,text,text,text,boolean,boolean,text,integer,jsonb) from public;
revoke all on function public.arroko_public_game_complete(text,text,text,text,text,integer,integer,jsonb) from public;
grant execute on function public.arroko_public_checkin(text,text,text,text,text,boolean,boolean,text,integer,jsonb) to service_role;
grant execute on function public.arroko_public_game_complete(text,text,text,text,text,integer,integer,jsonb) to service_role;

revoke all on table
  public.arroko_households,
  public.arroko_household_members,
  public.arroko_child_profiles,
  public.arroko_checkin_points,
  public.arroko_visits,
  public.arroko_visit_orders,
  public.arroko_game_definitions,
  public.arroko_game_sessions,
  public.arroko_reward_ledger,
  public.arroko_reward_redemptions,
  public.arroko_consent_events,
  public.arroko_knowledge_nodes,
  public.arroko_knowledge_edges
from anon;

grant select on public.arroko_customer_360 to authenticated;

commit;


-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20260914122000_arroko_function_acl_hardening.sql
-- ------------------------------------------------------------------------------
-- Supabase may materialize API-role EXECUTE grants for functions in public.
-- Make the Arroko function boundary explicit after all functions exist.

begin;

revoke execute on function public.arroko_has_org_role(uuid, text[]) from anon;
revoke execute on function public.arroko_dashboard_summary(uuid, uuid, timestamptz, timestamptz) from anon;
revoke execute on function public.arroko_decide_campaign(uuid, text, text) from anon;

revoke execute on function public.arroko_ingest_event(uuid, text, text, timestamptz, jsonb, text) from anon, authenticated;
grant execute on function public.arroko_ingest_event(uuid, text, text, timestamptz, jsonb, text) to service_role;

revoke execute on function public.arroko_public_checkin(text,text,text,text,text,boolean,boolean,text,integer,jsonb) from anon, authenticated;
revoke execute on function public.arroko_public_game_complete(text,text,text,text,text,integer,integer,jsonb) from anon, authenticated;
grant execute on function public.arroko_public_checkin(text,text,text,text,text,boolean,boolean,text,integer,jsonb) to service_role;
grant execute on function public.arroko_public_game_complete(text,text,text,text,text,integer,integer,jsonb) to service_role;

commit;


-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20260914123000_arroko_public_rate_limit.sql
-- ------------------------------------------------------------------------------
-- Contact-level abuse guard for public NFC/QR check-ins.

begin;

create or replace function public.arroko_enforce_checkin_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source in ('nfc','qr','table','campaign') and (
    select count(*)
    from public.arroko_visits recent
    where recent.org_id = new.org_id
      and recent.client_id = new.client_id
      and recent.checked_in_at >= now() - interval '10 minutes'
      and recent.status <> 'cancelled'
  ) >= 3 then
    raise exception 'checkin_rate_limited';
  end if;
  return new;
end;
$$;

revoke all on function public.arroko_enforce_checkin_rate_limit() from public, anon, authenticated;

create trigger arroko_visits_public_rate_limit
before insert on public.arroko_visits
for each row execute function public.arroko_enforce_checkin_rate_limit();

commit;


-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20260914130000_arroko_promotional_rewards.sql
-- ------------------------------------------------------------------------------
-- Promotional rewards issued by the Arroko public roulette.
-- Public traffic stays behind a service-role RPC; CRM staff gets an auditable lifecycle.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.arroko_reward_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  reward_key text not null check (reward_key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  active boolean not null default true,
  is_winning boolean not null default true,
  expires_after_days smallint not null default 30 check (expires_after_days between 1 and 365),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, reward_key)
);

create table public.arroko_reward_claims (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid not null,
  client_id uuid not null,
  reward_definition_id uuid not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  status text not null default 'claimed' check (status in ('claimed','redeemed','expired','cancelled')),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, idempotency_key),
  unique (visit_id),
  foreign key (org_id, visit_id) references public.arroko_visits(org_id, id) on delete cascade,
  foreign key (org_id, client_id) references public.arroko_clients(org_id, id) on delete restrict,
  foreign key (org_id, reward_definition_id) references public.arroko_reward_definitions(org_id, id) on delete restrict,
  check (redeemed_at is null or redeemed_at <= updated_at)
);

create index arroko_reward_claims_client_time_idx on public.arroko_reward_claims (org_id, client_id, created_at desc);
create index arroko_reward_claims_status_expiry_idx on public.arroko_reward_claims (org_id, status, expires_at);

create trigger arroko_reward_definitions_set_updated_at before update on public.arroko_reward_definitions
  for each row execute function public.arroko_set_updated_at();
create trigger arroko_reward_claims_set_updated_at before update on public.arroko_reward_claims
  for each row execute function public.arroko_set_updated_at();

alter table public.arroko_reward_definitions enable row level security;
alter table public.arroko_reward_claims enable row level security;

create policy "Arroko members read reward definitions" on public.arroko_reward_definitions for select to authenticated
  using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko admins manage reward definitions" on public.arroko_reward_definitions for all to authenticated
  using (public.arroko_has_org_role(org_id, array['admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko CRM roles read reward claims" on public.arroko_reward_claims for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko staff update reward claims" on public.arroko_reward_claims for update to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));

create or replace function public.arroko_public_reward_claim(
  p_access_token_hash text,
  p_reward_key text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.arroko_visits%rowtype;
  v_reward public.arroko_reward_definitions%rowtype;
  v_claim public.arroko_reward_claims%rowtype;
  v_client_node_id uuid;
  v_reward_node_id uuid;
begin
  select * into v_visit from public.arroko_visits
  where access_token_hash = p_access_token_hash and status = 'open'
    and checked_in_at >= now() - interval '18 hours'
  limit 1;
  if not found then raise exception 'visit_not_found_or_expired'; end if;

  select * into v_reward from public.arroko_reward_definitions
  where org_id = v_visit.org_id and reward_key = p_reward_key and active
  limit 1;
  if not found then raise exception 'reward_not_available'; end if;

  insert into public.arroko_reward_claims (
    org_id, visit_id, client_id, reward_definition_id, idempotency_key, expires_at, metadata
  ) values (
    v_visit.org_id, v_visit.id, v_visit.client_id, v_reward.id, p_idempotency_key,
    now() + make_interval(days => v_reward.expires_after_days), coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (visit_id) do nothing
  returning * into v_claim;

  if not found then
    select * into v_claim from public.arroko_reward_claims where visit_id = v_visit.id;
  else
    insert into public.arroko_knowledge_nodes (org_id, node_type, entity_id, canonical_key, label)
    values (v_visit.org_id, 'client', v_visit.client_id, 'client:' || v_visit.client_id, null)
    on conflict (org_id, canonical_key) do update set updated_at = now()
    returning id into v_client_node_id;

    insert into public.arroko_knowledge_nodes (org_id, node_type, entity_id, canonical_key, label, attributes)
    values (
      v_visit.org_id, 'reward', v_claim.id, 'reward-claim:' || v_claim.id, v_reward.label,
      jsonb_build_object('reward_key', v_reward.reward_key, 'is_winning', v_reward.is_winning)
    )
    returning id into v_reward_node_id;

    insert into public.arroko_knowledge_edges (
      org_id, subject_node_id, predicate, object_node_id, assertion_kind,
      provenance_type, provenance_ref, consent_scope, observed_at
    ) values (
      v_visit.org_id, v_client_node_id, 'claimed_reward', v_reward_node_id, 'fact',
      'campaign', v_claim.id::text, 'loyalty', v_claim.created_at
    );
  end if;

  return jsonb_build_object(
    'claim_id', v_claim.id,
    'reward_key', v_reward.reward_key,
    'reward_label', v_reward.label,
    'is_winning', v_reward.is_winning,
    'status', v_claim.status,
    'expires_at', v_claim.expires_at
  );
end;
$$;

revoke all on table public.arroko_reward_definitions, public.arroko_reward_claims from anon;
grant select on public.arroko_reward_definitions, public.arroko_reward_claims to authenticated;
grant update on public.arroko_reward_claims to authenticated;
grant all on public.arroko_reward_definitions, public.arroko_reward_claims to service_role;
revoke all on function public.arroko_public_reward_claim(text,text,text,jsonb) from public;
grant execute on function public.arroko_public_reward_claim(text,text,text,jsonb) to service_role;

commit;


-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20260914140000_arroko_contact_vault.sql
-- ------------------------------------------------------------------------------
-- Recoverable customer contact data for authorized CRM workflows.
-- Ciphertext is produced by Edge Functions; browser roles never receive table access.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.arroko_contact_vault (
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  phone_ref text not null check (char_length(phone_ref) = 64),
  phone_ciphertext text not null check (phone_ciphertext ~ '^v1[.]'),
  instagram_ref text check (instagram_ref is null or char_length(instagram_ref) = 64),
  instagram_ciphertext text check (instagram_ciphertext is null or instagram_ciphertext ~ '^v1[.]'),
  birth_date_ciphertext text check (birth_date_ciphertext is null or birth_date_ciphertext ~ '^v1[.]'),
  birth_month_day text check (birth_month_day is null or birth_month_day ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  key_version smallint not null default 1 check (key_version > 0),
  source text not null default 'checkin' check (source in ('checkin','staff','import','customer_update')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, client_id),
  unique (org_id, phone_ref),
  foreign key (org_id, client_id)
    references public.arroko_clients(org_id, id) on delete cascade
);

comment on table public.arroko_contact_vault is
  'Encrypted adult contact channels. No anon/authenticated table access; use audited server functions.';

create table public.arroko_pii_access_audit (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  actor_user_id uuid not null,
  action text not null check (action in ('view_customer_contact','campaign_dispatch','contact_update')),
  purpose text not null check (char_length(btrim(purpose)) between 3 and 120),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (org_id, client_id)
    references public.arroko_clients(org_id, id) on delete cascade
);

create index arroko_contact_vault_birthdays_idx
  on public.arroko_contact_vault (org_id, birth_month_day)
  where birth_month_day is not null;
create index arroko_pii_access_audit_timeline_idx
  on public.arroko_pii_access_audit (org_id, created_at desc, id desc);

create trigger arroko_contact_vault_updated_at
before update on public.arroko_contact_vault
for each row execute function public.arroko_set_updated_at();

alter table public.arroko_contact_vault enable row level security;
alter table public.arroko_pii_access_audit enable row level security;

revoke all on public.arroko_contact_vault from public, anon, authenticated;
revoke all on public.arroko_pii_access_audit from public, anon, authenticated;
grant all on public.arroko_contact_vault to service_role;
grant all on public.arroko_pii_access_audit to service_role;

create or replace function public.arroko_public_checkin_with_vault(
  p_checkin_slug text,
  p_contact_ref text,
  p_phone_last4 text,
  p_display_name text,
  p_access_token_hash text,
  p_marketing_consent boolean,
  p_child_participation_consent boolean,
  p_policy_version text,
  p_party_size integer,
  p_metadata jsonb,
  p_phone_ciphertext text,
  p_instagram_ref text,
  p_instagram_ciphertext text,
  p_birth_date_ciphertext text,
  p_birth_month_day text,
  p_key_version smallint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_client_id uuid;
  v_org_id uuid;
begin
  if p_phone_ciphertext is null or p_phone_ciphertext !~ '^v1[.]' then
    raise exception 'invalid_contact_ciphertext';
  end if;

  v_result := public.arroko_public_checkin(
    p_checkin_slug,
    p_contact_ref,
    p_phone_last4,
    p_display_name,
    p_access_token_hash,
    p_marketing_consent,
    p_child_participation_consent,
    p_policy_version,
    p_party_size,
    p_metadata
  );

  v_client_id := (v_result ->> 'client_id')::uuid;
  select org_id into strict v_org_id
  from public.arroko_clients
  where id = v_client_id;

  insert into public.arroko_contact_vault (
    org_id, client_id, phone_ref, phone_ciphertext,
    instagram_ref, instagram_ciphertext, birth_date_ciphertext,
    birth_month_day, key_version, source
  ) values (
    v_org_id, v_client_id, p_contact_ref, p_phone_ciphertext,
    p_instagram_ref, p_instagram_ciphertext, p_birth_date_ciphertext,
    p_birth_month_day, p_key_version, 'checkin'
  )
  on conflict (org_id, client_id) do update set
    phone_ref = excluded.phone_ref,
    phone_ciphertext = excluded.phone_ciphertext,
    instagram_ref = coalesce(excluded.instagram_ref, public.arroko_contact_vault.instagram_ref),
    instagram_ciphertext = coalesce(excluded.instagram_ciphertext, public.arroko_contact_vault.instagram_ciphertext),
    birth_date_ciphertext = coalesce(excluded.birth_date_ciphertext, public.arroko_contact_vault.birth_date_ciphertext),
    birth_month_day = coalesce(excluded.birth_month_day, public.arroko_contact_vault.birth_month_day),
    key_version = excluded.key_version,
    source = 'checkin';

  return v_result;
end;
$$;

revoke all on function public.arroko_public_checkin_with_vault(
  text,text,text,text,text,boolean,boolean,text,integer,jsonb,text,text,text,text,text,smallint
) from public, anon, authenticated;
grant execute on function public.arroko_public_checkin_with_vault(
  text,text,text,text,text,boolean,boolean,text,integer,jsonb,text,text,text,text,text,smallint
) to service_role;

commit;

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20260917090000_arroko_reward_redeem.sql
-- ------------------------------------------------------------------------------
-- Atomic, server-side redemption for arroko_reward_claims.
-- Fixes a client-side check-then-update race in RedeemPage/handleRedeem
-- that allowed the same claim to be redeemed twice (PRODUCTION-GATES.md #1).
-- Same-day restriction preserved: a reward can only be redeemed on a later visit.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.arroko_public_reward_redeem(
  p_claim_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.arroko_reward_claims%rowtype;
  v_reward public.arroko_reward_definitions%rowtype;
begin
  update public.arroko_reward_claims
  set status = 'redeemed', redeemed_at = now()
  where id = p_claim_id
    and status = 'claimed'
    and expires_at > now()
    and created_at::date < current_date
  returning * into v_claim;

  if found then
    select * into v_reward from public.arroko_reward_definitions where id = v_claim.reward_definition_id;
    return jsonb_build_object(
      'claim_id', v_claim.id,
      'reward_key', v_reward.reward_key,
      'reward_label', v_reward.label,
      'status', v_claim.status,
      'redeemed_at', v_claim.redeemed_at
    );
  end if;

  select * into v_claim from public.arroko_reward_claims where id = p_claim_id;
  if not found then raise exception 'claim_not_found'; end if;
  if v_claim.status = 'redeemed' then raise exception 'claim_already_redeemed'; end if;
  if v_claim.status <> 'claimed' then raise exception 'claim_not_redeemable'; end if;
  if v_claim.expires_at <= now() then raise exception 'claim_expired'; end if;
  if v_claim.created_at::date = current_date then raise exception 'claim_same_day'; end if;
  raise exception 'claim_not_redeemable';
end;
$$;

revoke all on function public.arroko_public_reward_redeem(uuid) from public;
grant execute on function public.arroko_public_reward_redeem(uuid) to service_role;

commit;

-- ------------------------------------------------------------------------------
-- ARCHIVO ORIGINAL: 20260917091000_arroko_menu_and_admin_rls_fixes.sql
-- ------------------------------------------------------------------------------
-- Corrective migration, safe to run on any environment regardless of current state.
--
-- 1) menu_items ended up seeded with legacy "IKU" placeholder data: the
--    TRUNCATE in 20251118200000_populate_real_menu.sql wiped the table and
--    inserted items still branded "IKU" (Rollo IKU Especial, Ceviche IKU,
--    Taco IKU), which PRODUCT.md explicitly forbids. The intended follow-up
--    (20251118210100_populate_corrected_menu.sql) only inserts when the table
--    is empty, so it silently became a no-op after the truncate+insert ran.
--    This migration replaces whatever is currently in menu_items with the
--    corrected, non-"IKU" menu unconditionally.
--
-- 2) The "Los administradores pueden gestionar la tabla de administradores"
--    policy added in 20251119224439_parches_de_seguridad_rls_criticos.sql
--    queries admin_users from within a policy defined ON admin_users, which
--    Postgres rejects with "infinite recursion detected in policy for
--    relation admin_users". This is the likely root cause of the login
--    incidents documented in supabase/DIAGNOSTICO_COMPLETO.sql and fixed
--    ad-hoc in supabase/FIX_ADMIN_RLS_POLICY.sql. Replaced with the existing
--    is_admin() SECURITY DEFINER helper, which bypasses RLS internally and
--    avoids the recursion (the same pattern already used for every other
--    admin-gated table in this schema).

begin;

delete from public.menu_items;

insert into public.menu_items (name, category, price, description, pairing_notes, is_available) values
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
    ('Togushi Roll', 'postre', 235.0, 'Roll de caramelo limón y nuez garapiñada', 'Sake dulce o té verde', true);

drop policy if exists "Los administradores pueden gestionar la tabla de administradores" on public.admin_users;
create policy "Los administradores pueden gestionar la tabla de administradores"
on public.admin_users
for all
using (is_admin())
with check (is_admin());

commit;
