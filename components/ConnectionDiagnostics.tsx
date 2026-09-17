import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export const ConnectionDiagnostics: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState({
    envVars: false,
    supabaseConnection: false,
    tables: {
      whatsapp_messages: false,
      reservations: false,
      restaurant_settings: false
    },
    error: null as string | null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const runDiagnostics = async () => {
      setIsLoading(true);
      const newDiagnostics = {
        envVars: false,
        supabaseConnection: false,
        tables: {
          whatsapp_messages: false,
          reservations: false,
          restaurant_settings: false
        },
        error: null as string | null
      };

      try {
        // 1. Verificar variables de entorno
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

        console.log('Variables de entorno detectadas:');
        console.log('- SUPABASE_URL:', url ? '✅ Presente' : '❌ Ausente');
        console.log('- SUPABASE_ANON_KEY:', key ? '✅ Presente' : '❌ Ausente');

        newDiagnostics.envVars = !!(url && key);

        if (!newDiagnostics.envVars) {
          newDiagnostics.error = 'Variables de entorno no configuradas';
          setDiagnostics(newDiagnostics);
          setIsLoading(false);
          return;
        }

        // 2. Verificar conexión a Supabase
        if (!supabase) {
          newDiagnostics.error = 'Cliente Supabase no inicializado';
          setDiagnostics(newDiagnostics);
          setIsLoading(false);
          return;
        }

        // 3. Probar conexión con una consulta simple
        try {
          const { data, error } = await supabase.from('whatsapp_messages').select('id').limit(1);
          newDiagnostics.supabaseConnection = !error;
          if (error) {
            console.error('Error de conexión:', error);
            newDiagnostics.error = `Error de conexión: ${error.message}`;
          }
        } catch (connError: any) {
          console.error('Error crítico de conexión:', connError);
          newDiagnostics.error = `Error crítico: ${connError.message}`;
        }

        // 4. Verificar tablas específicas
        const tables = ['whatsapp_messages', 'reservations', 'restaurant_settings'] as const;

        for (const table of tables) {
          try {
            const { error } = await supabase.from(table).select('id').limit(1);
            newDiagnostics.tables[table] = !error;
            if (error) {
              console.error(`Error en tabla ${table}:`, error);
            }
          } catch (tableError: any) {
            console.error(`Error accediendo a ${table}:`, tableError);
            newDiagnostics.tables[table] = false;
          }
        }

      } catch (error: any) {
        console.error('Error en diagnóstico:', error);
        newDiagnostics.error = error.message;
      }

      setDiagnostics(newDiagnostics);
      setIsLoading(false);
    };

    runDiagnostics();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-bold text-white mb-4">🔍 Diagnóstico de Conexión</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#F15B43] border-r-transparent"></div>
          <span className="ml-3 text-gray-400">Ejecutando diagnóstico...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
      <h3 className="text-lg font-bold text-white mb-4">🔍 Diagnóstico de Conexión</h3>

      {diagnostics.error && (
        <div className="bg-red-900/50 border border-red-700 p-4 rounded-lg mb-4">
          <p className="text-red-300 font-medium">❌ Error detectado:</p>
          <p className="text-red-400 text-sm mt-1">{diagnostics.error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
          <span className="text-gray-300">Variables de Entorno</span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            diagnostics.envVars ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
          }`}>
            {diagnostics.envVars ? '✅ Configuradas' : '❌ No configuradas'}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
          <span className="text-gray-300">Conexión Supabase</span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            diagnostics.supabaseConnection ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
          }`}>
            {diagnostics.supabaseConnection ? '✅ Conectado' : '❌ Falló'}
          </span>
        </div>

        <div className="mt-4">
          <p className="text-gray-400 text-sm mb-2">Tablas de Base de Datos:</p>
          <div className="space-y-2">
            {Object.entries(diagnostics.tables).map(([table, connected]) => (
              <div key={table} className="flex items-center justify-between p-2 bg-gray-800 rounded text-sm">
                <span className="text-gray-300">{table}</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  connected ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                }`}>
                  {connected ? '✅' : '❌'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
        <p className="text-yellow-300 text-sm font-medium">💡 Sugerencias:</p>
        <ul className="text-yellow-400 text-sm mt-2 space-y-1">
          {!diagnostics.envVars && (
            <li>• Verifica tu archivo .env tiene las credenciales correctas</li>
          )}
          {!diagnostics.supabaseConnection && (
            <li>• Revisa que tu proyecto Supabase esté activo</li>
          )}
          {!diagnostics.tables.whatsapp_messages && (
            <li>• Ejecuta el archivo supabase_schema.sql en tu dashboard de Supabase</li>
          )}
          <li>• Verifica los permisos RLS (Row Level Security) en Supabase</li>
        </ul>
      </div>
    </div>
  );
};
