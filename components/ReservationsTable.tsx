import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select } from './ui/select';
import { Input } from './ui/input';
import { ChevronDownIcon, ChevronUpIcon } from './Icons';

interface Reservation {
  id: string;
  created_at: string;
  reservation_time: string | null;
  party_size: number | null;
  customer_name: string | null;
  phone_number: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  notes: string | null;
  source: 'text' | 'voice' | 'whatsapp';
}

const statusColors = {
  pending: 'bg-[color-mix(in_oklab,var(--color-warning),black_85%)] text-[color-mix(in_oklab,var(--color-warning),white_25%)]',
  confirmed: 'bg-[color-mix(in_oklab,var(--color-success),black_85%)] text-[color-mix(in_oklab,var(--color-success),white_25%)]',
  cancelled: 'bg-[color-mix(in_oklab,var(--color-destructive),black_85%)] text-[color-mix(in_oklab,var(--color-destructive),white_25%)]',
};

const sourceColors = {
  text: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
  voice: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
  whatsapp: 'bg-green-500/20 text-green-300 border-green-500/50',
};

const sourceLabels = {
  text: '💬 Texto',
  voice: '🎙️ Voz',
  whatsapp: '📱 WhatsApp',
};

export const ReservationsTable: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  // Filters
  const [sourceFilter, setSourceFilter] = useState<'all' | 'text' | 'voice' | 'whatsapp'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  // Pagination
  const [page, setPage] = useState(0);
  const [limit] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  const fetchReservations = async () => {
    try {
      let query = supabase
        .from('reservations')
        .select('*', { count: 'exact' })
        .order('reservation_time', { ascending: false });

      // Apply filters
      if (sourceFilter !== 'all') {
        query = query.eq('source', sourceFilter);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (dateRange.start) {
        query = query.gte('reservation_time', new Date(dateRange.start).toISOString());
      }
      if (dateRange.end) {
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
        query = query.lte('reservation_time', end.toISOString());
      }

      // Pagination
      query = query.range(page * limit, page * limit + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      setReservations(data || []);
      setTotalCount(count || 0);
      setError(null);
    } catch (err: any) {
      setError('No se pudieron cargar las reservaciones. Verifica los permisos de RLS.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();

    // Real-time subscription
    const channel = supabase
      .channel('reservations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        (payload) => {
          console.log('🔔 Real-time update:', payload);
          fetchReservations(); // Refresh on any change
        }
      )
      .subscribe();

    // Auto-refresh fallback every 30 seconds
    const interval = setInterval(fetchReservations, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [sourceFilter, statusFilter, dateRange, page]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (loading) {
    return <div className="text-center p-4 text-muted-foreground">Cargando reservaciones...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-destructive">{error}</div>;
  }

  return (
    <div className="p-4 bg-card border border-border rounded-lg mt-6">
      <h2 className="text-xl font-bold mb-4 text-foreground">Centro de Comando - Reservaciones</h2>
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as any)}>
          <option value="all">Todas las fuentes</option>
          <option value="text">💬 Texto</option>
          <option value="voice">🎙️ Voz</option>
          <option value="whatsapp">📱 WhatsApp</option>
        </Select>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
          <option value="all">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="confirmed">Confirmada</option>
          <option value="cancelled">Cancelada</option>
        </Select>
        <Input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} placeholder="Fecha inicio" />
        <Input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} placeholder="Fecha fin" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-muted-foreground">
          <thead className="text-xs text-muted-foreground uppercase bg-muted">
            <tr>
              <th className="px-6 py-3">Cliente</th>
              <th className="px-6 py-3">Fecha Reserva</th>
              <th className="px-6 py-3">Personas</th>
              <th className="px-6 py-3">Teléfono</th>
              <th className="px-6 py-3">Fuente</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((res) => (
              <React.Fragment key={res.id}>
                <tr className="border-b border-border hover:bg-accent">
                  <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">{res.customer_name || '—'}</td>
                  <td className="px-6 py-4">{res.reservation_time ? new Date(res.reservation_time).toLocaleString('es-MX') : '—'}</td>
                  <td className="px-6 py-4">{res.party_size ?? '2 (est.)'}</td>
                  <td className="px-6 py-4">{res.phone_number || <span className="text-muted-foreground italic">No registrado</span>}</td>
                  <td className="px-6 py-4">
                    <Badge className={`${sourceColors[res.source]} border`}>
                      {sourceLabels[res.source]}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={`${statusColors[res.status]}`}>{res.status}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    {res.notes && (
                      <Button
                        onClick={() => toggleRow(res.id)}
                        variant="ghost"
                        size="sm"
                        className="p-1"
                      >
                        {expandedRows.has(res.id) ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                      </Button>
                    )}
                  </td>
                </tr>
                {expandedRows.has(res.id) && res.notes && (
                  <tr className="bg-muted/50">
                    <td colSpan={7} className="px-6 py-3">
                      <div className="text-sm">
                        <span className="font-semibold text-foreground">Notas:</span>
                        <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{res.notes}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-muted-foreground">
          Mostrando {reservations.length} de {totalCount} reservaciones
        </span>
        <div className="flex gap-2">
          <Button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} variant="outline" size="sm">
            Anterior
          </Button>
          <span className="text-muted-foreground text-sm flex items-center">Página {page + 1}</span>
          <Button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= totalCount} variant="outline" size="sm">
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
};