import { beforeAll, describe, expect, it } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Test suite for WhatsApp Customer Memory RPC Functions
describe("WhatsApp Customer Memory Functions", () => {
    let supabase: any;
    let testCustomerId: string;
    const testPhone = "+1234567890_test_" + Date.now();

    beforeAll(() => {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";

        if (!supabaseUrl || !supabaseKey) {
            throw new Error(
                "Supabase credentials not found in environment variables",
            );
        }

        supabase = createClient(supabaseUrl, supabaseKey);
    });

    it("should create a new customer", async () => {
        const { data, error } = await supabase.rpc("get_or_create_customer", {
            p_phone_number: testPhone,
        });

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data.length).toBe(1);
        expect(data[0].customer_id).toBeDefined();
        expect(data[0].is_new_customer).toBe(true);
        expect(data[0].total_messages).toBe(0);

        testCustomerId = data[0].customer_id;
        console.log("✅ Created customer:", testCustomerId);
    });

    it("should retrieve existing customer", async () => {
        const { data, error } = await supabase.rpc("get_or_create_customer", {
            p_phone_number: testPhone,
        });

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data[0].customer_id).toBe(testCustomerId);
        expect(data[0].is_new_customer).toBe(false);

        console.log("✅ Retrieved existing customer");
    });

    it("should save user message to history", async () => {
        const { data, error } = await supabase.rpc("save_customer_message", {
            p_customer_id: testCustomerId,
            p_role: "user",
            p_content: "Hola, quiero hacer una reserva",
            p_message_id: "test_msg_1",
        });

        expect(error).toBeNull();
        expect(data).toBeDefined();

        console.log("✅ Saved user message");
    });

    it("should save assistant message to history", async () => {
        const { data, error } = await supabase.rpc("save_customer_message", {
            p_customer_id: testCustomerId,
            p_role: "assistant",
            p_content: "¡Claro! Estaré encantado de ayudarte con tu reserva.",
            p_message_id: "test_msg_2",
        });

        expect(error).toBeNull();
        expect(data).toBeDefined();

        console.log("✅ Saved assistant message");
    });

    it("should retrieve customer history", async () => {
        const { data, error } = await supabase.rpc("get_customer_history", {
            p_customer_id: testCustomerId,
            p_limit: 10,
        });

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data.length).toBe(2);

        // History should be in reverse chronological order
        expect(data[0].role).toBe("assistant");
        expect(data[1].role).toBe("user");

        console.log(
            "✅ Retrieved conversation history:",
            data.length,
            "messages",
        );
    });

    it("should update customer message count", async () => {
        const { data, error } = await supabase.rpc("get_or_create_customer", {
            p_phone_number: testPhone,
        });

        expect(error).toBeNull();
        expect(data[0].total_messages).toBe(2);

        console.log("✅ Message count updated correctly");
    });

    it("should update customer context", async () => {
        const { error } = await supabase.rpc("update_customer_context", {
            p_customer_id: testCustomerId,
            p_current_intent: "reservation",
            p_conversation_summary: "Cliente quiere hacer una reserva",
            p_last_topic: "reservaciones",
        });

        expect(error).toBeNull();

        console.log("✅ Updated customer context");
    });

    it("should retrieve customer context", async () => {
        const { data, error } = await supabase.rpc("get_customer_context", {
            p_customer_id: testCustomerId,
        });

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data.length).toBe(1);
        expect(data[0].current_intent).toBe("reservation");
        expect(data[0].last_topic).toBe("reservaciones");

        console.log("✅ Retrieved customer context");
    });

    it("should update customer name", async () => {
        const { error } = await supabase.rpc("update_customer_name", {
            p_customer_id: testCustomerId,
            p_name: "Carlos Test",
        });

        expect(error).toBeNull();

        // Verify name was updated
        const { data } = await supabase.rpc("get_or_create_customer", {
            p_phone_number: testPhone,
        });

        expect(data[0].customer_name).toBe("Carlos Test");

        console.log("✅ Updated customer name");
    });

    it("should handle multiple messages correctly", async () => {
        // Add more messages
        for (let i = 0; i < 5; i++) {
            await supabase.rpc("save_customer_message", {
                p_customer_id: testCustomerId,
                p_role: i % 2 === 0 ? "user" : "assistant",
                p_content: `Test message ${i + 3}`,
                p_message_id: `test_msg_${i + 3}`,
            });
        }

        // Get history with limit
        const { data, error } = await supabase.rpc("get_customer_history", {
            p_customer_id: testCustomerId,
            p_limit: 5,
        });

        expect(error).toBeNull();
        expect(data.length).toBe(5);

        console.log("✅ Handled multiple messages correctly");
    });

    it("should validate role parameter", async () => {
        const { error } = await supabase.rpc("save_customer_message", {
            p_customer_id: testCustomerId,
            p_role: "invalid_role",
            p_content: "This should fail",
        });

        expect(error).toBeDefined();
        expect(error.message).toContain("Invalid role");

        console.log("✅ Role validation working");
    });

    // Cleanup test data
    it("should cleanup test data", async () => {
        // Delete customer (cascade will delete history and context)
        const { error } = await supabase
            .from("whatsapp_customers")
            .delete()
            .eq("id", testCustomerId);

        expect(error).toBeNull();

        console.log("✅ Cleaned up test data");
    });
});
