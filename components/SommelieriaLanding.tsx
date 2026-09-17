import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BarChart3, MessageCircle, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

const SommelieriaLanding: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const { openSommelierText: openRoko } = useApp();

  return (
    <main className="min-h-screen bg-[#F4EBDD] text-[#173B3D]">
      <section className="mx-auto grid min-h-[82vh] max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.08fr_.92fr]">
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
          <p className="font-display text-sm font-extrabold uppercase tracking-[.22em] text-[#F15B43]">Sommelier inteligente · demostración</p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-extrabold leading-[.94] text-[#0B4F56] sm:text-7xl">Tu antojo, bien acompañado.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#587776]">
            Roko entiende si buscas algo fresco, cremoso, crujiente o picante; recomienda un platillo real del menú y propone un maridaje sin alcohol compatible.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={openRoko} className="min-h-12 rounded-xl bg-[#F15B43] px-6 py-3 font-bold text-white hover:bg-[#E44E39] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0B4F56]/35">
              Probar a Roko <ArrowRight className="ml-2 inline h-5 w-5" />
            </button>
            <a href="/" className="min-h-12 rounded-xl border border-[#0B4F56] px-6 py-3 text-center font-bold text-[#0B4F56] hover:bg-white/55">Volver a la experiencia</a>
          </div>
          <p className="mt-5 max-w-xl text-xs leading-5 text-[#6E8C8B]">Los mocktails son conceptos de demostración pendientes de validación por la barra de Arrokó. Disponibilidad y precios deben confirmarse con el restaurante.</p>
        </motion.div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute inset-10 rounded-full bg-[#F15B43]/25 blur-3xl" />
          <img src="/brand/roko-avatar-source.png" alt="Roko, anfitrión digital de Arrokó" className="relative w-full rounded-[2.5rem] object-cover object-top shadow-[0_24px_70px_rgba(11,79,86,.22)]" />
        </div>
      </section>

      <section className="bg-[#0B4F56] px-5 py-16 text-white">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {[
            [Sparkles, 'Recomendación sensorial', 'Parte del antojo del cliente y sólo usa productos registrados.'],
            [MessageCircle, 'Conversación que convierte', 'Una pregunta por turno y un siguiente paso claro hacia confirmación.'],
            [BarChart3, 'Datos para campañas', 'Conecta interacción, premio, visita y canje para medir resultados reales.'],
          ].map(([Icon, title, body]) => {
            const CardIcon = Icon as typeof Sparkles;
            return <article key={String(title)} className="rounded-2xl border border-white/15 bg-white/7 p-6"><CardIcon className="h-7 w-7 text-[#F7A08F]" /><h2 className="mt-5 font-display text-2xl font-extrabold">{String(title)}</h2><p className="mt-3 text-sm leading-6 text-white/72">{String(body)}</p></article>;
          })}
        </div>
      </section>
    </main>
  );
};

export default SommelieriaLanding;
