import React, { useState } from 'react';
import type { Database } from '../supabase';
import { supabase } from '../supabase';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, ClipboardDocumentCheckIcon, WrenchScrewdriverIcon } from './Icons';

type Settings = Database['public']['Tables']['restaurant_settings']['Row'];

interface HealthCheckItemProps {
    title: string;
    description: string;
    isSuccess: boolean;
    children?: React.ReactNode;
}

const HealthCheckItem: React.FC<HealthCheckItemProps> = ({ title, description, isSuccess, children }) => (
    <div className={`p-4 rounded-lg border flex items-start gap-4 ${isSuccess ? 'bg-green-900/30 border-green-700' : 'bg-yellow-900/30 border-yellow-700'}`}>
        <div>
            {isSuccess ?
                <CheckCircleIcon className="h-7 w-7 text-green-400 flex-shrink-0" /> :
                <InformationCircleIcon className="h-7 w-7 text-yellow-400 flex-shrink-0" />
            }
        </div>
        <div>
            <h4 className={`font-bold ${isSuccess ? 'text-green-300' : 'text-yellow-300'}`}>{title}</h4>
            <p className="text-sm text-gray-400">{description}</p>
            <div className="mt-2">{children}</div>
        </div>
    </div>
);

const WhatsAppHealthCheck: React.FC<{ settings: Partial<Settings> }> = ({ settings }) => {
    const [copySuccess, setCopySuccess] = useState(false);
    const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const webhookUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/evolution-webhook` : 'Configura VITE_SUPABASE_URL';

    const handleCopy = () => {
        navigator.clipboard.writeText(webhookUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const isRestaurantInfoSet = !!settings.restaurant_name && !!settings.opening_hours && !!settings.restaurant_address;

    return (
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
            <div className="flex items-center gap-3 mb-6">
                <WrenchScrewdriverIcon className="h-8 w-8 text-red-400" />
                <h3 className="text-2xl font-bold text-white">Guía de Configuración del Asistente de WhatsApp</h3>
            </div>

            <div className="space-y-4">
                <HealthCheckItem
                    title="Paso 1: Configurar Información del Restaurante"
                    description="El asistente de IA necesita conocer tu restaurante para responder preguntas. Completa los datos básicos."
                    isSuccess={isRestaurantInfoSet}
                >
                    <p className="text-xs text-gray-500">Puedes editar esta información en la pestaña de 'Ajustes'.</p>
                </HealthCheckItem>

                <HealthCheckItem
                    title="Paso 2: Conectar con Evolution API"
                    description="La URL y la API key deben existir como secretos del servicio privado; nunca se consultan desde este navegador."
                    isSuccess={false}
                >
                     <p className="text-xs text-gray-500">Puedes editar esta información en la pestaña de 'Ajustes'.</p>
                </HealthCheckItem>

                <HealthCheckItem
                    title="Paso 3: Configurar Webhook en Evolution API"
                    description="Debes copiar esta URL y pegarla en la configuración de Webhook Global de tu instancia de Evolution API para que podamos recibir los mensajes de tus clientes."
                    isSuccess={true}
                >
                    <div className="flex items-center gap-2 mt-2 bg-black/50 p-2 rounded-md">
                        <input type="text" readOnly value={webhookUrl} className="flex-grow bg-transparent text-gray-300 font-mono text-sm focus:outline-none" />
                        <button onClick={handleCopy} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-1 px-3 rounded-md text-sm flex items-center gap-2">
                           {copySuccess ? <><CheckCircleIcon className="h-4 w-4" /> Copiado</> : <><ClipboardDocumentCheckIcon className="h-4 w-4" /> Copiar</>}
                        </button>
                    </div>
                </HealthCheckItem>

                 <HealthCheckItem
                    title="Paso 4: Configurar Variables de Entorno de la Edge Function"
                    description="La función de Supabase que procesa los mensajes necesita acceso seguro a tus llaves de Supabase y Gemini. Estas deben ser configuradas como 'secrets' en tu proyecto."
                    isSuccess={false} // This is a manual check, so always show as pending.
                >
                   <div className="text-sm text-yellow-300/80 bg-black/30 p-3 rounded-md mt-2 space-y-2">
                       <p>Ve a <strong className="text-white">Supabase Dashboard &gt; Edge Functions &gt; evolution-webhook &gt; Settings &gt; Add New Secret</strong> y añade las siguientes variables:</p>
                       <ul className="list-disc list-inside font-mono text-xs pl-2">
                           <li><span className="font-bold">GEMINI_API_KEY:</span> Llave de Gemini sólo para servidor.</li>
                           <li><span className="font-bold">SUPABASE_URL:</span> La URL de tu proyecto de Supabase.</li>
                           <li><span className="font-bold">SUPABASE_ANON_KEY:</span> Tu llave anónima (pública) de Supabase.</li>
                           <li><span className="font-bold">SUPABASE_SERVICE_ROLE_KEY:</span> Tu llave de servicio (secreta) de Supabase.</li>
                       </ul>
                   </div>
                </HealthCheckItem>
            </div>
        </div>
    );
};

export default WhatsAppHealthCheck;
