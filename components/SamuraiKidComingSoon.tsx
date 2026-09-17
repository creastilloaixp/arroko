/* ArroKids: Samurai Kid guía el juego; Roko permanece en la identidad general de Arrokó. */
import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Gamepad2, ShieldCheck, Sparkles, Star, Utensils } from 'lucide-react';
import RollBuilder3D from './RollBuilder3D';
import { hasActiveVisit, recordGameComplete } from '../lib/arrokoExperience';

type ExperienceView = 'home' | 'game' | 'badge' | 'taste' | 'recommendation' | 'adult';
type TasteId = 'crunchy' | 'gentle' | 'share';

interface SamuraiKidExperienceProps { onExit?: () => void; }
const POINTS_KEY = 'arrokids_points_v1';

const readPoints = () => {
  try {
    const value = Number(window.localStorage.getItem(POINTS_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch { return 0; }
};

const tastes: Array<{ id: TasteId; icon: string; title: string; description: string }> = [
  { id: 'crunchy', icon: '🥢', title: 'Algo crujiente', description: 'Quiero escuchar el crunch.' },
  { id: 'gentle', icon: '🍚', title: 'Algo suave', description: 'Prefiero sabores tranquilos.' },
  { id: 'share', icon: '🍣', title: 'Para compartir', description: 'Quiero probar con mi familia.' },
];

const recommendations: Record<TasteId, { name: string; description: string }> = {
  crunchy: { name: 'Alex Roll', description: 'Una opción empanizada con proteína a elegir. Un adulto debe confirmar ingredientes y preparación.' },
  gentle: { name: 'Yakimeshi Kō', description: 'Arroz frito con proteína y vegetales. Un adulto puede pedir ajustes y confirmar ingredientes.' },
  share: { name: 'Rollitos de Cajón', description: 'Una entrada para poner al centro. Disponibilidad, proteína e ingredientes se confirman con un adulto.' },
};

const SamuraiKidComingSoon: React.FC<SamuraiKidExperienceProps> = ({ onExit }) => {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<ExperienceView>('home');
  const [taste, setTaste] = useState<TasteId | null>(null);
  const [score, setScore] = useState(0);
  const [totalPoints, setTotalPoints] = useState(readPoints);

  const goHome = () => { setView('home'); setTaste(null); setScore(0); };
  const finishGame = async (value: number) => {
    let nextTotal = totalPoints + value;
    try {
      const saved = await recordGameComplete('roll-builder', value);
      if (saved && typeof saved.points_balance === 'number') nextTotal = saved.points_balance;
    } catch (error) {
      console.warn('La partida quedó local y se podrá reintentar después.', error);
    }
    setScore(value);
    setTotalPoints(nextTotal);
    try { window.localStorage.setItem(POINTS_KEY, String(nextTotal)); } catch { /* demo local */ }
    setView('badge');
  };
  const chooseTaste = (id: TasteId) => { setTaste(id); setView('recommendation'); };

  return (
    <section className="relative min-h-[calc(100vh-24px)] overflow-hidden rounded-[28px] bg-[#07383D] text-[#FFFDF8] shadow-[0_18px_0_#C83F30] sm:min-h-[calc(100vh-32px)] md:min-h-[calc(100vh-64px)]">
      <div aria-hidden="true" className="pointer-events-none absolute -left-28 top-24 h-72 w-72 rounded-full border-[46px] border-[#F15B43]/18" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 right-[18%] h-80 w-80 rounded-full border-[56px] border-[#F4EBDD]/8" />

      <header className="relative z-20 flex items-center justify-between border-b border-white/14 px-5 py-4 sm:px-8">
        <button type="button" onClick={onExit} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-extrabold text-[#DCE8E5] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F4EBDD]"><ArrowLeft className="h-5 w-5" /> Arrokó</button>
        <p className="font-display text-2xl font-extrabold tracking-[0.04em] text-white">ARRO<span className="text-[#F15B43]">KIDS</span></p>
        <button type="button" onClick={() => setView('adult')} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-extrabold text-[#DCE8E5] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F4EBDD]"><ShieldCheck className="h-5 w-5" /> <span className="hidden sm:inline">Adultos</span></button>
      </header>

      <div className="relative z-10">
        {view === 'home' && (
          <div className="grid min-h-[720px] items-center lg:grid-cols-[.92fr_1.08fr]">
            <motion.div initial={reduceMotion ? false : { opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="relative z-10 px-6 pb-6 pt-10 sm:px-10 lg:px-14 lg:py-16">
              <p className="font-display text-sm font-extrabold uppercase tracking-[0.14em] text-[#F15B43]">El dojo de Samurai Kid</p>
              <h1 className="mt-4 max-w-[9ch] font-display text-6xl font-extrabold leading-[0.86] sm:text-7xl lg:text-8xl">LA MESA ES TU MISIÓN</h1>
              <p className="mt-6 max-w-lg text-lg font-semibold leading-relaxed text-[#DCE8E5]">Construye tu rollo, suma puntos y descubre premios con ayuda de un adulto. Aquí no pedimos datos personales.</p>
              <p className="mt-5 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-extrabold text-[#F4EBDD]">Tu marcador: {totalPoints} puntos</p>
              <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <button type="button" onClick={() => setView('game')} className="group min-h-28 rounded-2xl bg-[#F15B43] p-5 text-left text-white shadow-[0_8px_0_#9F3328] transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white active:translate-y-1"><Gamepad2 className="h-7 w-7" /><span className="mt-5 flex items-end justify-between gap-3 font-display text-2xl font-extrabold leading-none">Construye tu rollo <ChevronRight className="h-6 w-6 transition-transform group-hover:translate-x-1" /></span></button>
                <button type="button" onClick={() => setView('taste')} className="group min-h-28 rounded-2xl bg-[#F4EBDD] p-5 text-left text-[#07383D] shadow-[0_8px_0_#CDBFAA] transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F15B43] active:translate-y-1"><Utensils className="h-7 w-7" /><span className="mt-5 flex items-end justify-between gap-3 font-display text-2xl font-extrabold leading-none">Elegir mi antojo <ChevronRight className="h-6 w-6 transition-transform group-hover:translate-x-1" /></span></button>
              </div>
              <p className="mt-7 flex max-w-md items-start gap-3 text-sm leading-relaxed text-[#B9D0CC]"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#F15B43]" /> Los premios y recomendaciones siempre requieren confirmación de un adulto y del equipo de Arrokó.</p>
            </motion.div>

            <motion.div initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.55, delay: reduceMotion ? 0 : 0.08 }} className="relative flex min-h-[480px] items-center justify-center overflow-hidden p-8 lg:h-full">
              <div aria-hidden="true" className="absolute h-[420px] w-[420px] rounded-full bg-[#F15B43]/18 blur-3xl" />
              <img src="/brand/arrokids_master_hero_3d.jpg" alt="Samurai Kid, Nori el Dragón y Roko, el universo oficial de ArroKids" className="relative z-10 max-h-[650px] w-full max-w-[620px] rounded-[36px] object-cover object-top shadow-[14px_14px_0_#F15B43]" />
              <div className="absolute bottom-7 right-5 z-20 max-w-[240px] -rotate-2 bg-[#F4EBDD] px-4 py-3 text-[#07383D] shadow-[6px_6px_0_#F15B43] sm:right-9"><p className="font-display text-xl font-extrabold leading-none">SAMURAI KID & NORI</p><p className="mt-1 text-xs font-bold">¡Roko te espera en tu mesa!</p></div>
            </motion.div>
          </div>
        )}

        {view === 'game' && <ExperiencePanel onBack={goHome} kicker="Misión 01" title="CONSTRUYE TU ROLLO" description="Sigue las pistas de Samurai Kid, agrega los ingredientes en orden y termina antes de que llegue la comida."><RollBuilder3D onComplete={finishGame} /></ExperiencePanel>}

        {view === 'badge' && (
          <ExperiencePanel onBack={goHome} kicker="Misión cumplida" title={`${score} PUNTOS`} description="Terminaste tu rollo sin compartir ningún dato personal.">
            <div className="mt-8 grid gap-8 sm:grid-cols-[220px_1fr] sm:items-center">
              <div className="grid aspect-square place-items-center rounded-full border-[14px] border-[#F4EBDD] bg-[#F15B43] shadow-[0_12px_0_#9F3328]"><Star className="h-24 w-24 fill-[#F4EBDD] text-[#F4EBDD]" /></div>
              <div><p className="font-display text-3xl font-extrabold">Total: {totalPoints} puntos</p><p className="mt-3 text-lg font-semibold leading-relaxed text-[#DCE8E5]">{hasActiveVisit() ? 'Tus puntos quedaron vinculados a la visita del adulto responsable.' : 'El marcador se guarda sólo en este dispositivo hasta hacer check-in.'} Arrokó confirmará premios disponibles, como postres o coleccionables.</p><button type="button" onClick={() => setView('taste')} className="mt-6 min-h-12 rounded-xl bg-[#F4EBDD] px-6 font-extrabold text-[#07383D]">Ahora elige tu antojo</button></div>
            </div>
          </ExperiencePanel>
        )}

        {view === 'taste' && <ExperiencePanel onBack={goHome} kicker="Misión de antojo" title="¿QUÉ SE TE ANTOJA?" description="No necesitas saber el nombre del platillo. Elige cómo quieres que se sienta."><div className="mt-8 grid gap-4 sm:grid-cols-3">{tastes.map((option) => <button key={option.id} type="button" onClick={() => chooseTaste(option.id)} className="group min-h-48 rounded-2xl bg-[#F4EBDD] p-6 text-left text-[#07383D] shadow-[0_8px_0_#CDBFAA] transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F15B43] active:translate-y-1"><span className="text-5xl" aria-hidden="true">{option.icon}</span><span className="mt-6 block font-display text-3xl font-extrabold leading-none">{option.title}</span><span className="mt-3 block text-sm font-semibold text-[#587776]">{option.description}</span></button>)}</div></ExperiencePanel>}

        {view === 'recommendation' && taste && <ExperiencePanel onBack={() => setView('taste')} kicker="Samurai Kid encontró una pista" title={recommendations[taste].name.toUpperCase()} description={recommendations[taste].description}><div className="mt-8 bg-[#F15B43] p-6 text-white shadow-[8px_8px_0_#9F3328] sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8"><div><p className="font-display text-3xl font-extrabold leading-none">SIGUIENTE PASO: UN ADULTO</p><p className="mt-3 max-w-xl font-semibold leading-relaxed text-white/90">No se agregó nada a una orden. Confirmen ingredientes, alergias, disponibilidad y preparación con el equipo.</p></div><button type="button" onClick={() => setView('adult')} className="mt-6 min-h-12 shrink-0 rounded-xl bg-[#F4EBDD] px-6 font-extrabold text-[#07383D] sm:mt-0">Ir a zona para adultos</button></div></ExperiencePanel>}

        {view === 'adult' && <ExperiencePanel onBack={goHome} kicker="Zona para adultos" title="TÚ CONFIRMAS" description="ArroKids ayuda a explorar. El equipo de Arrokó valida cualquier pedido o premio."><div className="mt-8 grid gap-6 bg-[#F4EBDD] p-6 text-[#07383D] shadow-[8px_8px_0_#F15B43] sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"><div><p className="flex items-center gap-3 font-display text-3xl font-extrabold"><ShieldCheck className="h-8 w-8 text-[#F15B43]" /> Sin datos del menor</p><p className="mt-3 max-w-2xl font-semibold leading-relaxed text-[#587776]">El prototipo no crea perfiles infantiles, no habilita compras y no promete premios sin reglas aprobadas por Arrokó.</p></div><button type="button" onClick={onExit} className="min-h-12 rounded-xl bg-[#07383D] px-6 font-extrabold text-white">Volver a Arrokó</button></div></ExperiencePanel>}
      </div>
    </section>
  );
};

const ExperiencePanel: React.FC<{ kicker: string; title: string; description: string; onBack: () => void; children: React.ReactNode }> = ({ kicker, title, description, onBack, children }) => (
  <div className="mx-auto min-h-[720px] max-w-6xl px-6 py-10 sm:px-10 sm:py-16">
    <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-extrabold text-[#DCE8E5] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F4EBDD]"><ArrowLeft className="h-5 w-5" /> Inicio ArroKids</button>
    <div className="mt-10"><p className="font-display text-sm font-extrabold uppercase tracking-[0.14em] text-[#F15B43]"><Sparkles className="mr-2 inline h-4 w-4" />{kicker}</p><h1 className="mt-3 max-w-4xl font-display text-5xl font-extrabold leading-[0.9] sm:text-7xl">{title}</h1><p className="mt-5 max-w-3xl text-lg font-semibold leading-relaxed text-[#DCE8E5]">{description}</p></div>
    {children}
  </div>
);

export default SamuraiKidComingSoon;
