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