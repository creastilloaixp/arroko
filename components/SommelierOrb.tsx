import React from 'react';
import { useApp } from '../context/AppContext';
import { ChatBubbleLeftRightIcon, MicrophoneIcon } from './Icons';

const SommelierOrb: React.FC = () => {
  const { isSommelierOrbOpen, toggleSommelierOrb, openSommelierText, openSommelierVoice } = useApp();

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Menu that appears when orb is clicked */}
      {isSommelierOrbOpen && (
        <div
          className="absolute bottom-full right-0 mb-3 w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-2 space-y-1"
          style={{ animation: 'fadeInUp 0.3s ease-out' }}
        >
          <button
            onClick={openSommelierText}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-white rounded-md hover:bg-red-600 transition-colors"
          >
            <ChatBubbleLeftRightIcon className="h-5 w-5" />
            <span>Chatear</span>
          </button>
          <button
            onClick={openSommelierVoice}
            disabled
            title="La voz se habilitará cuando el token efímero de servidor esté listo"
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-[#8FB0AE] rounded-md cursor-not-allowed"
          >
            <MicrophoneIcon className="h-5 w-5" />
            <span>Voz · próximamente</span>
          </button>
        </div>
      )}

      {/* The main orb button */}
      <button
        onClick={toggleSommelierOrb}
        className="w-16 h-16 overflow-hidden rounded-[22px] border-2 border-[#F4EBDD] bg-[#0B4F56] flex items-center justify-center shadow-[0_8px_0_#07383D] transform transition-transform hover:-translate-y-1 active:translate-y-1 focus:outline-none focus:ring-4 focus:ring-[#F15B43]/50"
        aria-label="Abrir Roko, el sommelier inteligente"
      >
        <img src="/brand/roko-avatar-source.png" alt="" className="h-full w-full object-cover object-top" />
      </button>
    </div>
  );
};

export default SommelierOrb;
