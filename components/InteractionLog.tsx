import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { SpinnerIcon } from './Icons';
import type { Participant } from '../types';

interface Interaction {
  id: string;
  created_at: string;
  event_type: string;
  metadata: any;
  participant_id: string;
  participants: { full_name: string } | null;
}

const InteractionLog: React.FC = () => {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInteractions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase!
          .from('user_interactions')
          .select('*, participants(full_name)')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setInteractions(data as unknown as Interaction[]);
      } catch (err: any) {
        console.error("Error fetching interactions", err);
        setError("No se pudo cargar el registro de actividad.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInteractions();
  }, []);

  const renderMetadata = (metadata: any) => {
    if (!metadata) return null;
    return (
        <code className="text-xs text-gray-500 block whitespace-pre-wrap break-all">
            {JSON.stringify(metadata, null, 2)}
        </code>
    );
  };

  return (
    <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
      <h3 className="text-xl font-bold text-white mb-4">Registro de Actividad</h3>
      <div className="overflow-y-auto h-96 pr-2">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <SpinnerIcon className="h-8 w-8 text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-full text-red-400">{error}</div>
        ) : interactions.length === 0 ? (
          <div className="flex justify-center items-center h-full text-gray-500">No hay interacciones registradas.</div>
        ) : (
          <table className="w-full text-sm text-left text-gray-400">
            <thead className="text-xs text-gray-300 uppercase bg-gray-800 sticky top-0">
              <tr>
                <th scope="col" className="px-4 py-2">Evento</th>
                <th scope="col" className="px-4 py-2">Participante</th>
                <th scope="col" className="px-4 py-2">Fecha</th>
                <th scope="col" className="px-4 py-2">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {interactions.map(item => (
                <tr key={item.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-2 font-mono text-xs">{item.event_type}</td>
                  <td className="px-4 py-2">{item.participants?.full_name || 'N/A'}</td>
                  <td className="px-4 py-2">{new Date(item.created_at).toLocaleTimeString('es-MX')}</td>
                  <td className="px-4 py-2">{renderMetadata(item.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default InteractionLog;
