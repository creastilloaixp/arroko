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
