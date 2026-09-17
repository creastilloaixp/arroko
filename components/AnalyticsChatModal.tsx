import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PaperAirplaneIcon, SparklesIcon, SpinnerIcon, ChartBarIcon } from './Icons';
import { askAnalyticsGemini, getAutomatedInsights, generateExecutiveSummary } from '../lib/analyticsGemini';
import { useAnalytics } from '../lib/useAnalytics';
import type { AnalyticsContext } from '../lib/analyticsGemini';
import { supabase } from '../supabase';
import type { Database } from '../supabase';

type Message = {
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp?: Date;
};

interface AnalyticsChatModalProps {
  onClose: () => void;
  adminId?: string | null;
}

const AnalyticsChatModal: React.FC<AnalyticsChatModalProps> = ({ onClose, adminId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  type Reservation = Database['public']['Tables']['reservations']['Row'];
  const [pendingAction, setPendingAction] = useState<{ target: Reservation; newStatus: 'confirmed' | 'cancelled' | 'pending' } | null>(null);
  const [lastReservations, setLastReservations] = useState<Reservation[]>([]);
  const [loadingLast, setLoadingLast] = useState(false);

  const {
    metrics,
    getUserJourneys,
    getTopPrizes,
    getTimeSeriesData,
    getConversionFunnel,
    isLoading: metricsLoading
  } = useAnalytics();

  useEffect(() => {
    // Initial AI message
    const initializeChat = async () => {
      if (!metrics) return;

      const summary = generateExecutiveSummary({
        totalParticipants: metrics.totalParticipants,
        totalSpins: metrics.totalSpins,
        totalRedemptions: metrics.totalRedemptions,
        conversionRate: metrics.conversionRate,
      });

      const insights = await getAutomatedInsights({
        totalParticipants: metrics.totalParticipants,
        totalSpins: metrics.totalSpins,
        totalRedemptions: metrics.totalRedemptions,
        conversionRate: metrics.conversionRate,
      });

      setMessages([
        {
          role: 'system',
          text: '👋 ¡Hola! Soy tu asistente de Analytics AI. Estoy aquí para ayudarte a entender tus datos y optimizar tu negocio.',
          timestamp: new Date(),
        },
        {
          role: 'model',
          text: summary,
          timestamp: new Date(),
        },
        ...(insights.length > 0 ? [{
          role: 'model' as const,
          text: `💡 **Insights Automáticos:**\n\n${insights.join('\n\n')}`,
          timestamp: new Date(),
        }] : []),
      ]);
    };

    if (metrics && !metricsLoading) {
      initializeChat();
    }
  }, [metrics, metricsLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const refreshLastReservations = async () => {
    if (!supabase) return;
    setLoadingLast(true);
    const { data } = await supabase.from('reservations').select('*').order('created_at', { ascending: false }).limit(3);
    setLastReservations(Array.isArray(data) ? (data as Reservation[]) : []);
    setLoadingLast(false);
  };

  useEffect(() => {
    refreshLastReservations();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !metrics) return;

    const userMessage: Message = {
      role: 'user',
      text: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowQuickActions(false);

    try {
      const handled = await handleReservationAction(input);
      if (handled) {
        setIsLoading(false);
        return;
      }
      // Gather full analytics context
      const [topPrizes, timeSeriesData, conversionFunnel, recentParticipants] = await Promise.all([
        getTopPrizes(),
        getTimeSeriesData(30),
        getConversionFunnel(),
        getUserJourneys(20),
      ]);

      const context: AnalyticsContext = {
        totalParticipants: metrics.totalParticipants,
        totalSpins: metrics.totalSpins,
        totalRedemptions: metrics.totalRedemptions,
        conversionRate: metrics.conversionRate,
        topPrizes,
        timeSeriesData,
        conversionFunnel,
        recentParticipants,
      };

      const historyForApi = messages
        .filter((m): m is Message & { role: 'user' | 'model' } => m.role !== 'system')
        .map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
        }));

      const aiResponse = await askAnalyticsGemini(historyForApi, input, context, adminId);

      setMessages(prev => [...prev, {
        role: 'model',
        text: aiResponse,
        timestamp: new Date(),
      }]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: '🚨 Hubo un error al procesar tu consulta. Por favor intenta de nuevo.',
        timestamp: new Date(),
      }]);
    }

    setIsLoading(false);
  };

  const handleReservationAction = async (text: string) => {
    const t = text.toLowerCase();
    let newStatus: 'confirmed' | 'cancelled' | 'pending' | null = null;
    if (t.includes('confirmar') || t.includes('confirma')) newStatus = 'confirmed';
    else if (t.includes('cancelar') || t.includes('cancela')) newStatus = 'cancelled';
    else if (t.includes('reabrir') || t.includes('reabre') || t.includes('pendiente')) newStatus = 'pending';
    if (!newStatus || !supabase) return false;

    const idMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const phoneMatch = text.match(/\+?\d{6,}/);
    const nameMatch = text.match(/(?:de|para)\s([A-Za-zÁÉÍÓÚÑáéíóúñ ]{3,})/i);
    const sourceWhatsApp = /whatsapp/i.test(text);

    let target: Reservation | null = null;

    if (idMatch) {
      let q = supabase.from('reservations').select('*').eq('id', idMatch[0]).limit(1);
      const { data } = await q;
      target = Array.isArray(data) && data.length > 0 ? (data[0] as Reservation) : null;
    } else if (phoneMatch) {
      const digits = phoneMatch[0];
      let q = supabase.from('reservations').select('*').ilike('phone_number', `%${digits}%`).order('created_at', { ascending: false }).limit(1);
      if (sourceWhatsApp) q = q.eq('source', 'whatsapp');
      const { data } = await q;
      target = Array.isArray(data) && data.length > 0 ? (data[0] as Reservation) : null;
    } else if (t.includes('última')) {
      let q = supabase.from('reservations').select('*').order('created_at', { ascending: false }).limit(1);
      if (sourceWhatsApp) q = q.eq('source', 'whatsapp');
      const { data } = await q;
      target = Array.isArray(data) && data.length > 0 ? (data[0] as Reservation) : null;
    } else if (nameMatch) {
      const name = nameMatch[1].trim();
      let q = supabase.from('reservations').select('*').ilike('customer_name', `%${name}%`).order('created_at', { ascending: false }).limit(1);
      if (sourceWhatsApp) q = q.eq('source', 'whatsapp');
      const { data } = await q;
      target = Array.isArray(data) && data.length > 0 ? (data[0] as Reservation) : null;
    }

    if (!target) {
      setMessages(prev => [...prev, { role: 'model', text: 'No encontré una reservación que coincida con lo que pediste.', timestamp: new Date() }]);
      return true;
    }
    setPendingAction({ target, newStatus });
    setMessages(prev => [...prev, { role: 'model', text: `Encontré la reservación de ${target.customer_name || target.phone_number}. ¿Quieres cambiar su estado a '${newStatus}'?`, timestamp: new Date() }]);
    return true;
  };

  const confirmPending = async () => {
    if (!pendingAction || !supabase) return;
    const { target, newStatus } = pendingAction;
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
    if (adminError || !isAdmin) {
      setMessages(prev => [...prev, { role: 'model', text: 'No tienes permisos para actualizar reservaciones.', timestamp: new Date() }]);
      setPendingAction(null);
      return;
    }
    const { error } = await supabase.from('reservations').update({ status: newStatus }).eq('id', target.id);
    if (error) {
      setMessages(prev => [...prev, { role: 'model', text: 'Error de permisos al actualizar la reservación.', timestamp: new Date() }]);
      setPendingAction(null);
      return;
    }
    setMessages(prev => [...prev, { role: 'model', text: `Actualicé la reservación de ${target.customer_name || target.phone_number} a '${newStatus}'.`, timestamp: new Date() }]);
    setPendingAction(null);
    await refreshLastReservations();
  };

  const cancelPending = () => {
    setPendingAction(null);
    setMessages(prev => [...prev, { role: 'model', text: 'Cancelé la acción solicitada.', timestamp: new Date() }]);
  };

  const handleQuickAction = async (action: string) => {
    setInput(action);
    // Trigger submit
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    }, 100);
  };

  const quickActions = [
    "¿Cuál es mi tasa de conversión?",
    "¿Qué premios son más populares?",
    "Analiza el comportamiento de usuarios recientes",
    "Dame recomendaciones para mejorar",
    "¿Cuál es el mejor día para hacer promociones?",
    "Identifica patrones de abandono",
    "Confirmar última reservación de WhatsApp",
    "Cancelar última reservación de WhatsApp",
    "Reabrir última reservación cancelada",
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div
        className="w-full max-w-4xl h-[85vh] bg-gradient-to-br from-gray-900 via-gray-900 to-blue-900/20 border border-blue-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ animation: 'slideInUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-blue-500/30 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ChartBarIcon className="h-8 w-8 text-blue-400" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Analytics AI Assistant</h3>
              <p className="text-sm text-blue-300">Neuromarketing & Data Intelligence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {metricsLoading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <SpinnerIcon className="h-12 w-12 text-blue-400 mb-4" />
              <p className="text-gray-400">Cargando datos analíticos...</p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slideIn`}
                >
                  {msg.role !== 'user' && (
                    <div className="w-10 h-10 rounded-xl bg-[#0B4F56] flex items-center justify-center flex-shrink-0 shadow-lg">
                      {msg.role === 'system' ? '👋' : '🤖'}
                    </div>
                  )}
                  <div
                    className={`max-w-2xl p-4 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-[#F15B43] text-white rounded-br-none'
                        : msg.role === 'system'
                        ? 'bg-[#0B4F56]/30 border border-[#0B4F56]/50 text-gray-100 rounded-bl-none'
                        : 'bg-gray-800 text-gray-200 rounded-bl-none border border-gray-700'
                    } shadow-lg`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    {msg.timestamp && (
                      <p className="text-xs text-gray-400 mt-2">
                        {msg.timestamp.toLocaleTimeString('es-MX', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start animate-slideIn">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                    🤖
                  </div>
                  <div className="max-w-2xl p-4 rounded-2xl bg-gray-800 border border-gray-700 rounded-bl-none flex items-center gap-2">
                    <SpinnerIcon className="h-5 w-5 text-blue-400" />
                    <span className="text-sm text-gray-400">Analizando datos...</span>
                  </div>
                </div>
              )}

              {showQuickActions && messages.length <= 3 && (
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl border border-blue-500/20">
                  <p className="text-sm font-semibold text-blue-300 mb-3 flex items-center gap-2">
                    <SparklesIcon className="h-4 w-4" />
                    Consultas Rápidas
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {quickActions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuickAction(action)}
                        className="text-left p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg text-sm text-gray-300 hover:text-white transition-all border border-gray-700 hover:border-blue-500/50"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Form */}
        <div className="p-5 border-t border-blue-500/30 bg-gray-900/50">
          {pendingAction && (
            <div className="mb-3 p-3 rounded-lg bg-blue-900/20 border border-blue-700 text-sm text-blue-200 flex items-center justify-between">
              <span>{(pendingAction.target.customer_name || pendingAction.target.phone_number)} → {pendingAction.newStatus}</span>
              <div className="flex gap-2">
                <button onClick={confirmPending} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium">Confirmar</button>
                <button onClick={cancelPending} className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs font-medium">Cancelar</button>
              </div>
            </div>
          )}
          <div className="mb-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <p className="text-xs text-gray-400 mb-2">Últimas reservaciones</p>
            <div className="space-y-2">
              {loadingLast ? (
                <div className="h-6 bg-gray-700 rounded animate-pulse" />
              ) : lastReservations.length === 0 ? (
                <p className="text-xs text-gray-500">Sin reservaciones recientes</p>
              ) : (
                lastReservations.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-xs text-gray-300">
                    <span className="truncate max-w-[50%]">{r.customer_name || r.phone_number}</span>
                    <span className="text-gray-500">{r.status}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setPendingAction({ target: r, newStatus: 'confirmed' })} className="px-2 py-1 rounded bg-green-700 text-white">Confirmar</button>
                      <button onClick={() => setPendingAction({ target: r, newStatus: 'cancelled' })} className="px-2 py-1 rounded bg-red-700 text-white">Cancelar</button>
                      <button onClick={() => setPendingAction({ target: r, newStatus: 'pending' })} className="px-2 py-1 rounded bg-yellow-700 text-white">Reabrir</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta sobre tus datos, métricas, o pide recomendaciones..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-full px-5 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              disabled={isLoading || metricsLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || metricsLoading}
              className="w-12 h-12 flex-shrink-0 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white flex items-center justify-center transition-all shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Powered by Gemini AI • Datos en tiempo real de Supabase
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(11, 79, 86, 0.18);
          border-radius: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(241, 91, 67, 0.55);
          border-radius: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(241, 91, 67, 0.8);
        }
      `}</style>
    </div>
  );
};

export default AnalyticsChatModal;
