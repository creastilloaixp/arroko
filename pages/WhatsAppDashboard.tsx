import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import type { Database } from '../supabase';
import { SpinnerIcon, WhatsAppIcon, UserCircleIcon, XCircleIcon, ClockIcon, UsersIcon, WrenchScrewdriverIcon, ChartBarIcon } from '../components/Icons';
import WhatsAppHealthCheck from '../components/WhatsAppHealthCheck';
import WhatsAppMetrics from '../components/WhatsAppMetrics';
import N8NAgentManager from '../components/N8NAgentManager';
import { WhatsAppConversations } from '../components/WhatsAppConversations';
import AnalyticsOrb from '../components/AnalyticsOrb';
import AnalyticsChatModal from '../components/AnalyticsChatModal';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';

type Message = Database['public']['Tables']['whatsapp_messages']['Row'];
type Reservation = Database['public']['Tables']['reservations']['Row'];
type Settings = Database['public']['Tables']['restaurant_settings']['Row'];

// --- Constants ---
// A fixed UUID for the single row of restaurant settings.
const RESTAURANT_SETTINGS_ID = '7f5b2b1b-0e4d-4d1b-a5fa-2a1f6e2f7c3a';

// --- Error Display Component ---
const DataError: React.FC<{ message: string }> = ({ message }) => (
    <div className="bg-red-900/30 p-4 rounded-lg border border-red-700 text-left">
        <div className="flex items-center gap-3">
            <XCircleIcon className="h-8 w-8 text-red-400 flex-shrink-0" />
            <div>
                <h4 className="font-bold text-red-300 text-md mb-1">Error al Cargar Datos</h4>
                <p className="text-red-300 text-sm font-mono whitespace-pre-wrap">
                    {message}
                    {message.includes('security policies') &&
                     "\n\nSugerencia: Este error usualmente indica un problema con la Seguridad a Nivel de Fila (RLS) en Supabase. Asegúrate de que la tabla tenga políticas (Policies) que permitan la operación de LECTURA (SELECT) para el rol 'anon'."
                    }
                </p>
            </div>
        </div>
    </div>
);


// --- Conversations Tab ---
const ConversationsLog: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchMessages = async () => {
            const { data, error } = await supabase!
                .from('whatsapp_messages')
                .select('*')
                .order('created_at', { ascending: true })
                .limit(100);

            if (error) {
                setError(error.message);
            } else if (data) {
                setMessages(data);
                setFilteredMessages(data); // Initialize filtered messages
            }
            setIsLoading(false);
        };

        fetchMessages();

        const channel = supabase!
            .channel('whatsapp_messages_changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
                setMessages(currentMessages => [...currentMessages, payload.new as Message]);
            })
            .subscribe();

        return () => {
            supabase!.removeChannel(channel);
        };
    }, []);

    // Search functionality
    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredMessages(messages);
        } else {
            const term = searchTerm.toLowerCase();
            const filtered = messages.filter(msg =>
                msg.message_content?.toLowerCase().includes(term) ||
                msg.sender_name?.toLowerCase().includes(term) ||
                msg.phone_number?.includes(term)
            );
            setFilteredMessages(filtered);
        }
    }, [searchTerm, messages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (isLoading) return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-40" />
                <div className="flex items-center gap-4">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-9 w-48" />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-card p-4 rounded-lg border border-border space-y-3">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-40" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-border">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
    if (error) return <DataError message={error} />;

    return (
        <div className="bg-card p-4 rounded-lg border border-border h-[70vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Conversaciones Recientes</h3>
                <div className="relative w-64">
                    <Input
                        type="text"
                        placeholder="Buscar mensajes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                    <div className="absolute left-3 top-2.5 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                    </div>
                </div>
            </div>
            <div className="flex-grow overflow-y-auto pr-4 space-y-4">
                {filteredMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        {searchTerm ? (
                            <p>No se encontraron mensajes que coincidan con "{searchTerm}"</p>
                        ) : (
                            <p>Aún no hay mensajes. ¡Envía un mensaje a tu número de WhatsApp para empezar!</p>
                        )}
                    </div>
                ) : (
                    filteredMessages.map(msg => (
                        <div key={msg.id} className={`flex items-end gap-3 ${msg.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                            {msg.sender === 'user' && <UserCircleIcon className="h-8 w-8 text-gray-400 flex-shrink-0" />}
                            <div className={`max-w-lg p-3 rounded-2xl ${msg.sender === 'user' ? 'bg-gray-700 text-white rounded-bl-none' : 'bg-green-600 text-white rounded-br-none'}`}>
                                <p className="text-xs text-gray-300 font-bold">{msg.sender_name || msg.phone_number}</p>
                                <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{msg.message_content}</p>
                                <p className="text-xs text-right mt-1 opacity-60">{new Date(msg.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            {msg.sender === 'agent' && <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"><WhatsAppIcon className="h-5 w-5 text-white" /></div>}
                        </div>
                    ))
                )}
                 <div ref={messagesEndRef} />
            </div>
        </div>
    );
};

// --- Reservations Tab ---
const ReservationsManager: React.FC = () => {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchReservations = async () => {
             const { data, error } = await supabase!
                .from('reservations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) setError(error.message);
            else if (data) setReservations(data);
            setIsLoading(false);
        };

        fetchReservations();

         const channel = supabase!
            .channel('reservations_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
                fetchReservations(); // Refetch all on any change
            })
            .subscribe();

        return () => {
            supabase!.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        let filtered = reservations;

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(reservation =>
                reservation.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                reservation.phone_number?.includes(searchTerm) ||
                reservation.notes?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filter by status
        if (statusFilter !== 'all') {
            filtered = filtered.filter(reservation => reservation.status === statusFilter);
        }

        setFilteredReservations(filtered);
    }, [reservations, searchTerm, statusFilter]);

    const statusStyles: { [key in Reservation['status']]: string } = {
        pending: 'bg-yellow-900 text-yellow-300',
        confirmed: 'bg-green-900 text-green-300',
        cancelled: 'bg-red-900 text-red-300',
    };

    if (isLoading) return <div className="flex justify-center items-center h-96"><SpinnerIcon className="h-10 w-10" /></div>;
    if (error) return <DataError message={error} />;

    const updateReservationStatus = async (id: string, newStatus: 'pending' | 'confirmed' | 'cancelled') => {
        try {
            const { error } = await supabase!
                .from('reservations')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
        } catch (err) {
            console.error('Error updating reservation:', err);
            alert('Error al actualizar la reservación');
        }
    };

    return (
        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 h-[70vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-foreground">Reservaciones Agendadas</h3>
                <div className="flex items-center gap-4">
                    {/* Search Bar */}
                    <div className="relative w-64">
                        <Input
                            type="text"
                            placeholder="Buscar reservaciones..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                        <div className="absolute left-3 top-2.5 text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                        </div>
                    </div>

                    {/* Status Filter */}
                    <Select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="w-[12rem]"
                    >
                        <option value="all">Todas</option>
                        <option value="pending">Pendientes</option>
                        <option value="confirmed">Confirmadas</option>
                        <option value="cancelled">Canceladas</option>
                    </Select>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto pr-4 space-y-4">
                {filteredReservations.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <p>{searchTerm || statusFilter !== 'all' ? 'No se encontraron reservaciones.' : 'No hay reservaciones agendadas todavía.'}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredReservations.map(res => (
                            <div key={res.id} className="bg-card p-4 rounded-lg border border-border space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-lg text-foreground">{res.customer_name || 'Cliente anónimo'}</p>
                                        <p className="text-sm text-muted-foreground">{res.phone_number}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusStyles[res.status]}`}>{res.status}</span>
                                </div>
                                <div className="text-sm text-foreground/80 space-y-1">
                                    <p className="flex items-center gap-2"><ClockIcon className="h-4 w-4"/> {res.reservation_time ? new Date(res.reservation_time).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short'}) : 'Fecha no definida'}</p>
                                    <p className="flex items-center gap-2"><UsersIcon className="h-4 w-4"/> {res.party_size || '?'} personas</p>
                                </div>
                                {res.notes && <p className="text-xs pt-2 border-t border-border text-muted-foreground italic">Nota: {res.notes}</p>}

                                {/* Action Buttons */}
                                <div className="flex gap-2 pt-2 border-t border-border">
                                    {res.status === 'pending' && (
                                        <>
                                            <Button
                                                onClick={() => updateReservationStatus(res.id, 'confirmed')}
                                                className="flex-1 h-8 text-xs"
                                                variant="default"
                                            >
                                                Confirmar
                                            </Button>
                                            <Button
                                                onClick={() => updateReservationStatus(res.id, 'cancelled')}
                                                className="flex-1 h-8 text-xs"
                                                variant="destructive"
                                            >
                                                Cancelar
                                            </Button>
                                        </>
                                    )}
                                    {res.status === 'confirmed' && (
                                        <Button
                                            onClick={() => updateReservationStatus(res.id, 'cancelled')}
                                            className="flex-1 h-8 text-xs"
                                            variant="destructive"
                                        >
                                            Cancelar
                                        </Button>
                                    )}
                                    {res.status === 'cancelled' && (
                                        <Button
                                            onClick={() => updateReservationStatus(res.id, 'pending')}
                                            className="flex-1 h-8 text-xs"
                                            variant="secondary"
                                        >
                                            Reabrir
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// --- Settings Tab ---
const SettingsManager: React.FC<{ settings: Partial<Settings>, onSave: () => Promise<void> }> = ({ settings: initialSettings, onSave }) => {
    const [settings, setSettings] = useState<Partial<Settings>>(initialSettings);
    const [isSaving, setIsSaving] = useState(false);
    const [feedback, setFeedback] = useState<{type: 'success' | 'error' | 'warning', message: string, details?: string, code?: string} | null>(null);

     useEffect(() => {
        setSettings(initialSettings);
    }, [initialSettings]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setFeedback(null);
        const publicSettings = {
            id: RESTAURANT_SETTINGS_ID,
            restaurant_name: settings.restaurant_name || 'Arrokó',
            restaurant_address: settings.restaurant_address || null,
            restaurant_phone: settings.restaurant_phone || null,
            restaurant_email: settings.restaurant_email || null,
            opening_hours: settings.opening_hours || null,
            menu_highlights: settings.menu_highlights || null,
            about_restaurant: settings.about_restaurant || null,
        };
        const { error } = await supabase!.from('restaurant_settings').upsert(publicSettings);
        if (error) {
            setFeedback({ type: 'error', message: `Error al guardar: ${error.message}` });
            setIsSaving(false);
            return;
        }

        await onSave();
        setFeedback({ type: 'success', message: 'Información pública guardada con éxito.' });

        setIsSaving(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({...prev, [name]: name === 'menu_highlights' ? value.split(',').map(s => s.trim()) : value }));
    };

    const getFeedbackStyles = () => {
        if (!feedback) return '';
        switch (feedback.type) {
            case 'success': return 'bg-green-900/40 border border-green-700 text-green-300';
            case 'error': return 'bg-red-900/40 border border-red-700 text-red-300';
            case 'warning': return 'bg-yellow-900/40 border border-yellow-700 text-yellow-300';
            default: return '';
        }
    }


    return (
        <form onSubmit={handleSave} className="bg-card p-6 rounded-lg border border-border space-y-4">
             <h3 className="text-xl font-bold text-foreground mb-4">Ajustes del Asistente IA</h3>
             <p className="text-sm text-muted-foreground -mt-4 mb-4">Esta información será usada por el asistente de IA para responder preguntas sobre tu restaurante.</p>
             <div>
                <label className="block text-sm font-medium text-muted-foreground">Nombre del Restaurante</label>
                <Input type="text" name="restaurant_name" value={settings.restaurant_name || ''} onChange={handleChange} />
             </div>
             <div>
                <label className="block text-sm font-medium text-muted-foreground">Dirección</label>
                <Input type="text" name="restaurant_address" value={settings.restaurant_address || ''} onChange={handleChange} />
             </div>
             <div>
                <label className="block text-sm font-medium text-muted-foreground">Horarios (ej. L-V: 1pm-10pm)</label>
                <Textarea name="opening_hours" value={settings.opening_hours || ''} onChange={handleChange} rows={3} />
             </div>
             <div>
                <label className="block text-sm font-medium text-muted-foreground">Platillos Destacados (separados por comas)</label>
                <Textarea name="menu_highlights" value={(settings.menu_highlights || []).join(', ')} onChange={handleChange} rows={3} />
             </div>
             <div className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Las credenciales de Evolution API se configuran exclusivamente como secretos del servidor; esta página no puede leerlas ni modificarlas.
             </div>
             <div className="flex items-start gap-4 pt-2">
                <Button type="submit" disabled={isSaving} className="font-bold px-6 flex-shrink-0 mt-1">
                    {isSaving ? <SpinnerIcon className="h-5 w-5" /> : 'Guardar'}
                </Button>
                <div className="w-full">
                    {feedback && (
                        <div className={`text-sm p-3 rounded-md ${getFeedbackStyles()}`}>
                            <p className="font-bold">{feedback.message}</p>
                            {feedback.details && <p className="mt-1 text-xs">{feedback.details}</p>}
                            {feedback.code && (
                                <pre className="bg-black/50 p-2 rounded-md mt-2 text-yellow-300 font-mono text-xs whitespace-pre-wrap">
                                    {feedback.code}
                                </pre>
                            )}
                        </div>
                    )}
                </div>
             </div>
        </form>
    );
};


// --- Main Dashboard Component ---
const WhatsAppDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'conversations' | 'reservations' | 'settings' | 'diagnostics' | 'metrics' | 'n8n-agent'>('diagnostics');
    const [settings, setSettings] = useState<Partial<Settings>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAnalyticsChatOpen, setIsAnalyticsChatOpen] = useState(false);

    const fetchSettings = async () => {
        // Fetch the single row of settings using the fixed UUID.
        const { data, error } = await supabase!
            .from('restaurant_settings')
            .select('id, restaurant_name, restaurant_address, restaurant_phone, restaurant_email, opening_hours, menu_highlights, about_restaurant, updated_at')
            .eq('id', RESTAURANT_SETTINGS_ID)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116: "exact one row not found" is ok if table is empty
             setError(error.message);
        } else if (data) {
            setSettings(data);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const renderContent = () => {
        if (isLoading) return <div className="flex justify-center p-8"><SpinnerIcon className="h-10 w-10" /></div>;
        if (error) return <DataError message={error} />;

        switch (activeTab) {
            case 'conversations': return <WhatsAppConversations />;
            case 'reservations': return <ReservationsManager />;
            case 'settings': return <SettingsManager settings={settings} onSave={fetchSettings} />;
            case 'diagnostics': return <WhatsAppHealthCheck settings={settings} />;
            case 'metrics': return <WhatsAppMetrics />;
            case 'n8n-agent': return <N8NAgentManager />;
            default: return null;
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            <h2 className="text-4xl font-black text-foreground tracking-wide mb-8">WhatsApp Dashboard</h2>
            <div className="border-b border-border mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <Button
                        onClick={() => setActiveTab('diagnostics')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'diagnostics' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        variant="ghost"
                        size="sm"
                        aria-current={activeTab === 'diagnostics' ? 'page' : undefined}
                    >
                        Diagnóstico y Configuración
                    </Button>
                    <Button
                        onClick={() => setActiveTab('metrics')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'metrics' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        variant="ghost"
                        size="sm"
                        aria-current={activeTab === 'metrics' ? 'page' : undefined}
                    >
                        Métricas
                    </Button>
                    <Button
                        onClick={() => setActiveTab('conversations')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'conversations' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        variant="ghost"
                        size="sm"
                        aria-current={activeTab === 'conversations' ? 'page' : undefined}
                    >
                        Conversaciones
                    </Button>
                    <Button
                        onClick={() => setActiveTab('reservations')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'reservations' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        variant="ghost"
                        size="sm"
                        aria-current={activeTab === 'reservations' ? 'page' : undefined}
                    >
                        Reservaciones
                    </Button>
                    <Button
                        onClick={() => setActiveTab('settings')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        variant="ghost"
                        size="sm"
                        aria-current={activeTab === 'settings' ? 'page' : undefined}
                    >
                        Ajustes
                    </Button>
                    <Button
                        onClick={() => setActiveTab('n8n-agent')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'n8n-agent' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        variant="ghost"
                        size="sm"
                        aria-current={activeTab === 'n8n-agent' ? 'page' : undefined}
                    >
                        Agente n8n
                    </Button>
                </nav>
            </div>
            <div>
                {renderContent()}
            </div>
            <AnalyticsOrb onClick={() => setIsAnalyticsChatOpen(true)} />
            {isAnalyticsChatOpen && (
                <AnalyticsChatModal onClose={() => setIsAnalyticsChatOpen(false)} adminId={null} />
            )}
        </div>
    );
};

export default WhatsAppDashboard;
