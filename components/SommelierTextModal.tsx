import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { XMarkIcon, PaperAirplaneIcon, SpinnerIcon } from './Icons';
import { askGemini } from '../lib/gemini';
import { routeKnowledgeQuery } from '../lib/knowledgeRouter';
import { showToast } from './ui/toast';
import { trackInteraction } from '../lib/tracking';
import ReactMarkdown from 'react-markdown';
import { ReservationReveal } from './ReservationReveal';

type Message = {
  role: 'user' | 'model';
  content: string;
  reservation?: any;
};

const SommelierTextModal: React.FC = () => {
  const { closeSommelierText, participant } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial message from the AI
    const getInitialMessage = async () => {
        const preferencesContext = participant?.preferences?.flavors
            ? `\n[User Preferences: Flavors=${participant.preferences.flavors.join(',')}, Group=${participant.preferences.group || 'unknown'}]`
            : '';

        // Enhanced prompt for personalized first message with immediate value
        const enhancedPrompt = participant?.preferences?.flavors
            ? `Saluda al invitado ${participant.fullName || 'estimado cliente'} de forma cálida y personalizada. IMPORTANTE: Usa sus preferencias (${participant.preferences.flavors.join(', ')} y ${participant.preferences.group || 'su grupo'}) para dar UNA recomendación específica del menú real (con nombre y precio exacto). Sé breve, amigable y termina preguntando si quiere saber más o hacer una reservación.${preferencesContext}`
            : `Saluda al invitado de forma cálida. Preséntate como Roko, el anfitrión digital de Arrokó. Menciona brevemente que puedes ayudar con recomendaciones, maridajes y reservaciones. Sé conciso y amigable.`;

        const initialResponse = await askGemini([], enhancedPrompt, participant?.id);
        setMessages([{ role: 'model', content: initialResponse }]);
        setIsLoading(false);
    };
    getInitialMessage();
  }, [participant?.id, participant?.fullName, participant?.preferences]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || isLoading) return;

    const userMessage: Message = { role: 'user', content: message };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    void trackInteraction('sommelier_text_message', participant?.id ?? null, { message });

    const historyForApi = messages.map(msg => ({ role: msg.role, parts: [{ text: msg.content }] }));
    const routed = await routeKnowledgeQuery(historyForApi, message, participant?.id, participant || null, 'text');
    const aiResponse = routed.text;
    if (routed.reservationCreated) {
      showToast('Reservación registrada (texto)', 'success');
    }

    setMessages(prev => [...prev, {
      role: 'model',
      content: aiResponse,
      reservation: routed.reservationCreated ? (routed as any).reservation : undefined
    }]);
    setIsLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  return (
    <div className="fixed inset-0 bg-[#07383D]/75 z-50 flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg h-[80vh] bg-[#FFFDF8] text-[#173B3D] rounded-2xl shadow-[0_18px_48px_rgba(7,56,61,0.32)] flex flex-col"
        style={{ animation: 'fadeInScale 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#DCE8E5]">
          <div className="flex items-center gap-3">
            <img src="/brand/roko-avatar-source.png" alt="" className="h-10 w-10 rounded-xl object-cover object-top" />
            <div>
              <h3 className="font-display text-2xl font-extrabold leading-none text-[#0B4F56]">Roko</h3>
              <p className="text-xs font-semibold text-[#6E8C8B]">Sommelier inteligente</p>
            </div>
          </div>
          <button aria-label="Cerrar sommelier" onClick={closeSommelierText} className="rounded-lg p-2 text-[#587776] hover:bg-[#DCE8E5] hover:text-[#0B4F56] transition-colors">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {messages.map((msg, index) => (
            <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'model' && <img src="/brand/roko-avatar-source.png" alt="" className="w-8 h-8 rounded-lg object-cover object-top flex-shrink-0" />}
                <div className={`p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-[#F15B43] text-white rounded-br-none'
                    : 'bg-[#DCE8E5] text-[#173B3D] rounded-bl-none'
                } max-w-xs md:max-w-md`}>
                  <div className="text-sm">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.reservation && (
                    <ReservationReveal
                      customerName={msg.reservation.customer_name}
                      date={msg.reservation.reservation_time}
                      guests={msg.reservation.party_size}
                      confirmationId={msg.reservation.id}
                    />
                  )}
                </div>
            </div>
          ))}
          {isLoading && (
             <div className="flex gap-3 justify-start">
                <img src="/brand/roko-avatar-source.png" alt="" className="w-8 h-8 rounded-lg object-cover object-top flex-shrink-0" />
                 <div className="max-w-xs md:max-w-md p-3 rounded-2xl bg-[#DCE8E5] text-[#173B3D] rounded-bl-none flex items-center">
                    <SpinnerIcon className="h-5 w-5 text-[#0B4F56]" />
                 </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-4 border-t border-[#DCE8E5]">
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Cuéntame qué se te antoja..."
              className="flex-1 min-h-12 bg-white border border-[#9EB7B4] rounded-xl px-4 py-2 text-[#173B3D] placeholder-[#6E8C8B] focus:outline-none focus:ring-4 focus:ring-[#0B4F56]/25"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Enviar mensaje"
              className="w-12 h-12 flex-shrink-0 rounded-xl bg-[#F15B43] hover:bg-[#E44E39] text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0B4F56]"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </form>

          {/* Quick Suggestions */}
          {messages.length <= 2 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => void sendMessage('Quiero una recomendación. Prefiero algo fresco o crujiente.')}
                disabled={isLoading}
                className="px-3 py-2 text-xs font-bold bg-[#DCE8E5] hover:bg-[#C9DDDA] text-[#0B4F56] rounded-lg transition-colors disabled:opacity-50"
              >
                ✨ ¿Qué me recomiendas?
              </button>
              <button
                onClick={() => void sendMessage('Muéstrame el menú disponible por categorías.')}
                disabled={isLoading}
                className="px-3 py-2 text-xs font-bold bg-[#DCE8E5] hover:bg-[#C9DDDA] text-[#0B4F56] rounded-lg transition-colors disabled:opacity-50"
              >
                📋 Ver menú completo
              </button>
              <button
                onClick={() => void sendMessage('Quiero hacer una reservación.')}
                disabled={isLoading}
                className="px-3 py-2 text-xs font-bold bg-[#DCE8E5] hover:bg-[#C9DDDA] text-[#0B4F56] rounded-lg transition-colors disabled:opacity-50"
              >
                📅 Hacer reservación
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SommelierTextModal;
