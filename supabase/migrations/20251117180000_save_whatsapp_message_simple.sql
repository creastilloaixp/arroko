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