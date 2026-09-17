export interface ReservationData {
  customerName: string | null;
  reservationTime: string | null;
  numberOfGuests: number | null;
  specialRequests: string | null;
  phoneNumber: string | null;
  hasReservationIntent: boolean;
}

const EMPTY_RESERVATION: ReservationData = {
  hasReservationIntent: false,
  customerName: null,
  reservationTime: null,
  numberOfGuests: null,
  specialRequests: null,
  phoneNumber: null,
};

export async function extractReservationData(
  conversationHistory: string[],
): Promise<ReservationData> {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'reservation',
        conversation: conversationHistory.slice(-12).map((line) => line.slice(0, 1_200)),
      }),
    });

    if (!response.ok) return EMPTY_RESERVATION;
    const body = await response.json() as { reservation?: Partial<ReservationData> };
    const value = body.reservation;
    if (!value || typeof value.hasReservationIntent !== 'boolean') return EMPTY_RESERVATION;

    return {
      hasReservationIntent: value.hasReservationIntent,
      customerName: typeof value.customerName === 'string' ? value.customerName : null,
      reservationTime: typeof value.reservationTime === 'string' ? value.reservationTime : null,
      numberOfGuests: typeof value.numberOfGuests === 'number' ? value.numberOfGuests : null,
      phoneNumber: typeof value.phoneNumber === 'string' ? value.phoneNumber : null,
      specialRequests: typeof value.specialRequests === 'string' ? value.specialRequests : null,
    };
  } catch {
    return EMPTY_RESERVATION;
  }
}
