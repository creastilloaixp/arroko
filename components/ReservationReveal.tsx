import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarCheck, ChevronRight } from 'lucide-react';

interface ReservationRevealProps {
  customerName: string;
  date: string;
  guests: number;
  confirmationId: string;
}

export const ReservationReveal: React.FC<ReservationRevealProps> = ({ customerName, date, guests, confirmationId }) => {
  const [revealed, setRevealed] = useState(false);
  const reduceMotion = useReducedMotion();

  if (!revealed) {
    return (
      <button type="button" onClick={() => setRevealed(true)} className="mt-3 flex w-full items-center gap-3 rounded-xl bg-[#0B4F56] p-4 text-left text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F15B43]/40">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/12"><CalendarCheck className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><strong className="block font-display text-lg">Solicitud recibida</strong><span className="text-xs text-white/70">Ver detalles pendientes de confirmación</span></span>
        <ChevronRight className="h-5 w-5" />
      </button>
    );
  }

  return (
    <motion.section initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl bg-[#DCE8E5] p-4 text-left text-[#173B3D]">
      <p className="font-display text-lg font-extrabold text-[#0B4F56]">Reservación solicitada</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
        <dt className="font-bold">Nombre</dt><dd>{customerName}</dd>
        <dt className="font-bold">Fecha</dt><dd>{new Date(date).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</dd>
        <dt className="font-bold">Personas</dt><dd>{guests}</dd>
        <dt className="font-bold">Folio</dt><dd className="break-all font-mono">{confirmationId.slice(0, 8).toUpperCase()}</dd>
      </dl>
      <p className="mt-3 text-xs leading-5 text-[#587776]">Arrokó debe confirmar disponibilidad antes de considerar reservada la mesa.</p>
    </motion.section>
  );
};
