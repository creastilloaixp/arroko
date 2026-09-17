import React, { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import type { SpinResult } from '../types';
import { useApp } from '../context/AppContext';
import { InstagramIcon, WhatsAppIcon } from './Icons';
import { trackInteraction } from '../lib/tracking';
import RegistrationForm from './RegistrationForm';

const Confetti = React.lazy(() => import('react-confetti'));

const WinnerPage: React.FC<{ result: SpinResult }> = ({ result }) => {
  const { participant } = useApp();
  const [showConfetti, setShowConfetti] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const { prize, id: spinId } = result;
  const isPrize = prize.id !== 'p1';
  const needsRegistration = !spinId;

  useEffect(() => {
    const resize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', resize);
    const timer = window.setTimeout(() => setShowConfetti(false), 5_500);
    return () => { window.removeEventListener('resize', resize); window.clearTimeout(timer); };
  }, []);

  if (needsRegistration) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-6 text-center">
        {showConfetti && isPrize && <React.Suspense fallback={null}><Confetti width={dimensions.width} height={dimensions.height} recycle={false} numberOfPieces={220} colors={['#F15B43', '#0B4F56', '#F4EBDD']} /></React.Suspense>}
        <section className="w-full rounded-3xl bg-[#0B4F56] p-7 text-white shadow-[0_18px_42px_rgba(7,56,61,.25)]">
          <p className="font-display text-sm font-extrabold uppercase tracking-[.2em] text-[#F7A08F]">{isPrize ? 'Roko eligió' : 'Estuviste cerca'}</p>
          <div className="my-4 text-7xl" aria-hidden="true">{prize.icon}</div>
          <h2 className="font-display text-4xl font-extrabold">{prize.name}</h2>
          <p className="mt-3 text-sm leading-6 text-white/75">Completa el registro para conservar el resultado y generar el QR.</p>
        </section>
        <RegistrationForm />
      </div>
    );
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  const redeemUrl = `${window.location.origin}/redeem?code=${encodeURIComponent(spinId)}`;
  const whatsappUrl = `https://wa.me/526673186010?text=${encodeURIComponent(`Hola Arrokó 👋 Quiero validar mi recompensa. Mi código es ${spinId}.`)}`;

  return (
    <div className="mx-auto max-w-md text-center">
      {showConfetti && isPrize && <React.Suspense fallback={null}><Confetti width={dimensions.width} height={dimensions.height} recycle={false} numberOfPieces={220} colors={['#F15B43', '#0B4F56', '#F4EBDD']} /></React.Suspense>}
      <section className="rounded-3xl bg-[#FFFDF8] p-7 text-[#173B3D] shadow-[0_18px_42px_rgba(7,56,61,.22)]">
        <p className="font-display text-sm font-extrabold uppercase tracking-[.2em] text-[#F15B43]">{isPrize ? 'Tu recompensa' : 'Tu resultado'}</p>
        <div className="my-4 text-7xl" aria-hidden="true">{prize.icon}</div>
        <h2 className="font-display text-4xl font-extrabold text-[#0B4F56]">{prize.name}</h2>
        {isPrize && <>
          <div className="mx-auto mt-6 grid h-56 w-56 place-items-center rounded-2xl border border-[#DCE8E5] bg-white p-3"><QRCodeCanvas value={redeemUrl} size={200} bgColor="#ffffff" fgColor="#0B4F56" level="M" /></div>
          <p className="mt-4 break-all font-mono text-xs text-[#587776]">{spinId}</p>
          <p className="mt-2 text-xs text-[#6E8C8B]">Vigencia estimada: {expires.toLocaleDateString('es-MX')}. Confirmar condiciones en sucursal.</p>
        </>}
      </section>

      <div className="mt-5 grid gap-3">
        {isPrize && <a href={whatsappUrl} onClick={() => void trackInteraction('winner_page_click', participant?.id ?? null, { link_type: 'whatsapp' })} target="_blank" rel="noopener noreferrer" className="min-h-12 rounded-xl bg-[#25D366] px-5 py-3 font-bold text-white"><WhatsAppIcon className="mr-2 inline h-5 w-5" />Confirmar con Arrokó</a>}
        <a href="https://www.instagram.com/arrokomx/" onClick={() => void trackInteraction('winner_page_click', participant?.id ?? null, { link_type: 'instagram' })} target="_blank" rel="noopener noreferrer" className="min-h-12 rounded-xl border border-[#0B4F56] px-5 py-3 font-bold text-[#0B4F56]"><InstagramIcon className="mr-2 inline h-5 w-5" />Seguir @arrokomx</a>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('openSamuraiKid'))} className="min-h-12 rounded-xl bg-[#F15B43] px-5 py-3 font-bold text-white">🐉 Conocer ArroKids</button>
      </div>
    </div>
  );
};

export default WinnerPage;
