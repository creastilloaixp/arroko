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