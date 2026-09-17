import { trackInteraction } from './tracking';

export async function apiCall<T>(name: string, fn: () => PromiseLike<T>, metadata?: Record<string, any>): Promise<T> {
  const start = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  try {
    const result = await Promise.resolve(fn());
    const end = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const duration = Math.round(end - start);
    trackInteraction('api_call', null, { name, duration_ms: duration, success: true, ...(metadata || {}) });
    return result;
  } catch (error: any) {
    const end = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const duration = Math.round(end - start);
    trackInteraction('api_call', null, { name, duration_ms: duration, success: false, error: String(error?.message || error), ...(metadata || {}) });
    throw error;
  }
}
