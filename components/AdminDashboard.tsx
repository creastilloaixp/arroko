import React, { useState, useEffect, useMemo } from 'react';
import type { SpinResult, Prize, Participant } from '../types';
import { UsersIcon, GiftIcon, CheckBadgeIcon, SpinnerIcon, XCircleIcon, ArrowDownTrayIcon, ArrowLeftOnRectangleIcon } from './Icons';
import { supabase } from '../supabase';
import { useApp } from '../context/AppContext';
import CustomerDossier from './CustomerDossier';
import { ReservationsTable } from './ReservationsTable';
import AnalyticsOrb from './AnalyticsOrb';
const AnalyticsChatModalLazy = React.lazy(() => import('./AnalyticsChatModal'));
import { apiCall } from '../lib/useApi';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { showToast } from './ui/toast';

// --- Custom Bar Chart Component ---
const CustomBarChart: React.FC<{ data: { name: string, ganado: number, canjeado: number }[] }> = ({ data }) => {
    console.log('CustomBarChart recibe datos:', data);
    console.log('Cantidad de premios en datos:', data.length);

    // Verificar valores individuales
    data.forEach((item, index) => {
        console.log(`Premio ${index}: ${item.name} - Ganado: ${item.ganado}, Canjeado: ${item.canjeado}`);
    });

    const maxValue = Math.max(...data.map(d => Math.max(d.ganado, d.canjeado)), 1);
    console.log('Valor máximo para escalar:', maxValue);

    return (
        <div className="w-full h-[400px] flex flex-col space-y-4 p-4">
            <div className="flex-grow h-full min-h-0 flex justify-around items-end space-x-2 border-l-2 border-b-2 border-gray-600 pb-2 pl-2">
                {data.map((item, index) => (
                    <div key={index} className="flex-1 h-full flex flex-col items-center group relative">
                        <div className="w-full h-full flex justify-center items-end">
                           <div
                                className="w-1/3 bg-blue-500 rounded-t-md transition-all duration-300 hover:bg-blue-400"
                                style={{ height: `${(item.ganado / maxValue) * 100}%` }}
                           ></div>
                           <div
                                className="w-1/3 bg-green-500 rounded-t-md transition-all duration-300 hover:bg-green-400"
                                style={{ height: `${(item.canjeado / maxValue) * 100}%` }}
                           ></div>
                           {/* DEBUG: Mostrar valores sobre las barras */}
                           <div className="absolute -top-8 text-xs text-white bg-black bg-opacity-50 px-1 rounded">
                               G:{item.ganado} C:{item.canjeado}
                           </div>
                        </div>
                        <span className="text-xs text-gray-400 mt-2 text-center transform -rotate-45 origin-center">{item.name}</span>
                        <div className="absolute bottom-full mb-2 w-32 bg-gray-800 text-white text-xs rounded py-1 px-2 text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <p className="font-bold">{item.name}</p>
                            <p>Ganado: {item.ganado}</p>
                            <p>Canjeado: {item.canjeado}</p>
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-center items-center space-x-4 text-sm text-gray-300">
                <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div><span>Ganado</span></div>
                <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-green-500 rounded-sm"></div><span>Canjeado</span></div>
            </div>
        </div>
    );
};

const AdminDashboard: React.FC<{ prizes: Prize[] }> = ({ prizes }) => {
  const { handleAdminLogout } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'reservations'>('overview');
  const [allSpins, setAllSpins] = useState<SpinResult[]>([]);
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isAnalyticsChatOpen, setIsAnalyticsChatOpen] = useState(false);
  const [compactTable, setCompactTable] = useState(false);
  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [totalSpins, setTotalSpins] = useState(0);

  // --- Filter State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'redeemed' | 'pending'>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      setDataError(null);
      try {
        let spinsQuery = supabase!
          .from('spins')
          .select('id, created_at, redeemed, prize_id, participant_id', { count: 'exact' })
          .order('created_at', { ascending: false });
        if (statusFilter === 'redeemed') {
          spinsQuery = spinsQuery.eq('redeemed', true);
        } else if (statusFilter === 'pending') {
          spinsQuery = spinsQuery.eq('redeemed', false);
        }
        if (dateRange.start) {
          spinsQuery = spinsQuery.gte('created_at', new Date(dateRange.start).toISOString());
        }
        if (dateRange.end) {
          const end = new Date(dateRange.end);
          end.setHours(23, 59, 59, 999);
          spinsQuery = spinsQuery.lte('created_at', end.toISOString());
        }
        if (searchTerm && searchTerm.trim() !== '') {
          const name = `%${searchTerm.trim()}%`;
          const participantsForSearch = await apiCall('participants_name_search', () =>
            supabase!.from('participants').select('id').ilike('full_name', name)
          );
          const ids = (participantsForSearch.data || []).map((p: any) => p.id);
          if (ids.length > 0) {
            spinsQuery = spinsQuery.in('participant_id', ids);
          } else {
            setAllSpins([]);
            setAllParticipants([]);
            setTotalSpins(0);
            setIsLoadingData(false);
            return;
          }
        }
        spinsQuery = spinsQuery.range(page * limit, page * limit + limit - 1);
        const spinsResp = await apiCall('spins_list', () => spinsQuery);
        if (spinsResp.error) throw spinsResp.error;
        const spinsData = spinsResp.data || [];
        setTotalSpins(spinsResp.count || 0);

        const participantIds = Array.from(new Set(spinsData.map((s: any) => s.participant_id).filter(Boolean)));
        let participantsData: any[] = [];
        if (participantIds.length > 0) {
          const participantsResp = await apiCall('participants_by_ids', () => supabase!.from('participants').select('id, full_name, email, phone, birth_date').in('id', participantIds));
          if (participantsResp.error) throw participantsResp.error;
          participantsData = participantsResp.data || [];
        }

        const participantsMap = new Map<string, Participant>(
          participantsData?.map((p: any) => [p.id, { id: p.id, fullName: p.full_name, instagram: p.email, phone: p.phone, birthDate: p.birth_date }]) || []
        );

        const formattedSpins: SpinResult[] = spinsData.map((spin: any) => ({
          id: spin.id,
          timestamp: new Date(spin.created_at),
          redeemed: spin.redeemed,
          prize: prizes.find(p => p.id === spin.prize_id) || prizes[0],
          participant: participantsMap.get(spin.participant_id) || { id: 'unknown', fullName: 'Participante Desconocido', instagram: '', phone: '', birthDate: '' },
        }));

        console.log('Datos crudos de Supabase (spinsData):', spinsData);
        console.log('Giros formateados (formattedSpins):', formattedSpins);
        console.log('Premios disponibles:', prizes);

        setAllSpins(formattedSpins);
        setAllParticipants((participantsData || []).map((p: any) => ({ id: p.id, fullName: p.full_name, instagram: p.email, phone: p.phone, birthDate: p.birth_date })));

      } catch (error: any) {
         let detailedMessage = `No se pudieron cargar los datos: ${error.message || 'Error desconocido.'}`;
         if (error.code === 'PGRST116' || String(error.message).includes('404')) {
             detailedMessage = "Error de Red (404 - No Encontrado).\nEsto usualmente indica un problema con la Seguridad a Nivel de Fila (RLS) en Supabase.\n\nVerifica que tus tablas tengan políticas (Policies) que permitan la operación de LECTURA (SELECT).";
         }
         setDataError(detailedMessage);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [prizes, page, limit, statusFilter, dateRange, searchTerm]);

  useEffect(() => {
    const loadFlags = async () => {
      try {
        const { data } = await supabase!
          .from('feature_flags')
          .select('enabled')
          .eq('key', 'table_compact')
          .single();
        setCompactTable(!!data?.enabled);
      } catch (e) {
        setCompactTable(false);
      }
    };
    loadFlags();
  }, []);
  const toggleCompactFlag = async () => {
    try {
      const { error } = await supabase!.from('feature_flags').upsert({ key: 'table_compact', enabled: !compactTable }, { onConflict: 'key' });
      if (error) throw error;
      setCompactTable(prev => !prev);
      showToast(!compactTable ? 'Tabla compacta activada' : 'Tabla compacta desactivada', 'success');
    } catch (e) {
      showToast('No se pudo actualizar la bandera', 'destructive');
    }
  };

  const filteredSpins = useMemo(() => {
    return allSpins.filter(spin => {
      const spinDate = spin.timestamp;
      const startDate = dateRange.start ? new Date(dateRange.start) : null;
      const endDate = dateRange.end ? new Date(dateRange.end) : null;
      if(startDate) startDate.setHours(0, 0, 0, 0);
      if(endDate) endDate.setHours(23, 59, 59, 999);

      const inDateRange = (!startDate || spinDate >= startDate) && (!endDate || spinDate <= endDate);
      const matchesSearch = searchTerm === '' || spin.participant.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'redeemed' && spin.redeemed) || (statusFilter === 'pending' && !spin.redeemed);

      return inDateRange && matchesSearch && matchesStatus;
    });
  }, [allSpins, searchTerm, statusFilter, dateRange]);

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => JSON.stringify(row[header])).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.href) {
      URL.revokeObjectURL(link.href);
    }
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSpins = () => {
    const dataToExport = filteredSpins.map(s => ({
        spin_id: s.id,
        participant_name: s.participant.fullName,
        participant_instagram: s.participant.instagram,
        prize_name: s.prize.name,
        timestamp: s.timestamp.toISOString(),
        redeemed: s.redeemed,
    }));
    exportToCSV(dataToExport, 'historial_giros.csv');
  };

  const handleExportParticipants = () => {
    exportToCSV(allParticipants.map(p => ({
        id: p.id,
        nombre_completo: p.fullName,
        instagram: p.instagram,
        telefono: p.phone,
        fecha_nacimiento: p.birthDate
    })), 'participantes.csv');
  };

  const renderOverview = () => {
      const totalSpins = filteredSpins.length;
      const totalRedeemed = filteredSpins.filter(s => s.redeemed).length;
      const uniqueParticipants = new Set(filteredSpins.map(s => s.participant.id).filter(id => id !== 'unknown')).size;
      const prizeDistributionData = prizes.map(prize => ({ name: prize.name, ganado: filteredSpins.filter(s => s.prize.id === prize.id).length, canjeado: filteredSpins.filter(s => s.prize.id === prize.id && s.redeemed).length }));

      // DEBUG: Ver datos del gráfico
      console.log('=== DEBUG GRÁFICO ===');
      console.log('Total giros:', totalSpins);
      console.log('Total canjeados:', totalRedeemed);
      console.log('Premios disponibles:', prizes.length);
      console.log('Datos del gráfico:', prizeDistributionData);
      console.log('Primer premio del gráfico:', prizeDistributionData[0]);
      console.log('Segundo premio del gráfico:', prizeDistributionData[1]);
      console.log('Valores de Ganado:', prizeDistributionData.map(d => d['Ganado']));
      console.log('Valores de Canjeado:', prizeDistributionData.map(d => d['Canjeado']));
      console.log('Primeros 5 giros filtrados:', filteredSpins.slice(0, 5));
      console.log('====================');

      return (
        <>
            <div className="bg-card p-6 rounded-lg border border-border mb-8">
                <h3 className="text-xl font-bold text-foreground mb-4">Filtros y Exportación</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <Input placeholder="Buscar por nombre..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                        <option value="all">Todos los estados</option>
                        <option value="redeemed">Canjeado</option>
                        <option value="pending">Pendiente</option>
                    </Select>
                    <Input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} />
                    <Input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} />
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <Button onClick={toggleCompactFlag} variant="outline" size="sm">
                    {compactTable ? 'Desactivar tabla compacta' : 'Activar tabla compacta'}
                  </Button>
                  <span className={`px-2 py-1 rounded-full text-xs ${compactTable ? 'bg-[color-mix(in_oklab,var(--color-success),black_85%)] text-[color-mix(in_oklab,var(--color-success),white_25%)]' : 'bg-muted text-muted-foreground'}`}>{compactTable ? 'Compacta' : 'Espaciada'}</span>
                </div>
                <div className="flex gap-4">
                    <Button onClick={() => { handleExportSpins(); showToast('Exportación de giros lista', 'success'); }} className="flex items-center gap-2" variant="secondary">
                        <ArrowDownTrayIcon className="h-5 w-5" />
                        <span>Exportar Giros (Filtrados)</span>
                    </Button>
                    <Button onClick={() => { handleExportParticipants(); showToast('Exportación de participantes lista', 'success'); }} className="flex items-center gap-2 bg-emerald-700 text-white hover:bg-emerald-800" variant="default">
                        <ArrowDownTrayIcon className="h-5 w-5" />
                        <span>Exportar Participantes</span>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-card p-6 rounded-lg border border-border flex items-center space-x-4"><GiftIcon className="h-10 w-10 text-primary" /><div><p className="text-muted-foreground text-sm">Giros Totales</p><p className="text-3xl font-bold text-foreground">{totalSpins}</p></div></div>
                <div className="bg-card p-6 rounded-lg border border-border flex items-center space-x-4"><UsersIcon className="h-10 w-10 text-primary" /><div><p className="text-muted-foreground text-sm">Participantes Únicos</p><p className="text-3xl font-bold text-foreground">{uniqueParticipants}</p></div></div>
                <div className="bg-card p-6 rounded-lg border border-border flex items-center space-x-4"><CheckBadgeIcon className="h-10 w-10 text-[--color-success]" /><div><p className="text-muted-foreground text-sm">Premios Canjeados</p><p className="text-3xl font-bold text-foreground">{totalRedeemed}</p></div></div>
            </div>

            <div className="bg-card p-6 rounded-lg border border-border mb-8">
                <h3 className="text-xl font-bold text-foreground mb-4">Distribución de Premios</h3>
                <CustomBarChart data={prizeDistributionData} />
            </div>

            <div className="bg-card p-6 rounded-lg border border-border">
                <h3 className="text-xl font-bold text-foreground mb-4">Últimos Giros (Filtrados)</h3>
                <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-muted-foreground">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted">
                    <tr><th scope="col" className="px-6 py-3">Participante</th><th scope="col" className="px-6 py-3">Premio</th><th scope="col" className="px-6 py-3">Fecha</th><th scope="col" className="px-6 py-3">Estado</th></tr>
                    </thead>
                    <tbody>
                    {filteredSpins.map(spin => (
                        <tr key={spin.id} className="border-b border-border hover:bg-accent">
                        <td className={`px-6 ${compactTable ? 'py-2' : 'py-4'} font-medium text-foreground whitespace-nowrap`}>{spin.participant.fullName}</td>
                        <td className={`px-6 ${compactTable ? 'py-2' : 'py-4'}`}>{spin.prize.icon} {spin.prize.name}</td>
                        <td className={`px-6 ${compactTable ? 'py-2' : 'py-4'}`}>{new Date(spin.timestamp).toLocaleString('es-MX')}</td>
                        <td className={`px-6 ${compactTable ? 'py-2' : 'py-4'}`}><span className={`px-2 py-1 rounded-full text-xs font-semibold ${spin.redeemed ? 'bg-[color-mix(in_oklab,var(--color-success),black_85%)] text-[color-mix(in_oklab,var(--color-success),white_25%)]' : 'bg-[color-mix(in_oklab,var(--color-warning),black_85%)] text-[color-mix(in_oklab,var(--color-warning),white_25%)]'}`}>{spin.redeemed ? 'Canjeado' : 'Pendiente'}</span></td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                <div className="flex items-center justify-end gap-3 mt-4">
                  <Button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} variant="outline" size="sm">Anterior</Button>
                  <span className="text-muted-foreground text-sm">Página {page + 1}</span>
                  <Button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= totalSpins} variant="outline" size="sm">Siguiente</Button>
                </div>
                </div>
            </div>
        </>
      );
  };

  if (isLoadingData) {
    return <div className="flex flex-col items-center justify-center h-96"><SpinnerIcon className="h-12 w-12 text-muted-foreground mb-4" /><p className="text-muted-foreground text-lg">Cargando datos del panel...</p></div>;
  }
  if (dataError) {
    return <div className="max-w-7xl mx-auto"><h2 className="text-4xl font-black text-white mb-8 tracking-wide">PANEL DE ADMINISTRACIÓN</h2><div className="bg-red-900/30 p-6 rounded-lg border border-red-700 text-left mb-6"><div className="flex items-center gap-4"><XCircleIcon className="h-12 w-12 text-red-400 flex-shrink-0" /><div><h4 className="font-bold text-red-300 text-lg mb-2">Error al Cargar Datos</h4><p className="text-red-300 text-sm font-mono whitespace-pre-wrap">{dataError}</p></div></div></div></div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-black text-foreground tracking-wide">PANEL DE ADMINISTRACIÓN</h2>
        <Button onClick={handleAdminLogout} className="flex items-center gap-2" variant="destructive" size="sm">
            <ArrowLeftOnRectangleIcon className="h-5 w-5" />
            <span>Salir</span>
        </Button>
      </div>

      <div className="border-b border-border mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <Button
                onClick={() => setActiveTab('overview')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                variant="ghost"
                size="sm"
                aria-current={activeTab === 'overview' ? 'page' : undefined}
            >
                Resumen General
            </Button>
            <Button
                onClick={() => setActiveTab('customers')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'customers' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                variant="ghost"
                size="sm"
                aria-current={activeTab === 'customers' ? 'page' : undefined}
            >
                Clientes
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
        </nav>
      </div>

      <div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'customers' && <CustomerDossier allParticipants={allParticipants} allSpins={allSpins} />}
        {activeTab === 'reservations' && <ReservationsTable />}
      </div>
      <AnalyticsOrb onClick={() => setIsAnalyticsChatOpen(true)} />
      {isAnalyticsChatOpen && (
        <React.Suspense fallback={<div className="fixed bottom-4 right-4 bg-card text-foreground px-3 py-2 rounded-md border border-border">Cargando análisis...</div>}>
          <AnalyticsChatModalLazy onClose={() => setIsAnalyticsChatOpen(false)} adminId={null} />
        </React.Suspense>
      )}
    </div>
  );
};

export default AdminDashboard;
