/*
THESIS: La caja de Arrokó se abre como una charola de premios; evitamos la estética de casino.
OWN-WORLD: Laca teal, coral de empaque, costuras de arroz y Roko como mecanismo central.
STORY: Entender la dinámica → activar la charola → sentir la desaceleración → recibir un siguiente paso claro.
FIRST VIEWPORT: La charola domina y el CTA central queda al alcance del pulgar; condiciones y estado siguen visibles.
FORM: Un objeto físico digital, con marcas, puntero y profundidad construidos en SVG/CSS sin dependencia externa.
*/
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Prize } from '../types';
import { useApp } from '../context/AppContext';
import { trackInteraction } from '../lib/tracking';

interface RouletteProps {
  prizes: Prize[];
}

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, endAngle - startAngle <= 180 ? '0' : '1', 0, end.x, end.y,
    'L', x, y,
    'Z',
  ].join(' ');
};

const SHORT_LABELS: Record<string, string[]> = {
  p1: ['OTRA', 'VUELTA'],
  p2: ['BEBIDA', 'DE CASA'],
  p3: ['ENTRADA', 'CORTESÍA'],
  p4: ['10%', 'PRÓXIMA'],
  p5: ['ROLLITOS', 'CAJÓN'],
  p6: ['CAMARÓN', 'ROCA'],
  p7: ['ARROKÓ', 'ESPECIAL'],
  p8: ['LA', 'EXPERIENCIA'],
};

const pickPrizeIndex = (prizes: Prize[]) => {
  const totalWeight = prizes.reduce((sum, prize) => sum + prize.probability_weight, 0);
  let randomWeight = Math.random() * totalWeight;
  const foundIndex = prizes.findIndex((prize) => {
    randomWeight -= prize.probability_weight;
    return randomWeight < 0;
  });
  return foundIndex === -1 ? 0 : foundIndex;
};

const Roulette: React.FC<RouletteProps> = ({ prizes }) => {
  const { handleSpinFinish } = useApp();
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => {
      media.removeEventListener('change', updatePreference);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const geometry = useMemo(() => {
    const size = 560;
    const center = size / 2;
    const radius = 244;
    const segmentDegrees = 360 / prizes.length;
    return { size, center, radius, segmentDegrees };
  }, [prizes.length]);

  const handleSpin = () => {
    if (isSpinning || prizes.length === 0) return;
    const selectedPrizeIndex = pickPrizeIndex(prizes);
    const duration = prefersReducedMotion ? 350 : 4800;
    const revolutions = prefersReducedMotion ? 0 : 6;
    const landingAngle = 360 - selectedPrizeIndex * geometry.segmentDegrees - geometry.segmentDegrees / 2;

    setIsSpinning(true);
    trackInteraction('spin_button_click', null);
    setRotation((previous) => {
      const normalized = ((previous % 360) + 360) % 360;
      const finalApproach = (landingAngle - normalized + 360) % 360;
      return previous + revolutions * 360 + finalApproach;
    });

    timeoutRef.current = window.setTimeout(() => {
      handleSpinFinish(prizes[selectedPrizeIndex]);
    }, duration + 120);
  };

  return (
    <section className="mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-[#07383D] text-[#FFFDF8] shadow-[0_18px_0_#C83F30]">
      <div className="grid items-center gap-7 px-4 py-7 sm:px-7 sm:py-9 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)] lg:gap-10 lg:px-12 lg:py-12">
        <div className="order-2 min-w-0 lg:order-1">
          <div className="relative mx-auto aspect-square w-full max-w-[560px]">
            <div aria-hidden="true" className="absolute inset-[1.5%] rounded-full bg-[#032D31] shadow-[0_22px_40px_rgba(0,0,0,.34)]" />
            <div aria-hidden="true" className="absolute inset-[4.5%] rounded-full border-[10px] border-[#F4EBDD] bg-[#F15B43] shadow-[inset_0_0_0_6px_#07383D] sm:border-[14px]" />

            <div className="absolute inset-0 z-20 flex justify-center" aria-hidden="true">
              <div className="relative h-[16%] w-[18%] min-w-14">
                <span className="absolute left-[22%] top-0 h-[72%] w-[13%] -rotate-[10deg] rounded-b bg-[#F4EBDD] shadow-[2px_3px_0_#173B3D]" />
                <span className="absolute right-[22%] top-0 h-[72%] w-[13%] rotate-[10deg] rounded-b bg-[#F4EBDD] shadow-[2px_3px_0_#173B3D]" />
                <span className="absolute bottom-0 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[16px] border-r-[16px] border-t-[28px] border-l-transparent border-r-transparent border-t-[#F15B43] drop-shadow-[0_4px_0_#9F3328] sm:border-l-[22px] sm:border-r-[22px] sm:border-t-[38px]" />
              </div>
            </div>

            <div
              className="absolute inset-[7.5%] overflow-hidden rounded-full will-change-transform"
              style={{
                transform: `rotate(${rotation}deg)`,
                transitionDuration: `${prefersReducedMotion ? 350 : 4800}ms`,
                transitionProperty: 'transform',
                transitionTimingFunction: 'cubic-bezier(0.12, 0.62, 0.08, 1)',
              }}
            >
              <svg viewBox={`0 0 ${geometry.size} ${geometry.size}`} className="h-full w-full" role="img" aria-label="Charola circular con ocho posibles recompensas">
                <circle cx={geometry.center} cy={geometry.center} r="274" fill="#0B4F56" />
                {Array.from({ length: 48 }, (_, index) => {
                  const angle = index * 7.5;
                  const outer = polarToCartesian(geometry.center, geometry.center, 270, angle);
                  const inner = polarToCartesian(geometry.center, geometry.center, index % 2 === 0 ? 253 : 258, angle);
                  return <line key={angle} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#F4EBDD" strokeWidth={index % 2 === 0 ? 5 : 3} strokeLinecap="round" />;
                })}
                <g>
                  {prizes.map((prize, index) => {
                    const startAngle = index * geometry.segmentDegrees;
                    const endAngle = startAngle + geometry.segmentDegrees;
                    const textAngle = startAngle + geometry.segmentDegrees / 2;
                    const textPosition = polarToCartesian(geometry.center, geometry.center, 172, textAngle);
                    const labels = SHORT_LABELS[prize.id] ?? [prize.name.slice(0, 12).toUpperCase()];
                    const fill = index % 2 === 0 ? '#0B4F56' : '#F15B43';

                    return (
                      <g key={prize.id}>
                        <path d={describeArc(geometry.center, geometry.center, geometry.radius, startAngle, endAngle)} fill={fill} stroke="#F4EBDD" strokeWidth="5" />
                        <g transform={`translate(${textPosition.x} ${textPosition.y}) rotate(${textAngle + 90})`}>
                          <text textAnchor="middle" y="-12" fill="#FFFDF8" fontSize="30" aria-hidden="true">{prize.icon}</text>
                          <text textAnchor="middle" y="15" fill="#FFFDF8" fontFamily="Barlow Condensed, Arial Narrow, sans-serif" fontSize="17" fontWeight="800" letterSpacing="1">
                            {labels.map((label, line) => <tspan key={label} x="0" dy={line === 0 ? 0 : 18}>{label}</tspan>)}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>
                <circle cx={geometry.center} cy={geometry.center} r="91" fill="#F4EBDD" stroke="#07383D" strokeWidth="8" />
              </svg>
            </div>

            <button
              type="button"
              onClick={handleSpin}
              disabled={isSpinning}
              className="absolute left-1/2 top-1/2 z-30 grid h-[25%] w-[25%] min-h-[82px] min-w-[82px] -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full border-[5px] border-[#FFFDF8] bg-[#F15B43] text-white shadow-[0_9px_0_#9F3328] transition-[transform,box-shadow,background-color] hover:-translate-y-[54%] hover:bg-[#E44E39] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#07383D] active:-translate-y-[47%] active:shadow-[0_3px_0_#9F3328] disabled:cursor-wait disabled:opacity-90 sm:border-[7px]"
              aria-describedby="roulette-status roulette-terms"
            >
              <span className="flex flex-col items-center leading-none">
                <img src="/brand/roko-avatar-source.png" alt="" className="h-10 w-12 object-cover object-top sm:h-14 sm:w-16" />
                <span className="font-display text-lg font-extrabold tracking-[0.06em] sm:text-2xl">{isSpinning ? 'VA…' : 'GIRAR'}</span>
              </span>
            </button>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <p className="font-display text-sm font-bold uppercase tracking-[0.14em] text-[#F15B43]">Roko sirve la suerte</p>
          <h2 className="mt-3 max-w-[9ch] font-display text-5xl font-extrabold leading-[0.88] text-[#FFFDF8] sm:text-6xl lg:text-7xl">GIRA LA CHAROLA</h2>
          <p className="mt-5 max-w-md text-base font-semibold leading-relaxed text-[#DCE8E5] sm:text-lg">
            Ocho posibilidades inspiradas en Arrokó. Un toque, una recompensa y una razón para volver.
          </p>

          <div className="mt-7 border-y border-white/16 py-5">
            <p id="roulette-status" className="flex items-start gap-3 text-sm font-bold" aria-live="polite">
              <span className={`mt-1 h-3 w-3 shrink-0 bg-[#F15B43] ${isSpinning ? 'animate-pulse' : ''}`} aria-hidden="true" />
              {isSpinning ? 'La charola está desacelerando. Roko ya eligió tu resultado.' : 'Presiona a Roko para comenzar. Sólo necesitas un giro.'}
            </p>
          </div>

          <ol className="mt-6 grid grid-cols-3 gap-3 text-xs font-bold text-[#B9D0CC]" aria-label="Cómo funciona">
            <li><span className="mb-2 block font-display text-2xl text-[#F15B43]">01</span>Gira</li>
            <li><span className="mb-2 block font-display text-2xl text-[#F15B43]">02</span>Registra</li>
            <li><span className="mb-2 block font-display text-2xl text-[#F15B43]">03</span>Canjea</li>
          </ol>

          <p id="roulette-terms" className="mt-7 max-w-md text-xs leading-relaxed text-[#B9D0CC]">
            Prototipo de demostración. Premios, vigencias y probabilidades requieren aprobación final de Arrokó antes de publicación.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Roulette;
