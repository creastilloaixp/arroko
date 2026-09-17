import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import arroko from '../data/arroko-config-preview.json';

type ApiRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type ChatTurn = { role: 'user' | 'model'; parts: { text: string }[] };
type RequestBody = {
  mode?: 'sommelier' | 'pairing' | 'reservation' | 'analytics';
  message?: string;
  prizeName?: string;
  history?: ChatTurn[];
  conversation?: string[];
  analytics?: unknown;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const requests = new Map<string, { count: number; resetAt: number }>();

function allowed(key: string): boolean {
  const now = Date.now();
  const bucket = requests.get(key);
  if (!bucket || bucket.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= MAX_REQUESTS;
}

function bearer(req: ApiRequest): string | null {
  const value = req.headers.authorization;
  const header = Array.isArray(value) ? value[0] : value;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

async function isAdmin(token: string | null): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon || !token) return false;
  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) return false;
  const { data, error } = await client.rpc('is_admin');
  return !error && data === true;
}

function cleanHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-8).flatMap((turn) => {
    if (!turn || (turn.role !== 'user' && turn.role !== 'model') || !Array.isArray(turn.parts)) return [];
    const text = String(turn.parts[0]?.text || '').slice(0, 1_200);
    return text ? [{ role: turn.role, parts: [{ text }] }] : [];
  });
}

const catalog = arroko.catalog.map(({ id, name, price, cat, desc, pitch, sensory, marida_con, proposal }) => ({
  id, name, price, cat, desc, pitch, sensory, marida_con, proposal,
}));

const SOMMELIER_SYSTEM = `${arroko.persona}

CATÁLOGO AUTORIZADO (fuente de verdad):
${JSON.stringify(catalog)}

No inventes productos, disponibilidad, precios, promociones ni ingredientes. Los conceptos de mocktail se presentan siempre como propuesta pendiente de validación. Si faltan datos, dilo y ofrece confirmar por WhatsApp.`;

const ANALYTICS_SYSTEM = `Eres analista de datos de Arrokó. Trabaja sólo con el JSON suministrado. Distingue hechos, cálculos e hipótesis. No inventes porcentajes ni causalidad. Responde en español con: resumen ejecutivo, 3 hallazgos, 2 acciones y la métrica que validará cada acción. No expongas datos personales.`;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ipHeader = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(ipHeader) ? ipHeader[0] : ipHeader)?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (!allowed(ip)) return res.status(429).json({ error: 'Too many requests' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI is not configured' });
  const body = (req.body || {}) as RequestBody;
  const ai = new GoogleGenAI({ apiKey });

  try {
    if (body.mode === 'sommelier') {
      const message = String(body.message || '').trim().slice(0, 1_200);
      if (!message) return res.status(400).json({ error: 'Message is required' });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [...cleanHistory(body.history), { role: 'user', parts: [{ text: message }] }],
        config: { systemInstruction: SOMMELIER_SYSTEM, temperature: 0.35 },
      });
      return res.status(200).json({ text: response.text });
    }

    if (body.mode === 'pairing') {
      const prizeName = String(body.prizeName || '').slice(0, 160);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: `El premio o platillo es: "${prizeName}". Recomienda exactamente un maridaje válido del catálogo en una frase.` }] }],
        config: { systemInstruction: SOMMELIER_SYSTEM, temperature: 0.2 },
      });
      return res.status(200).json({ text: response.text });
    }

    if (body.mode === 'reservation') {
      const conversation = Array.isArray(body.conversation)
        ? body.conversation.slice(-12).map((line) => String(line).slice(0, 1_200)).join('\n')
        : '';
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: `Extrae sólo datos explícitos de esta conversación:\n${conversation}` }] }],
        config: {
          systemInstruction: `Devuelve JSON con hasReservationIntent, customerName, reservationTime, numberOfGuests, phoneNumber y specialRequests. Usa null cuando falte un dato. Zona horaria America/Mazatlan y fecha actual ${new Date().toISOString()}.`,
          responseMimeType: 'application/json',
          temperature: 0,
        },
      });
      const parsed = JSON.parse(String(response.text || '{}').replace(/```json|```/g, ''));
      return res.status(200).json({ reservation: parsed });
    }

    if (body.mode === 'analytics') {
      if (!(await isAdmin(bearer(req)))) return res.status(403).json({ error: 'Forbidden' });
      const message = String(body.message || '').slice(0, 1_200);
      const snapshot = JSON.stringify(body.analytics || {}).slice(0, 24_000);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [...cleanHistory(body.history), { role: 'user', parts: [{ text: `Datos: ${snapshot}\nPregunta: ${message}` }] }],
        config: { systemInstruction: ANALYTICS_SYSTEM, temperature: 0.25 },
      });
      return res.status(200).json({ text: response.text });
    }

    return res.status(400).json({ error: 'Unsupported mode' });
  } catch {
    return res.status(502).json({ error: 'AI provider error' });
  }
}
