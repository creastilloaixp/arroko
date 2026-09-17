import React from 'react';
import { useApp } from '../context/AppContext';
import { XCircleIcon, XMarkIcon } from './Icons';

const SupabaseErrorNotification: React.FC = () => {
  const { supabaseError, clearSupabaseError } = useApp();

  if (!supabaseError) {
    return null;
  }

  const getSuggestion = () => {
      if (supabaseError.message.includes('Invalid API key')) {
        return `Causa probable: La llave de API (anon key) de Supabase es incorrecta o ha expirado.

Solución Sugerida:
1. Ve a tu panel de Supabase > Project Settings > API.
2. Copia la 'Project API Key' (la que es pública y 'anon').
3. Pega la llave correcta en el archivo 'supabase.ts' en la constante 'supabaseAnonKey'.`;
      }
      // Default to RLS error
      return `Causa probable: La Seguridad a Nivel de Fila (RLS) está habilitada, pero no hay una política que permita a los usuarios anónimos realizar la operación '${supabaseError.operation}'.

Solución Sugerida:
1. Ve a tu panel de Supabase > Authentication > Policies.
2. Selecciona la tabla '${supabaseError.table}'.
3. Crea o modifica una política para permitir la operación '${supabaseError.operation}' para el rol 'anon'. Puedes usar las plantillas de Supabase para empezar.`;
  }


  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 w-11/12 max-w-4xl bg-red-900/80 backdrop-blur-md border border-red-700 text-red-200 px-4 py-3 rounded-lg shadow-2xl z-[100]"
      role="alert"
    >
      <div className="flex">
        <div className="py-1">
          <XCircleIcon className="h-6 w-6 text-red-400 mr-4 flex-shrink-0"/>
        </div>
        <div>
          <p className="font-bold mb-1">Error de Configuración de Supabase Detectado</p>
          <p className="text-sm font-bold mb-2">Operación fallida: <code className="bg-black/50 px-1 py-0.5 rounded text-yellow-300">{supabaseError.operation}</code> en la tabla <code className="bg-black/50 px-1 py-0.5 rounded text-yellow-300">{supabaseError.table}</code></p>
          <p className="text-sm font-mono whitespace-pre-wrap">{getSuggestion()}</p>
        </div>
         <button onClick={clearSupabaseError} className="absolute top-2 right-2 text-red-300 hover:text-white">
            <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default SupabaseErrorNotification;