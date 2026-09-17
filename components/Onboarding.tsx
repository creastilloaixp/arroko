import React from 'react';
import { useApp } from '../context/AppContext';

const Onboarding: React.FC = () => {
  const { setCurrentView } = useApp();

  return (
    <section className="relative min-h-[calc(100vh-76px)] overflow-hidden rounded-b-[28px] bg-[#F4EBDD] px-4 py-7 text-[#173B3D] sm:px-8 lg:px-12 lg:py-12">
      <div aria-hidden="true" className="absolute -right-24 top-0 hidden h-full w-[42%] min-w-72 -skew-x-6 bg-[#F15B43] lg:block" />
      <div aria-hidden="true" className="absolute right-0 top-0 h-2 w-28 bg-[#F15B43] lg:hidden" />
      <div aria-hidden="true" className="absolute bottom-0 left-0 h-5 w-full bg-[#0B4F56]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-150px)] max-w-6xl items-center gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="z-10 max-w-xl py-4 lg:py-10">
          <p className="font-display text-sm font-bold uppercase tracking-[0.08em] text-[#0B4F56]">
            Recompensas Arrokó · experiencia demo
          </p>
          <h2 className="mt-4 text-balance font-display text-[clamp(3.6rem,10vw,7.5rem)] font-extrabold leading-[0.82] tracking-[-0.025em] text-[#0B4F56]">
            TU ANTOJO,
            <span className="block text-[#F15B43]">CON PREMIO.</span>
          </h2>
          <p className="mt-7 max-w-[54ch] text-lg font-semibold leading-relaxed text-[#365E60] sm:text-xl">
            Gira, descubre tu recompensa y deja que Roko te recomiende el platillo y maridaje que mejor van contigo.
          </p>

          <button
            onClick={() => setCurrentView('roulette')}
            className="mt-8 min-h-14 w-full rounded-xl bg-[#F15B43] px-7 py-4 font-display text-xl font-extrabold uppercase tracking-[0.04em] text-white shadow-[0_8px_0_#9F3328] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:bg-[#E44E39] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0B4F56] focus-visible:ring-offset-4 active:translate-y-1 active:shadow-[0_3px_0_#9F3328] sm:w-auto sm:min-w-72"
          >
            Girar la ruleta
          </button>

          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#587776]">
            <span>18+ años</span>
            <span>Una participación por persona</span>
            <span>Registro al obtener premio</span>
          </div>
          <p className="mt-3 max-w-[60ch] text-xs leading-relaxed text-[#6E8C8B]">
            Premios de demostración sujetos a validación, disponibilidad, vigencia y condiciones finales de Arrokó.
          </p>
        </div>

        <div className="relative z-10 flex min-h-[420px] items-end justify-center lg:min-h-[640px]">
          <div aria-hidden="true" className="absolute bottom-10 h-20 w-[78%] rounded-[50%] bg-[#07383D]/25 blur-xl" />
          <img
            src="/brand/roko-avatar-source.png"
            alt="Roko, el anfitrión onigiri de Arrokó, listo para presentar la ruleta"
            className="relative max-h-[68vh] w-full max-w-[620px] rounded-[28px] object-cover object-top shadow-[18px_20px_0_#0B4F56]"
          />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-[#0B4F56] px-5 py-3 text-center text-[#FFFDF8] shadow-[0_8px_18px_rgba(7,56,61,0.22)]">
            <p className="font-display text-xl font-extrabold leading-none">SOY ROKO</p>
            <p className="mt-1 text-xs font-semibold">Tu antojo, bien acompañado</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Onboarding;
