import {
  formatTimeRemaining,
  geminiPairingRateLimiter,
  geminiTextRateLimiter,
  getRateLimitKey,
} from './rateLimit';

type ChatTurn = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

async function callServerAi(payload: Record<string, unknown>): Promise<string> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`AI endpoint returned ${response.status}`);
  }

  const body = await response.json() as { text?: string };
  if (!body.text) throw new Error('AI endpoint returned an empty response');
  return body.text;
}

/**
 * Kept as a compatibility hook for the knowledge router. Menu truth now lives on
 * the server so it cannot be replaced by text supplied from the browser.
 */
export async function getMenuContext(_force = false): Promise<string> {
  return '';
}

export async function askGemini(
  history: ChatTurn[],
  newMessage: string,
  participantId?: string | null,
): Promise<string> {
  const message = newMessage.trim().slice(0, 1_200);
  if (!message) return 'Cuéntame qué se te antoja y te ayudo a elegir.';

  const rateLimitKey = getRateLimitKey(participantId);
  const rateLimit = geminiTextRateLimiter.checkLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    return `⏱️ Dame ${formatTimeRemaining(rateLimit.resetIn)} y seguimos armando tu recomendación.`;
  }

  const isPairing = /\b(maridaje|maridar|vino|cerveza|sake|bebida|mocktail|drink|pairing)\b/i.test(message);
  if (isPairing) {
    const pairingLimit = geminiPairingRateLimiter.checkLimit(rateLimitKey);
    if (!pairingLimit.allowed) {
      return `⏱️ Dame ${formatTimeRemaining(pairingLimit.resetIn)} antes del siguiente maridaje.`;
    }
  }

  try {
    return await callServerAi({
      mode: 'sommelier',
      history: history.slice(-8),
      message,
    });
  } catch {
    return 'Roko está afinando la recomendación. Mientras tanto, dime si buscas algo fresco, cremoso, crujiente o picante; también puedes confirmar directo con Arrokó al 667 318 6010.';
  }
}

export async function getPrizePairing(
  prizeName: string,
  participantId?: string | null,
): Promise<string> {
  if (/sigue participando/i.test(prizeName)) {
    return 'Esta vez no cayó premio, pero Roko todavía puede ayudarte a encontrar un platillo y su maridaje.';
  }

  const rateLimitKey = getRateLimitKey(participantId);
  const rateLimit = geminiPairingRateLimiter.checkLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    return `⏱️ Dame ${formatTimeRemaining(rateLimit.resetIn)} antes de preparar otro maridaje.`;
  }

  try {
    return await callServerAi({ mode: 'pairing', prizeName: prizeName.slice(0, 160) });
  } catch {
    return 'Tu premio queda registrado. Pide a Roko una recomendación según si prefieres algo fresco, crujiente o picante.';
  }
}
