import React from 'react';
import { AlertTriangleIcon, CheckCircleIcon, SettingsIcon } from './Icons';

const N8NAgentManager: React.FC = () => (
  <section className="space-y-5">
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F15B43]">Automatización</p>
      <h2 className="mt-1 font-display text-3xl font-extrabold text-slate-950">Agente de WhatsApp</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        La consola ya no lee ni guarda llaves de Evolution API en el navegador. La conexión debe vivir en un servicio privado y auditable.
      </p>
    </header>

    <div className="grid gap-4 md:grid-cols-2">
      <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-3 text-emerald-800">
          <CheckCircleIcon className="h-6 w-6" />
          <h3 className="font-bold">Interfaz protegida</h3>
        </div>
        <p className="mt-3 text-sm leading-6 text-emerald-900/75">Las credenciales permanentes fueron retiradas del bundle público.</p>
      </article>

      <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-center gap-3 text-amber-800">
          <AlertTriangleIcon className="h-6 w-6" />
          <h3 className="font-bold">Integración pendiente</h3>
        </div>
        <p className="mt-3 text-sm leading-6 text-amber-900/75">Hace falta desplegar el proxy autenticado y validar el webhook de n8n antes de activar mensajes reales.</p>
      </article>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <SettingsIcon className="mt-0.5 h-6 w-6 text-[#0B4F56]" />
        <div>
          <h3 className="font-bold text-slate-950">Contrato de activación</h3>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            <li>1. Guardar URL y API key como secretos del servidor.</li>
            <li>2. Exponer sólo operaciones permitidas: estado, plantilla y envío aprobado.</li>
            <li>3. Registrar usuario, destinatario, plantilla, resultado y timestamp.</li>
          </ol>
        </div>
      </div>
    </div>
  </section>
);

export default N8NAgentManager;
