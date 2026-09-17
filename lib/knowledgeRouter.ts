import { askGemini } from './gemini';
import { supabase } from '../supabase';
import { extractReservationData } from './gemini-reservation-extractor';
import type { Participant } from '../types';

type ChatTurn = { role: 'user' | 'model'; parts: { text: string }[] };

export type KnowledgeResult = {
  route: 'internal';
  text: string;
  reservationCreated?: boolean;
  reservation?: unknown;
};

function conversationLines(history: ChatTurn[], query: string) {
  return [
    ...history.map((turn) => `${turn.role === 'user' ? 'Cliente' : 'Roko'}: ${turn.parts[0]?.text || ''}`),
    `Cliente: ${query}`,
  ];
}

async function maybeCreateReservation(
  history: ChatTurn[],
  query: string,
  participant?: Participant | null,
  source: 'text' | 'voice' | 'whatsapp' = 'text',
): Promise<{ reservation: unknown; text: string } | null> {
  if (!/\b(reserv|mesa|apart)/i.test(`${history.map((turn) => turn.parts[0]?.text).join(' ')} ${query}`)) return null;

  const extracted = await extractReservationData(conversationLines(history, query));
  const explicitlyConfirmed = /\b(confirmo|confirmar|sí|si,? correcto|adelante|de acuerdo)\b/i.test(query);
  const customerName = extracted.customerName || participant?.fullName || '';
  const phoneNumber = extracted.phoneNumber || participant?.phone || '';
  if (
    !extracted.hasReservationIntent ||
    !extracted.reservationTime ||
    !extracted.numberOfGuests ||
    !customerName ||
    !phoneNumber ||
    !explicitlyConfirmed
  ) return null;

  const record = {
    reservation_time: extracted.reservationTime,
    party_size: extracted.numberOfGuests || 2,
    phone_number: phoneNumber,
    customer_name: customerName,
    status: 'pending' as const,
    notes: extracted.specialRequests,
    source,
  };

  if (!supabase) return null;
  const { data, error } = await supabase.from('reservations').insert(record).select().single();
  if (error || !data) return null;

  return {
    reservation: data,
    text: `Recibí tu solicitud para ${new Date(record.reservation_time).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}. Está pendiente de confirmación por Arrokó.`,
  };
}

export async function routeKnowledgeQuery(
  history: ChatTurn[],
  query: string,
  participantId?: string | null,
  participant?: Participant | null,
  source: 'text' | 'voice' | 'whatsapp' = 'text',
): Promise<KnowledgeResult> {
  const reservation = await maybeCreateReservation(history, query, participant, source);
  if (reservation) return { route: 'internal', text: reservation.text, reservationCreated: true, reservation: reservation.reservation };

  // One server call owns both catalog truth and recommendation logic. This avoids
  // an extra browser-to-database round trip and prevents stale legacy menu rows
  // from leaking into Arrokó recommendations.
  const text = await askGemini(history, query, participantId);
  return { route: 'internal', text };
}
