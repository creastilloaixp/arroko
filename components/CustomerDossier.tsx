import React, { useState, useMemo, useEffect } from 'react';
import type { Participant, SpinResult } from '../types';
import { supabase } from '../supabase';
import {
    SpinnerIcon,
    UserCircleIcon,
    ClockIcon,
    ChatBubbleOvalLeftEllipsisIcon,
    GiftIcon,
    CheckBadgeIcon,
    XCircleIcon,
    MicrophoneIcon
} from './Icons';

type Interaction = {
  id: string;
  created_at: string;
  event_type: string;
  metadata: any;
};

const EventTimelineItem: React.FC<{ event: Interaction }> = ({ event }) => {
    const getEventDetails = () => {
        const { event_type, metadata } = event;
        switch (event_type) {
            case 'navigation':
                return { icon: <ClockIcon className="h-5 w-5 text-gray-400"/>, text: `Navegó de ${metadata?.from || '?'} a ${metadata?.to || '?'}`};
            case 'registration_success':
                return { icon: <UserCircleIcon className="h-5 w-5 text-green-400"/>, text: "Se registró exitosamente en la aplicación." };
            case 'spin_button_click':
                return { icon: <GiftIcon className="h-5 w-5 text-blue-400"/>, text: "Hizo clic para girar la ruleta." };
            case 'spin_result':
                return { icon: <GiftIcon className="h-5 w-5 text-yellow-400"/>, text: `Ganó un premio: ${metadata?.prize_name || 'Desconocido'}`};
            case 'redeem_success':
                return { icon: <CheckBadgeIcon className="h-5 w-5 text-green-400"/>, text: `Canjeó el premio ${metadata?.prize_id || ''} con éxito.` };
            case 'redeem_failure':
                return { icon: <XCircleIcon className="h-5 w-5 text-red-400"/>, text: `Falló al canjear un premio. Razón: ${metadata?.reason || 'desconocida'}`};
            case 'sommelier_text_open':
                return { icon: <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5 text-purple-400"/>, text: "Abrió el chat de texto con Sommelier'IA." };
            case 'sommelier_voice_open':
                 return { icon: <MicrophoneIcon className="h-5 w-5 text-purple-400"/>, text: "Inició una conversación de voz con Sommelier'IA." };
            case 'sommelier_text_message':
                return { icon: <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5 text-gray-400"/>, text: `Envió un mensaje: "${metadata?.message || ''}"`};
            case 'sommelier_voice_turn':
                return { icon: <MicrophoneIcon className="h-5 w-5 text-gray-400"/>, text: `Habló con Sommelier'IA.`};
            default:
                return { icon: <ClockIcon className="h-5 w-5 text-gray-500"/>, text: `Evento: ${event_type}` };
        }
    };

    const { icon, text } = getEventDetails();

    return (
        <li className="mb-6 ms-6">
            <span className="absolute flex items-center justify-center w-8 h-8 bg-gray-700 rounded-full -start-4 ring-4 ring-gray-800">
                {icon}
            </span>
            <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg shadow-sm">
                <div className="items-center justify-between mb-1 sm:flex">
                    <time className="mb-1 text-xs font-normal text-gray-400 sm:order-last sm:mb-0">{new Date(event.created_at).toLocaleString('es-MX')}</time>
                    <p className="text-sm font-normal text-gray-300">{text}</p>
                </div>
            </div>
        </li>
    );
};

const CustomerDossier: React.FC<{ allParticipants: Participant[], allSpins: SpinResult[] }> = ({ allParticipants, allSpins }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [isLoadingInteractions, setIsLoadingInteractions] = useState(false);

    useEffect(() => {
        if (selectedParticipant) {
            const fetchInteractions = async () => {
                setIsLoadingInteractions(true);
                const { data, error } = await supabase!
                    .from('user_interactions')
                    .select('*')
                    .eq('participant_id', selectedParticipant.id)
                    .order('created_at', { ascending: false });

                if (data) {
                    setInteractions(data);
                } else {
                    console.error("Error fetching interactions for participant:", error);
                }
                setIsLoadingInteractions(false);
            };
            fetchInteractions();
        }
    }, [selectedParticipant]);

    const filteredParticipants = useMemo(() => {
        return allParticipants
            .filter(p => p.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
            .map(p => {
                const participantSpins = allSpins.filter(s => s.participant.id === p.id);
                const redeemedCount = participantSpins.filter(s => s.redeemed).length;
                return { ...p, spinCount: participantSpins.length, redeemedCount };
            })
            .sort((a, b) => b.spinCount - a.spinCount);
    }, [allParticipants, allSpins, searchTerm]);

    const selectedParticipantSpins = useMemo(() => {
        if (!selectedParticipant) return [];
        return allSpins.filter(s => s.participant.id === selectedParticipant.id);
    }, [allSpins, selectedParticipant]);

    const renderDossier = () => {
        if (!selectedParticipant) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                    <UserCircleIcon className="h-24 w-24 mb-4" />
                    <h3 className="text-xl font-bold">Selecciona un cliente</h3>
                    <p>Elige un cliente de la lista para ver su expediente detallado.</p>
                </div>
            );
        }

        const totalSpins = selectedParticipantSpins.length;
        const totalRedeemed = selectedParticipantSpins.filter(s => s.redeemed).length;
        const redemptionRate = totalSpins > 0 ? ((totalRedeemed / totalSpins) * 100).toFixed(0) : 0;

        return (
            <div className="p-4 space-y-6">
                <div>
                    <h3 className="text-2xl font-bold text-white">{selectedParticipant.fullName}</h3>
                    <p className="text-sm text-gray-400">{selectedParticipant.instagram} | {selectedParticipant.phone}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     <div className="bg-gray-800 p-4 rounded-lg"><p className="text-sm text-gray-400">Giros Totales</p><p className="text-2xl font-bold">{totalSpins}</p></div>
                     <div className="bg-gray-800 p-4 rounded-lg"><p className="text-sm text-gray-400">Premios Canjeados</p><p className="text-2xl font-bold">{totalRedeemed}</p></div>
                     <div className="bg-gray-800 p-4 rounded-lg"><p className="text-sm text-gray-400">Tasa de Canje</p><p className="text-2xl font-bold">{redemptionRate}%</p></div>
                </div>

                <div>
                    <h4 className="font-bold text-lg mb-2">Historial de Premios</h4>
                     <div className="overflow-x-auto max-h-60">
                      <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-300 uppercase bg-gray-800 sticky top-0">
                          <tr><th scope="col" className="px-4 py-2">Premio</th><th scope="col" className="px-4 py-2">Fecha</th><th scope="col" className="px-4 py-2">Estado</th></tr>
                        </thead>
                        <tbody>
                          {selectedParticipantSpins.map(spin => (
                            <tr key={spin.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                              <td className="px-4 py-2">{spin.prize.icon} {spin.prize.name}</td>
                              <td className="px-4 py-2">{new Date(spin.timestamp).toLocaleDateString('es-MX')}</td>
                              <td className="px-4 py-2"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${spin.redeemed ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>{spin.redeemed ? 'Canjeado' : 'Pendiente'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                </div>

                <div>
                    <h4 className="font-bold text-lg mb-4">Línea de Tiempo de Actividad</h4>
                    {isLoadingInteractions ? (
                         <SpinnerIcon className="h-8 w-8 text-gray-400" />
                    ) : (
                        <ol className="relative border-s border-gray-700">
                            {interactions.map(event => <EventTimelineItem key={event.id} event={event} />)}
                        </ol>
                    )}
                </div>

            </div>
        );
    };

    return (
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 min-h-[600px] flex flex-col md:flex-row">
            {/* Participant List */}
            <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-gray-700 pb-4 md:pb-0 md:pr-4">
                <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-800 border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 mb-4"
                />
                <ul className="space-y-2 overflow-y-auto max-h-[550px]">
                    {filteredParticipants.map(p => (
                        <li key={p.id}>
                            <button
                                onClick={() => setSelectedParticipant(p)}
                                className={`w-full text-left p-3 rounded-md transition-colors ${selectedParticipant?.id === p.id ? 'bg-red-600/80 text-white' : 'hover:bg-gray-800'}`}
                            >
                                <p className="font-bold">{p.fullName}</p>
                                <p className="text-xs text-gray-400">{p.spinCount} giros | {p.redeemedCount} canjeados</p>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Dossier View */}
            <div className="w-full md:w-2/3 md:pl-4 pt-4 md:pt-0 overflow-y-auto max-h-[600px]">
                {renderDossier()}
            </div>
        </div>
    );
};

export default CustomerDossier;