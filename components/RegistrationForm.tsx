import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Participant } from '../types';
import { SpinnerIcon } from './Icons';

const RegistrationForm: React.FC = () => {
  const { handleRegister, onboardingPreferences } = useApp();
  const [fullName, setFullName] = useState('');
  const [instagram, setInstagram] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState(''); // Store as YYYY-MM-DD
  const [birthDateDisplay, setBirthDateDisplay] = useState(''); // For display DD/MM/YYYY
  const [terms, setTerms] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const TERMS_VERSION = '1.0';

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);

    let formatted = value;
    if (value.length > 4) {
      formatted = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
    } else if (value.length > 2) {
      formatted = `${value.slice(0, 2)}/${value.slice(2)}`;
    }

    setBirthDateDisplay(formatted);

    if (value.length === 8) {
      const day = value.slice(0, 2);
      const month = value.slice(2, 4);
      const year = value.slice(4);
      setBirthDate(`${year}-${month}-${day}`);
    } else {
      setBirthDate('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !instagram || !phone || !birthDate || !terms) {
      setError('Todos los campos son obligatorios. Asegúrate de poner la fecha completa.');
      return;
    }

    if (instagram.length < 3) {
      setError('Por favor ingresa un usuario de Instagram válido.');
      return;
    }

    const phoneDigits = phone.replace(/[^\d+]/g, '').replace(/(?!^)[^\d]/g, '');
    if (phoneDigits.replace(/\D/g, '').length < 10 || phoneDigits.replace(/\D/g, '').length > 15) {
      setError('Teléfono inválido. Usa 10–15 dígitos, con o sin +.');
      return;
    }

    const today = new Date();
    const birth = new Date(birthDate);

    // Check if valid date
    if (isNaN(birth.getTime())) {
      setError('Fecha de nacimiento inválida.');
      return;
    }

    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    if (age < 18) {
      setError('Debes ser mayor de 18 años para participar.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const newParticipant: Omit<Participant, 'id'> = {
        fullName,
        instagram,
        phone: phoneDigits,
        birthDate,
        termsAcceptedAt: new Date().toISOString(),
        termsVersion: TERMS_VERSION,
        preferences: {
          flavors: onboardingPreferences?.flavors ?? [],
          group: onboardingPreferences?.group ?? '',
          marketingConsent,
          marketingConsentAt: marketingConsent ? new Date().toISOString() : undefined,
        },
      };
      await handleRegister(newParticipant);
    } catch (err) {
       setError(err instanceof Error ? err.message : 'Hubo un error al registrar. Por favor, intenta de nuevo.');
       console.error(err);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center max-w-md w-full mx-auto px-3">
      <h2 className="font-display text-4xl sm:text-5xl font-extrabold text-[#0B4F56] mb-2">GUARDA TU PREMIO</h2>
      <p className="text-sm sm:text-base text-[#587776] mb-6 sm:mb-8">Regístrate para generar tu QR de canje. Las promociones por WhatsApp son opcionales.</p>

      <div className="w-full p-4 sm:p-8 bg-[#FFFDF8] text-[#173B3D] rounded-2xl shadow-[0_14px_32px_rgba(7,56,61,0.18)]">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-[#365E60] mb-1">Nombre completo</label>
            <input type="text" autoComplete="name" placeholder="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full min-h-12 bg-white border border-[#9EB7B4] rounded-xl px-4 py-3 text-[#173B3D] placeholder-[#6E8C8B] focus:outline-none focus:ring-4 focus:ring-[#0B4F56]/25 transition-all" required />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-bold text-[#365E60] mb-1">Instagram (@usuario)</label>
            <input type="text" autoCapitalize="none" autoComplete="off" placeholder="@tu_usuario" value={instagram} onChange={(e) => setInstagram(e.target.value)} className="w-full min-h-12 bg-white border border-[#9EB7B4] rounded-xl px-4 py-3 text-[#173B3D] placeholder-[#6E8C8B] focus:outline-none focus:ring-4 focus:ring-[#0B4F56]/25 transition-all" required />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-bold text-[#365E60] mb-1">Teléfono (WhatsApp)</label>
            <input type="tel" inputMode="tel" autoComplete="tel" pattern="^\+?\d{10,15}$" title="Ingresa un número válido (10–15 dígitos)" placeholder="Ej. 6671234567" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full min-h-12 bg-white border border-[#9EB7B4] rounded-xl px-4 py-3 text-[#173B3D] placeholder-[#6E8C8B] focus:outline-none focus:ring-4 focus:ring-[#0B4F56]/25 transition-all" required />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-bold text-[#365E60] mb-1">Fecha de nacimiento</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              value={birthDateDisplay}
              onChange={handleBirthDateChange}
              className="w-full min-h-12 bg-white border border-[#9EB7B4] rounded-xl px-4 py-3 text-[#173B3D] placeholder-[#6E8C8B] focus:outline-none focus:ring-4 focus:ring-[#0B4F56]/25 transition-all"
              required
            />
            <p className="text-[11px] text-[#6E8C8B] mt-1 text-left">Escribe los números seguidos, por ejemplo 15051995.</p>
          </div>
          <div className="flex items-center">
            <input type="checkbox" id="terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="h-4 w-4 rounded border-[#6E8C8B] text-[#F15B43] focus:ring-[#0B4F56]" required/>
            <label htmlFor="terms" className="ml-2 block text-xs sm:text-sm text-[#587776] text-left">
              Acepto los <button type="button" className="font-bold underline text-[#0B4F56]" onClick={() => setShowTerms(true)}>términos de la dinámica</button> y el <a href="/legal/privacidad" target="_blank" rel="noopener" className="font-bold underline text-[#0B4F56]">aviso de privacidad</a>.
            </label>
          </div>
          <div className="flex items-start rounded-xl bg-[#DCE8E5] p-3">
            <input type="checkbox" id="marketing" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} className="mt-1 h-4 w-4 rounded border-[#6E8C8B] text-[#F15B43] focus:ring-[#0B4F56]" />
            <label htmlFor="marketing" className="ml-2 block text-xs sm:text-sm text-[#365E60] text-left">
              Sí quiero recibir promociones y novedades de Arrokó por WhatsApp. <strong>Opcional.</strong>
            </label>
          </div>
          {error && <p role="alert" className="text-[#BD2F2F] font-semibold text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full min-h-12 bg-[#F15B43] hover:bg-[#E44E39] text-white font-display text-lg font-extrabold py-3 px-4 rounded-xl transition-all shadow-[0_7px_0_#9F3328] flex items-center justify-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0B4F56] disabled:opacity-60 disabled:cursor-not-allowed active:translate-y-1 active:shadow-[0_2px_0_#9F3328]"
          >
            {isLoading ? <SpinnerIcon className="h-6 w-6" /> : 'REGISTRARME Y RECLAMAR'}
          </button>
        </form>
      </div>
      {showTerms && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-2">Términos de la dinámica · Arrokó Recompensas</h3>
            <div className="text-sm text-gray-300 space-y-3 max-h-[60vh] overflow-y-auto">
              <p><strong>1. Objeto.</strong> Arrokó Recompensas permite registrarte para participar en una dinámica promocional y optar por premios sujetos a disponibilidad y reglas específicas.</p>
              <p><strong>2. Elegibilidad.</strong> Solo personas mayores de 18 años. Una participación por persona. Podemos solicitar identificación para validar datos y evitar fraude.</p>
              <p><strong>3. Registro y veracidad.</strong> Debes proporcionar nombre completo, correo y teléfono (WhatsApp) reales y vigentes. El número de teléfono debe permitir contacto por WhatsApp y podrá ser normalizado a formato internacional.</p>
              <p><strong>4. Tratamiento de datos personales.</strong> Los datos se usarán para operar la participación, validar el canje y medir la dinámica. El consentimiento para promociones se solicita por separado.</p>
              <p><strong>5. Comunicaciones.</strong> Arrokó puede contactarte para operar el premio. Los mensajes promocionales sólo se enviarán si marcas la aceptación opcional.</p>
              <p><strong>6. Premios y canje.</strong> Los premios no son transferibles ni canjeables por efectivo. Están sujetos a stock, vigencia y condiciones específicas. Para canjear, puede requerirse identificación y validación del código/QR asignado.</p>
              <p><strong>7. Conducta y restricciones.</strong> Queda prohibida la suplantación de identidad, el uso de múltiples registros para una misma persona y cualquier intento de fraude. Nos reservamos el derecho de inhabilitar participaciones que incumplan estas reglas.</p>
              <p><strong>8. Limitación de responsabilidad.</strong> No somos responsables por fallas técnicas, interrupciones de servicio o errores ajenos al control del restaurante que afecten el registro, la participación o el canje.</p>
              <p><strong>9. Modificaciones.</strong> Podemos modificar estos términos, premios o condiciones de la dinámica en cualquier momento, publicando la versión vigente en el sitio o en el formulario.</p>
              <p><strong>10. Aceptación.</strong> Al marcar la casilla de aceptación declaras haber leído y aceptar íntegramente estos términos y condiciones.</p>
              <p><strong>11. Jurisdicción aplicable.</strong> Estos términos se rigen por las leyes de México. Cualquier controversia se someterá a los tribunales competentes de la localidad del restaurante.</p>
              <p className="text-gray-400">Borrador funcional 1.0 · requiere revisión legal antes del lanzamiento.</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowTerms(false)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistrationForm;
