import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI, FunctionDeclaration, Type } from 'https://esm.sh/@google/genai';

// FIX: Add type declaration for Deno to resolve TypeScript errors in environments that lack Deno types.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// --- Types ---
interface Database {
  // Add your full DB schema here for type safety
  // This is a minimal version for the function
  public: {
    Tables: {
      whatsapp_messages: { Insert: any; };
      restaurant_settings: { Row: any; };
      reservations: { Insert: any; Update: any; Row: any; };
    };
  };
}

// --- CORS Handler ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Webhook Authentication ---
// Evolution API is configured to send this shared secret back on every webhook
// call (see EVOLUTION_WEBHOOK_SECRET in .env.example). Without this check, anyone
// who discovers the function URL could inject fake messages, create reservations,
// and use this endpoint as an open relay to send WhatsApp messages to any number
// using the restaurant's Evolution API credentials.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function isAuthorizedWebhookRequest(req: Request): boolean {
  const expectedSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') || '';
  if (!expectedSecret) return false;
  const suppliedSecret = req.headers.get('x-webhook-secret') || '';
  if (!suppliedSecret) return false;
  return timingSafeEqual(expectedSecret, suppliedSecret);
}

// --- Function Declarations for Gemini ---
const createReservationDeclaration: FunctionDeclaration = {
    name: 'createReservation',
    description: 'Creates a new restaurant reservation in the system.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            customer_name: { type: Type.STRING, description: 'The full name of the person making the reservation.' },
            reservation_time: { type: Type.STRING, description: 'The date and time of the reservation in ISO 8601 format (e.g., 2024-08-15T20:00:00).' },
            number_of_guests: { type: Type.INTEGER, description: 'The number of people for the reservation.' },
            notes: { type: Type.STRING, description: 'Optional. Any special requests or notes for the reservation.' }
        },
        required: ['customer_name', 'reservation_time', 'number_of_guests'],
    },
};

const checkReservationDeclaration: FunctionDeclaration = {
    name: 'checkReservation',
    description: 'Checks the status and details of an existing reservation for a customer.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            customer_name: { type: Type.STRING, description: 'The full name of the person who made the reservation.' },
        },
        required: ['customer_name'],
    },
};

// --- Main Handler ---
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!isAuthorizedWebhookRequest(req)) {
    console.warn('Rejected webhook call with missing or invalid x-webhook-secret header.');
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  try {
    const body = await req.json();
    console.log("Received webhook payload:", JSON.stringify(body, null, 2));

    // --- Parse Evolution API Payload ---
    if (body.event !== 'messages.upsert' || !body.data.message?.extendedTextMessage?.text) {
        if(body.data?.key?.fromMe) {
            console.log("Ignoring message from self.");
            return new Response('ok', { headers: corsHeaders });
        }
        console.log("Ignoring non-text or non-upsert event.");
        return new Response('ok', { headers: corsHeaders });
    }

    const messageData = body.data;
    const userMessage = messageData.message.extendedTextMessage.text;
    const phoneNumber = messageData.key.remoteJid.split('@')[0];
    const senderName = messageData.pushName;
    const instanceName = body.instance;

    // --- Initialize Clients ---
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}` } } }
    );
    const geminiApiKey = Deno.env.get('API_KEY');
    if (!geminiApiKey) throw new Error("API_KEY environment variable not set!");
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    // --- Save User Message ---
    await supabaseClient.from('whatsapp_messages').insert({
      phone_number: phoneNumber,
      sender: 'user',
      message_content: userMessage,
      sender_name: senderName
    });

    // --- Get Context for AI ---
    const { data: settings, error: settingsError } = await supabaseClient.from('restaurant_settings').select('*').limit(1).single();
    if (settingsError || !settings) {
        throw new Error(`Could not fetch restaurant settings: ${settingsError?.message}`);
    }
    
    if (!settings.evolution_api_url || !settings.evolution_api_key) {
        throw new Error("Evolution API URL or Key is not configured in restaurant_settings.");
    }

    const { data: historyData } = await supabaseClient
        .from('whatsapp_messages')
        .select('sender, message_content')
        .eq('phone_number', phoneNumber)
        .order('created_at', { ascending: true })
        .limit(20);

    const conversationHistory = (historyData || []).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.message_content }]
    }));

    const systemInstruction = `Eres "Kenji", el asistente de IA para reservaciones en ${settings.restaurant_name}.
Tu tono es moderno, amigable y muy eficiente.
Tu propósito principal es gestionar reservaciones para los clientes utilizando las herramientas que tienes a tu disposición.
- Utiliza la herramienta \`createReservation\` para agendar nuevas reservaciones. Asegúrate de tener toda la información necesaria (nombre, fecha, hora, número de personas) antes de llamar a la función. Confirma los detalles con el usuario antes de finalizar.
- Utiliza la herramienta \`checkReservation\` para verificar los detalles de una reservación existente.
- Responde a preguntas sobre el restaurante usando esta información:
  - Dirección: ${settings.restaurant_address}
  - Horarios: ${settings.opening_hours}
  - Especialidades: ${(settings.menu_highlights || []).join(', ')}
- Siempre interactúa en español.
- Si un usuario pregunta por su reservación, usa su nombre (\`${senderName}\`) para buscarla si no te da otro nombre.`;

    const tools = [{ functionDeclarations: [createReservationDeclaration, checkReservationDeclaration] }];
    const modelRequestContents = [...conversationHistory, { role: 'user', parts: [{ text: userMessage }] }];
    
    // --- Generate AI Response (with potential function calling) ---
    const initialResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: modelRequestContents,
        config: { systemInstruction },
        tools: tools,
    });

    const functionCalls = initialResponse.functionCalls;
    let aiResponseText: string;

    if (functionCalls && functionCalls.length > 0) {
        console.log("Function call detected:", functionCalls);

        const functionResponses = await Promise.all(
            functionCalls.map(async (call) => {
                let result: any;
                if (call.name === 'createReservation') {
                    const args = call.args;
                    const { data, error } = await supabaseClient.from('reservations').insert({
                        phone_number: phoneNumber,
                        customer_name: args.customer_name,
                        reservation_time: args.reservation_time,
                        number_of_guests: args.number_of_guests,
                        notes: args.notes,
                        status: 'confirmed',
                        source: 'whatsapp'
                    }).select().single();

                    if(error) result = { success: false, error: error.message };
                    else result = { success: true, reservationId: data.id };
                } else if (call.name === 'checkReservation') {
                     const args = call.args;
                     // Use .ilike() instead of interpolating into .or() — the latter
                     // parses its argument as a raw PostgREST filter expression, so an
                     // attacker-controlled name containing "," or ")" could inject
                     // additional filter clauses.
                     const { data, error } = await supabaseClient.from('reservations')
                        .select('*')
                        .eq('phone_number', phoneNumber)
                        .ilike('customer_name', `%${String(args.customer_name || '').slice(0, 120)}%`)
                        .order('created_at', { ascending: false });

                     if(error) result = { found: false, error: error.message };
                     else if (data && data.length > 0) result = { found: true, reservations: data };
                     else result = { found: false, message: `No se encontraron reservaciones para ${args.customer_name}.`};
                }
                
                return {
                    functionResponse: {
                        name: call.name,
                        id: call.id,
                        response: { result },
                    },
                };
            })
        );
        
        // Send the responses back to the model to get a natural language response
        const secondResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                ...modelRequestContents,
                { role: 'model', parts: functionCalls.map(fc => ({ functionCall: fc })) },
                { role: 'tool', parts: functionResponses },
            ],
            config: { systemInstruction },
            tools: tools,
        });
        aiResponseText = secondResponse.text;

    } else {
        aiResponseText = initialResponse.text;
    }

    // --- Save AI Response ---
    await supabaseClient.from('whatsapp_messages').insert({
        phone_number: phoneNumber,
        sender: 'agent',
        message_content: aiResponseText,
    });
    
    // --- Send Reply via Evolution API ---
    const evolutionUrl = `${settings.evolution_api_url}/message/sendText/${instanceName}`;
    const evolutionApiKey = settings.evolution_api_key;

    const sendResponse = await fetch(evolutionUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
        },
        body: JSON.stringify({
            number: phoneNumber,
            options: { delay: 1200, presence: "composing" },
            textMessage: { text: aiResponseText },
        }),
    });
    
    if(!sendResponse.ok) {
        console.error("Error sending message via Evolution API:", await sendResponse.text());
    } else {
        console.log("Successfully sent reply via Evolution API.");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Error in webhook:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});