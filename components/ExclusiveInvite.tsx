import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { SparklesIcon, ClockIcon } from './Icons';
import { PRIZES } from '../constants';

// --- SVG Helper Functions (Copied from Roulette.tsx for visual consistency) ---
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number): string => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    "L", x, y,
    "L", start.x, start.y
  ].join(" ");
};

const ExclusiveInvite: React.FC = () => {
  const { setCurrentView } = useApp();
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [isRevealed, setIsRevealed] = useState(false);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setIsRevealed(true), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Slow rotation effect
  useEffect(() => {
    const spinInterval = setInterval(() => {
        setRotation(prev => (prev + 0.2) % 360);
    }, 20);
    return () => clearInterval(spinInterval);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const svgSize = 300;
  const center = svgSize / 2;
  const radius = svgSize / 2;
  const numSegments = PRIZES.length;
  const segmentDegrees = 360 / numSegments;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-black to-black animate-pulse" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20" />
      <div className={`relative w-full max-w-4xl flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 transition-all duration-1000 transform ${isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        {/* Visual Roulette Wheel */}
        <div className="relative w-[280px] h-[280px] md:w-[350px] md:h-[350px] flex-shrink-0 order-2 md:order-1">
            <div className="absolute inset-0 rounded-full border-4 border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.2)] z-10 pointer-events-none"></div>
             {/* Pointer */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 filter drop-shadow-lg">
                <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-red-600"></div>
            </div>
            <div className="w-full h-full transition-transform duration-75 ease-linear" style={{ transform: `rotate(${rotation}deg)` }}>
                <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="w-full h-full opacity-80 hover:opacity-100 transition-opacity duration-500">
                    <g>
                    {PRIZES.map((prize, index) => {
                        const startAngle = index * segmentDegrees;
                        const endAngle = startAngle + segmentDegrees;
                        return (
                        <path
                            key={prize.id}
                            d={describeArc(center, center, radius, startAngle, endAngle)}
                            fill={prize.color}
                            stroke="#111827"
                            strokeWidth="1"
                        />
                        );
                    })}
                    </g>
                </svg>
            </div>
            {/* Center Hub */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-gray-900 rounded-full border-2 border-yellow-500/50 flex items-center justify-center z-10 shadow-xl">
                 <span className="text-2xl">🎰</span>
            </div>
        </div>

        {/* Content Side */}
        <div className="text-center md:text-left max-w-md order-1 md:order-2 z-20">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-500 text-xs font-bold tracking-widest uppercase mb-6 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
            <SparklesIcon className="w-4 h-4" />
            Invitación Exclusiva
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
            TU GIRO <br />
            <span className="text-[#F15B43]">TE ESPERA</span>
            </h1>

            <p className="text-gray-400 text-lg mb-6 leading-relaxed">
            Has desbloqueado una oportunidad única. Gira la ruleta y descubre tu premio exclusivo.
            </p>

            <div className="flex items-center justify-center md:justify-start gap-3 mb-8 text-red-500 font-mono text-lg bg-red-900/10 px-4 py-2 rounded-lg border border-red-900/30 w-fit mx-auto md:mx-0">
            <ClockIcon className="w-5 h-5 animate-pulse" />
            <span>Expira en: <span className="font-bold text-white">{formatTime(timeLeft)}</span></span>
            </div>

            <button
            onClick={() => setCurrentView('register')}
            className="group relative w-full md:w-auto inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-gradient-to-r from-red-600 to-red-800 font-lg rounded-xl hover:scale-105 focus:outline-none ring-offset-2 focus:ring-2 ring-red-400 shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:shadow-[0_0_40px_rgba(220,38,38,0.6)]"
            >
            <span className="absolute w-full h-full rounded-xl opacity-0 group-hover:opacity-20 bg-white animate-shine" />
            <span className="relative flex items-center gap-3 tracking-widest uppercase text-lg">
                GIRAR AHORA
                <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            </span>
            </button>
            <p className="mt-4 text-xs text-gray-500 uppercase tracking-widest text-center md:text-left">
             * Solo un giro por persona
            </p>
        </div>
      </div>
    </div>
  );
};

export default ExclusiveInvite;
