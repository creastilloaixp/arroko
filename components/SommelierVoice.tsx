import React from 'react';
import { useApp } from '../context/AppContext';
import { XMarkIcon } from './Icons';

/**
 * Voice is intentionally gated until the backend issues short-lived realtime
 * credentials. A permanent provider key must never ship in the browser bundle.
 */
const SommelierVoice: React.FC = () => {
  const { closeSommelierVoice, openSommelierText } = useApp();

  const continueInText = () => {
    closeSommelierVoice();
    openSommelierText();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#07383D]/80 p-4">
      <section className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[#FFFDF8] p-8 text-center shadow-[0_24px_70px_rgba(7,56,61,0.38)]">
        <button
          type="button"
          onClick={closeSommelierVoice}
          aria-label="Cerrar modo de voz"
          className="absolute right-4 top-4 rounded-xl p-2 text-[#587776] hover:bg-[#DCE8E5]"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>

        <img
          src="/brand/roko-avatar-source.png"
          alt="Roko, anfitrión digital de Arrokó"
          className="mx-auto h-40 w-40 rounded-3xl object-cover object-top"
        />
        <p className="mt-6 font-display text-sm font-extrabold uppercase tracking-[0.2em] text-[#F15B43]">Roko · voz</p>
        <h2 className="mt-2 font-display text-4xl font-extrabold leading-none text-[#0B4F56]">Afinando la conversación</h2>
        <p className="mt-4 text-sm leading-6 text-[#587776]">
          La experiencia de voz se activará cuando el servidor entregue credenciales temporales seguras. El sommelier por texto ya puede ayudarte.
        </p>
        <button
          type="button"
          onClick={continueInText}
          className="mt-7 min-h-12 w-full rounded-xl bg-[#F15B43] px-5 py-3 font-bold text-white transition-colors hover:bg-[#E44E39] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0B4F56]/40"
        >
          Hablar con Roko por texto
        </button>
      </section>
    </div>
  );
};

export default SommelierVoice;
