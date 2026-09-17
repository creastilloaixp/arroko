import React from 'react';
import { XCircleIcon } from './Icons';
import { ConnectionDiagnostics } from './ConnectionDiagnostics';

const ConfigurationNeeded: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)] text-center max-w-4xl mx-auto p-4 space-y-8">
      {/* Diagnóstico detallado */}
      <ConnectionDiagnostics />

      {/* Información de configuración */}
      <div className="bg-gray-900/50 p-8 rounded-lg border border-red-700 shadow-2xl w-full">
        <div className="flex justify-center mb-4">
          <XCircleIcon className="h-16 w-16 text-red-500" />
        </div>
        <h2 className="text-4xl font-black text-white mb-4">Configuración Requerida</h2>
        <p className="text-gray-300 text-lg mb-6">
          Para que la aplicación funcione, necesitas conectar tu propia base de datos de Supabase.
        </p>

        <div className="bg-yellow-900/30 border border-yellow-700 p-4 rounded-lg mb-6">
          <p className="text-yellow-300 font-medium mb-2">✅ Buenas noticias:</p>
          <p className="text-yellow-400 text-sm">
            El archivo .env ya está configurado con tus credenciales. Si el diagnóstico arriba muestra problemas,
            sigue estos pasos adicionales:
          </p>
        </div>

        <div className="text-left w-full space-y-6">
          <div>
            <h3 className="text-white font-bold mb-3">1. Verifica tus credenciales en .env:</h3>
            <pre className="bg-black/50 p-4 rounded-md border border-gray-700 overflow-x-auto text-sm">
              <code className="text-gray-300">
{`SUPABASE_URL=https://sxgnmvtgtkxyrdhnjnnk.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`}
              </code>
            </pre>
          </div>

          <div>
            <h3 className="text-white font-bold mb-3">2. Verifica que las tablas existan en Supabase:</h3>
            <p className="text-gray-400 mb-2">Asegúrate de tener estas tablas en tu base de datos:</p>
            <ul className="text-gray-400 text-sm space-y-1 ml-4">
              <li>• <code className="bg-gray-800 px-2 py-1 rounded">whatsapp_messages</code></li>
              <li>• <code className="bg-gray-800 px-2 py-1 rounded">reservations</code></li>
              <li>• <code className="bg-gray-800 px-2 py-1 rounded">restaurant_settings</code></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold mb-3">3. Ejecuta el esquema SQL:</h3>
            <p className="text-gray-400 mb-2">
              Copia y ejecuta el contenido del archivo <code className="bg-gray-800 px-2 py-1 rounded">supabase_schema.sql</code>
              en el SQL Editor de tu dashboard de Supabase.
            </p>
          </div>

          <div>
            <h3 className="text-white font-bold mb-3">4. Verifica los permisos RLS:</h3>
            <p className="text-gray-400 mb-2">
              Asegúrate de que las políticas de seguridad (RLS) estén configuradas correctamente
              para permitir lectura/escritura desde tu aplicación.
            </p>
          </div>
        </div>

        <div className="bg-blue-900/30 border border-blue-700 p-4 rounded-lg mt-6">
          <p className="text-blue-300 font-medium mb-2">🔗 ¿Dónde encontrar tus credenciales?</p>
          <p className="text-blue-400 text-sm">
            Ve a tu proyecto de Supabase → Project Settings → API → copia el <strong>Project URL</strong> y el <strong>anon key</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConfigurationNeeded;
