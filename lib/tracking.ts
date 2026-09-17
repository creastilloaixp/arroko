import { supabase } from '../supabase';

const reportedFailures = new Set<string>();

export const trackInteraction = async (
  eventType: string,
  participantId: string | null,
  metadata?: Record<string, any>
) => {
  if (!supabase) return;

  const { error } = await supabase.from('user_interactions').insert({
    event_type: eventType,
    participant_id: participantId,
    metadata: metadata || undefined,
  });

  if (error) {
    // Analytics must never interrupt the dining flow. Report each event failure
    // at most once per page load so a blocked telemetry table does not create a
    // cascade of identical notifications.
    if (reportedFailures.has(eventType)) return;
    reportedFailures.add(eventType);
    // Dispatch a global event for the context to handle logging and UI.
    window.dispatchEvent(new CustomEvent('supabaseError', {
      detail: {
        table: 'user_interactions',
        operation: 'INSERT',
        error: error,
        source: `trackInteraction('${eventType}')` // Provide context for debugging
      }
    }));
  }
};
