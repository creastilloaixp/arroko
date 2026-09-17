import { supabase } from '../supabase';
import { formatTimeRemaining, geminiTextRateLimiter, getRateLimitKey } from './rateLimit';

export interface AnalyticsContext {
  totalParticipants: number;
  totalSpins: number;
  totalRedemptions: number;
  conversionRate: number;
  recentParticipants?: unknown[];
  topPrizes?: unknown[];
  timeSeriesData?: unknown[];
  conversionFunnel?: unknown[];
}

type ChatTurn = { role: 'user' | 'model'; parts: { text: string }[] };

export async function askAnalyticsGemini(
  history: ChatTurn[],
  newMessage: string,
  analyticsContext: AnalyticsContext,
  adminId?: string | null,
): Promise<string> {
  const rateLimit = geminiTextRateLimiter.checkLimit(getRateLimitKey(adminId));
  if (!rateLimit.allowed) {
    return `⏱️ Has alcanzado el límite de consultas. Intenta de nuevo en ${formatTimeRemaining(rateLimit.resetIn)}.`;
  }

  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  if (!session?.access_token) {
    return 'Inicia sesión como administrador para consultar el análisis asistido.';
  }

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        mode: 'analytics',
        history: history.slice(-6),
        message: newMessage.trim().slice(0, 1_200),
        analytics: analyticsContext,
      }),
    });
    if (!response.ok) throw new Error(`Analytics endpoint returned ${response.status}`);
    const body = await response.json() as { text?: string };
    return body.text || 'No fue posible generar el análisis en este momento.';
  } catch {
    return 'No fue posible procesar la consulta analítica. Las métricas del tablero siguen disponibles.';
  }
}

export async function getAutomatedInsights(context: AnalyticsContext): Promise<string[]> {
  const insights: string[] = [];
  const participationRate = context.totalParticipants > 0 ? context.totalSpins / context.totalParticipants : 0;
  const redemptionRate = context.totalSpins > 0 ? context.totalRedemptions / context.totalSpins : 0;

  if (context.conversionRate < 30) insights.push(`⚠️ Conversión baja (${context.conversionRate.toFixed(1)}%). Revisa la fricción entre premio y canje.`);
  if (context.conversionRate > 70) insights.push(`✅ Conversión saludable (${context.conversionRate.toFixed(1)}%). Conviene medir recurrencia por campaña.`);
  if (participationRate < 0.8) insights.push(`📊 ${(participationRate * 100).toFixed(1)}% de registrados completa la dinámica. Simplifica el salto a la ruleta.`);
  if (redemptionRate < 0.5) insights.push(`🎯 ${(redemptionRate * 100).toFixed(1)}% de premios se canjea. Evalúa vigencia, claridad y valor percibido.`);
  if (context.totalParticipants < 10) insights.push('📈 La muestra aún es pequeña; evita tomar decisiones de pauta hasta acumular más sesiones comparables.');
  return insights;
}

export function generateExecutiveSummary(context: AnalyticsContext): string {
  const participationRate = context.totalParticipants > 0 ? context.totalSpins / context.totalParticipants * 100 : 0;
  const redemptionRate = context.totalSpins > 0 ? context.totalRedemptions / context.totalSpins * 100 : 0;
  return `
📊 **Resumen ejecutivo · Arrokó**

**Estado:** ${context.totalParticipants} participantes y ${context.totalSpins} participaciones.

**Rendimiento:**
- ${participationRate.toFixed(1)}% completa la dinámica
- ${redemptionRate.toFixed(1)}% canjea su premio
- ${context.conversionRate.toFixed(1)}% de conversión integral

**Siguiente acción:** ${context.totalParticipants < 50 ? 'reunir una muestra suficiente por campaña' : 'comparar adquisición, canje y recurrencia por campaña'}.
`;
}
