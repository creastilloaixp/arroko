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