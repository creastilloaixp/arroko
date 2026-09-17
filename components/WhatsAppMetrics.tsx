import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Database } from '../supabase';
import { ChartBarIcon, ChatBubbleLeftRightIcon, CalendarIcon, UsersIcon, ClockIcon, TrendingUpIcon } from './Icons';
import { Button } from './ui/button';

type Message = Database['public']['Tables']['whatsapp_conversations']['Row'];
type Reservation = Database['public']['Tables']['reservations']['Row'];

interface Metrics {
  totalMessages: number;
  totalReservations: number;
  messagesToday: number;
  messagesThisWeek: number;
  confirmedReservations: number;
  pendingReservations: number;
  cancelledReservations: number;
  averageMessagesPerDay: number;
  mostActiveHour: string;
  userMessagePercentage: number;
  agentMessagePercentage: number;
}

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  subtitle?: string;
}> = ({ title, value, icon, trend, subtitle }) => (
  <div className="bg-card p-6 rounded-lg border border-border transition-colors">
    <div className="flex items-center justify-between mb-4">
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-primary">{icon}</div>
    </div>
    <div className="text-sm text-muted-foreground">{title}</div>
    {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
    {trend !== undefined && (
      <div className={`flex items-center mt-2 text-xs ${trend >= 0 ? 'text-[--color-success]' : 'text-destructive'}`}>
        <TrendingUpIcon className={`h-3 w-3 mr-1 ${trend < 0 ? 'rotate-180' : ''}`} />
        {trend >= 0 ? '+' : ''}{trend}%
      </div>
    )}
  </div>
);

const WhatsAppMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Calculate date ranges
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const rangeStart = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

        // Fetch messages
        const { data: messages, error: messagesError } = await supabase!
          .from('whatsapp_conversations')
          .select('*')
          .gte('timestamp', rangeStart.toISOString());

        if (messagesError) throw messagesError;

        // Fetch reservations
        const { data: reservations, error: reservationsError } = await supabase!
          .from('reservations')
          .select('*')
          .gte('created_at', rangeStart.toISOString());

        if (reservationsError) throw reservationsError;

        // Calculate metrics
        const calculateMetrics = (messages: Message[], reservations: Reservation[]): Metrics => {
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

          // Messages metrics
          const messagesToday = messages.filter(m => new Date(m.timestamp) >= todayStart).length;
          const messagesThisWeek = messages.filter(m => new Date(m.timestamp) >= weekStart).length;
          const userMessages = messages.filter(m => m.sender_type === 'user').length;
          const agentMessages = messages.filter(m => m.sender_type === 'agent' || m.sender_type === 'assistant').length;

          // Reservations metrics
          const confirmedReservations = reservations.filter(r => r.status === 'confirmed').length;
          const pendingReservations = reservations.filter(r => r.status === 'pending').length;
          const cancelledReservations = reservations.filter(r => r.status === 'cancelled').length;

          // Most active hour
          const hourCounts: { [hour: number]: number } = {};
          messages.forEach(m => {
            const hour = new Date(m.timestamp).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          });
          const mostActiveHour = Number(
            Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 0
          );

          // Average messages per day
          const uniqueDays = new Set(messages.map(m =>
            new Date(m.timestamp).toDateString()
          )).size;
          const averageMessagesPerDay = uniqueDays > 0 ?
            Math.round(messages.length / uniqueDays) : 0;

          return {
            totalMessages: messages.length,
            totalReservations: reservations.length,
            messagesToday,
            messagesThisWeek,
            confirmedReservations,
            pendingReservations,
            cancelledReservations,
            averageMessagesPerDay,
            mostActiveHour: `${mostActiveHour}:00 - ${mostActiveHour + 1}:00`,
            userMessagePercentage: messages.length > 0 ?
              Math.round((userMessages / messages.length) * 100) : 0,
            agentMessagePercentage: messages.length > 0 ?
              Math.round((agentMessages / messages.length) * 100) : 0
          };
        };

        const calculatedMetrics = calculateMetrics(messages || [], reservations || []);
        setMetrics(calculatedMetrics);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar métricas');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();

    // Subscribe to real-time updates
    const messageChannel = supabase!
      .channel('whatsapp_messages_metrics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, () => {
        fetchMetrics();
      })
      .subscribe();

    const reservationChannel = supabase!
      .channel('reservations_metrics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        fetchMetrics();
      })
      .subscribe();

    return () => {
      supabase!.removeChannel(messageChannel);
      supabase!.removeChannel(reservationChannel);
    };
  }, [dateRange]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 rounded-md bg-muted animate-pulse" />
          <div className="flex gap-2">
            <div className="h-9 w-20 rounded-md bg-muted animate-pulse" />
            <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
            <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card p-6 rounded-lg border border-border">
              <div className="h-6 w-1/3 bg-muted animate-pulse rounded-md mb-4" />
              <div className="h-8 w-1/4 bg-muted animate-pulse rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 p-4 rounded-lg border border-red-700">
        <div className="flex items-center gap-3">
          <div className="text-red-400">⚠️</div>
          <div>
            <h4 className="font-bold text-red-300">Error al Cargar Métricas</h4>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-foreground">Métricas de WhatsApp</h3>
        <div className="flex gap-2">
          {[{value: '7d', label: '7 días'}, {value: '30d', label: '30 días'}, {value: '90d', label: '90 días'}].map(option => (
            <Button
              key={option.value}
              onClick={() => setDateRange(option.value as any)}
              variant={dateRange === option.value ? 'default' : 'outline'}
              size="sm"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Mensajes Totales"
          value={metrics.totalMessages}
          icon={<ChatBubbleLeftRightIcon className="h-6 w-6" />}
          subtitle={`${metrics.userMessagePercentage}% usuarios • ${metrics.agentMessagePercentage}% asistente`}
        />

        <MetricCard
          title="Mensajes Hoy"
          value={metrics.messagesToday}
          icon={<TrendingUpIcon className="h-6 w-6" />}
          trend={metrics.messagesToday > 0 ? 100 : 0}
        />

        <MetricCard
          title="Reservaciones"
          value={metrics.totalReservations}
          icon={<CalendarIcon className="h-6 w-6" />}
          subtitle={`${metrics.confirmedReservations} confirmadas`}
        />

        <MetricCard
          title="Promedio por Día"
          value={metrics.averageMessagesPerDay}
          icon={<ChartBarIcon className="h-6 w-6" />}
        />
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-lg border border-border">
          <h4 className="text-lg font-semibold text-foreground mb-4">Estado de Reservaciones</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Confirmadas</span>
              <span className="text-[--color-success] font-semibold">{metrics.confirmedReservations}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Pendientes</span>
              <span className="text-[--color-warning] font-semibold">{metrics.pendingReservations}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Canceladas</span>
              <span className="text-destructive font-semibold">{metrics.cancelledReservations}</span>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <h4 className="text-lg font-semibold text-foreground mb-4">Actividad</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Esta semana</span>
              <span className="text-foreground font-semibold">{metrics.messagesThisWeek}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Hora más activa</span>
              <span className="text-foreground font-semibold">{metrics.mostActiveHour}</span>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <h4 className="text-lg font-semibold text-foreground mb-4">Distribución</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Mensajes usuarios</span>
              <span className="text-primary font-semibold">{metrics.userMessagePercentage}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Respuestas asistente</span>
              <span className="text-[--color-success] font-semibold">{metrics.agentMessagePercentage}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-card p-6 rounded-lg border border-border">
        <h4 className="text-lg font-semibold text-foreground mb-4">💡 Insights</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-foreground/80">
          {metrics.totalMessages === 0 && (
            <div className="text-muted-foreground">
              No hay mensajes en el período seleccionado. ¡Empieza a promocionar tu WhatsApp!
            </div>
          )}
          {metrics.totalMessages > 0 && metrics.confirmedReservations === 0 && (
            <div className="text-[--color-warning]">
              📱 Tienes mensajes pero ninguna reservación confirmada. Revisa si el asistente está respondiendo correctamente.
            </div>
          )}
          {metrics.pendingReservations > metrics.confirmedReservations * 2 && (
            <div className="text-[--color-warning]">
              ⚠️ Tienes muchas reservaciones pendientes. Considera confirmarlas manualmente.
            </div>
          )}
          {metrics.messagesToday === 0 && metrics.totalMessages > 0 && (
            <div className="text-primary">
              💤 No has recibido mensajes hoy. Esto es normal dependiendo del día y hora.
            </div>
          )}
          {metrics.userMessagePercentage < 30 && metrics.totalMessages > 10 && (
            <div className="text-[--color-success]">
              🤖 Tu asistente está siendo muy activo. ¡Buen trabajo!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppMetrics;
