import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SpinnerIcon } from './Icons';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { showToast } from './ui/toast';

const AdminLogin: React.FC = () => {
  const { handleAdminLogin } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await handleAdminLogin(email, password);

    if (!result.success) {
      setError(result.error || 'Error al iniciar sesión. Inténtalo de nuevo.');
      showToast(result.error || 'Error al iniciar sesión', 'destructive');
    } else {
      showToast('Bienvenido', 'success');
    }
    // On success, the context will automatically change the view.
    setIsLoading(false);
  };

  return (
    <div className="mx-auto flex min-h-[65vh] max-w-md flex-col items-center justify-center text-center">
      <p className="font-display text-sm font-bold uppercase tracking-[0.14em] text-[#F15B43]">Portal interno</p>
      <h2 className="mt-3 font-display text-5xl font-extrabold leading-[0.9] text-[#07383D]">ACCESO DE OPERACIÓN</h2>
      <p className="mb-8 mt-4 max-w-sm text-muted-foreground">Esta superficie es exclusiva para el equipo autorizado de Arrokó.</p>

      <div className="w-full rounded-2xl border border-border bg-card p-7 shadow-[0_14px_32px_rgba(7,56,61,0.18)] sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? <SpinnerIcon className="h-6 w-6" /> : 'ENTRAR'}
          </Button>
        </form>
        <p className="text-muted-foreground text-xs mt-4 text-center">
          Usa las credenciales asignadas a tu cuenta de operación.
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
