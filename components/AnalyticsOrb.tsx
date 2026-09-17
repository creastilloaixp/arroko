import React, { useState } from 'react';
import { ChartBarIcon } from './Icons';

interface AnalyticsOrbProps {
  onClick: () => void;
}

const AnalyticsOrb: React.FC<AnalyticsOrbProps> = ({ onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      {/* Floating Orb */}
      <div
        className="fixed bottom-6 right-6 z-50 group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Tooltip */}
        {isHovered && (
          <div className="absolute bottom-full right-0 mb-2 px-4 py-2 bg-[#0B4F56] text-white text-sm rounded-lg shadow-xl whitespace-nowrap animate-fadeIn">
            Analista Arrokó
            <div className="absolute bottom-0 right-6 transform translate-y-1/2 rotate-45 w-2 h-2 bg-[#0B4F56]"></div>
          </div>
        )}

        {/* Orb Button */}
        <button
          onClick={onClick}
          className="relative w-16 h-16 rounded-2xl bg-[#0B4F56] shadow-2xl transition-all duration-300 hover:-translate-y-1 active:translate-y-0 flex items-center justify-center animate-pulse-slow"
          aria-label="Abrir analista Arrokó"
        >
          {/* Glow effect */}
          <div className="absolute inset-1 rounded-xl bg-[#F15B43]/25 opacity-70 group-hover:opacity-100 transition-opacity"></div>

          {/* Icon */}
          <div className="relative z-10">
            <ChartBarIcon className="h-8 w-8 text-white drop-shadow-lg" />
          </div>

          {/* Animated rings */}
          <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping-slow"></div>
          <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-ping-slower"></div>
        </button>

        {/* Notification badge (optional) */}
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#F15B43] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
          AI
        </div>
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }

        @keyframes ping-slow {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          75%, 100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        @keyframes ping-slower {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-pulse-slow {
          animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .animate-ping-slow {
          animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        .animate-ping-slower {
          animation: ping-slower 3s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default AnalyticsOrb;
