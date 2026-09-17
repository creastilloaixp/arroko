import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, Smartphone } from 'lucide-react';
import { startCheckin } from '../lib/arrokoExperience';

interface CheckInPageProps { onComplete: () => void; onExit: () => void; }

const CheckInPage: React.FC<CheckInPageProps> = ({ onComplete, onExit }) => {
  const checkinSlug = useMemo(() => new URLSearchParams(window.location.search).get('point') || 'centro-nfc', []);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [childAlias, setChildAlias] = useState('');
  const [ageBand, setAgeBand] = useState('6-8');
  const [childConsent, setChildConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [serviceConsent, setServiceConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!serviceConsent) return setError('Acepta el aviso de privacidad para registrar la visita.');
    if (childAlias && !childConsent) return setError('Autoriza la participación infantil o deja vacío el alias.');
    setLoading(true); setError('');
    try {
      await startCheckin({ checkinSlug, name, phone, partySize, marketingConsent, childParticipationConsent: childConsent, childAlias: childAlias.trim() || undefined, ageBand });
      onComplete();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos registrar la visita.');
    } finally { setLoading(false); }
  };

  return (
    <section className="mx-auto max-w-3xl overflow-hidden rounded-[28px] bg-[#FFFDF8] text-[#07383D] shadow-[0_16px_0_#C83F30]">
      <header className="bg-[#07383D] px-6 py-8 text-white sm:px-10">
        <p className="font-display text-sm font-extrabold uppercase tracking-[.16em] text-[#F15B43]">Check-in Arrokó</p>
        <h1 className="mt-3 font-display text-5xl font-extrabold leading-none">TU VISITA<br/>EMPIEZA AQUÍ</h1>
        <p className="mt-4 max-w-xl text-[#DCE8E5]">Registra al adulto responsable. Podrás acumular visitas, conectar tu ticket y guardar los puntos de ArroKids.</p>
      </header>
      <form onSubmit={submit} className="grid gap-5 p-6 sm:grid-cols-2 sm:p-10">
        <label className="sm:col-span-2"><span className="mb-2 block text-sm font-extrabold">Nombre del adulto responsable</span><input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} className="min-h-12 w-full rounded-xl border-2 border-[#9EB7B4] bg-white px-4" /></label>
        <label><span className="mb-2 block text-sm font-extrabold">WhatsApp</span><input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="667 123 4567" className="min-h-12 w-full rounded-xl border-2 border-[#9EB7B4] bg-white px-4" /></label>
        <label><span className="mb-2 block text-sm font-extrabold">Personas en la visita</span><input required type="number" min="1" max="40" value={partySize} onChange={e=>setPartySize(Number(e.target.value))} className="min-h-12 w-full rounded-xl border-2 border-[#9EB7B4] bg-white px-4" /></label>

        <div className="sm:col-span-2 rounded-2xl bg-[#DCE8E5] p-5">
          <div className="flex gap-3"><Smartphone className="h-6 w-6 shrink-0 text-[#F15B43]"/><div><h2 className="font-display text-xl font-extrabold">¿Jugarán en ArroKids?</h2><p className="text-sm text-[#365E60]">Usamos sólo un alias y rango de edad. Nunca pedimos teléfono, correo ni fecha de nacimiento del menor.</p></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-bold">Alias del pequeño (opcional)</span><input value={childAlias} onChange={e=>setChildAlias(e.target.value)} maxLength={40} className="min-h-11 w-full rounded-xl border border-[#9EB7B4] bg-white px-3" /></label><label><span className="mb-1 block text-xs font-bold">Rango de edad</span><select value={ageBand} onChange={e=>setAgeBand(e.target.value)} className="min-h-11 w-full rounded-xl border border-[#9EB7B4] bg-white px-3"><option>3-5</option><option>6-8</option><option>9-12</option><option>13-15</option></select></label></div>
          <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={childConsent} onChange={e=>setChildConsent(e.target.checked)} className="mt-1 h-5 w-5"/><span>Como adulto responsable, autorizo registrar sus partidas y puntos bajo este alias.</span></label>
        </div>

        <label className="sm:col-span-2 flex items-start gap-3 text-sm"><input required type="checkbox" checked={serviceConsent} onChange={e=>setServiceConsent(e.target.checked)} className="mt-1 h-5 w-5"/><span>Acepto el aviso de privacidad y el uso de mis datos para operar la visita, beneficios y canjes.</span></label>
        <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-[#D5C9B7] p-4 text-sm"><input type="checkbox" checked={marketingConsent} onChange={e=>setMarketingConsent(e.target.checked)} className="mt-1 h-5 w-5"/><span>Quiero recibir promociones personalizadas por WhatsApp. <strong>Opcional.</strong></span></label>
        {error && <p role="alert" className="sm:col-span-2 font-bold text-[#BD2F2F]">{error}</p>}
        <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row-reverse"><button disabled={loading} className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-[#F15B43] px-6 font-display text-lg font-extrabold text-white shadow-[0_6px_0_#9F3328] disabled:opacity-60">{loading ? 'REGISTRANDO…' : 'HACER CHECK-IN'}<ArrowRight className="h-5 w-5"/></button><button type="button" onClick={onExit} className="min-h-14 rounded-xl px-6 font-bold">Ahora no</button></div>
        <p className="sm:col-span-2 flex items-center justify-center gap-2 text-center text-xs text-[#587776]"><ShieldCheck className="h-4 w-4"/> El teléfono se protege antes de guardarse; sólo el adulto puede recibir comunicaciones.</p>
      </form>
    </section>
  );
};

export default CheckInPage;
