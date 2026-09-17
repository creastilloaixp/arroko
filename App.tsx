import React, { useEffect, useState } from 'react';
import { useApp } from './context/AppContext';
import type { View } from './types';
import { PRIZES } from './constants';
import { isSupabaseConfigured } from './supabase';
import ConfigurationNeeded from './components/ConfigurationNeeded';
import SommelierOrb from './components/SommelierOrb';
import SommelierTextModal from './components/SommelierTextModal';
import SupabaseErrorNotification from './components/SupabaseErrorNotification';
import { ToastContainer } from './components/ui/toast';
import { Button } from './components/ui/button';
import { BackgroundPaths } from './components/ui/background-paths';

const Onboarding = React.lazy(() => import('./components/Onboarding'));
const ExclusiveInvite = React.lazy(() => import('./components/ExclusiveInvite'));
const RegistrationForm = React.lazy(() => import('./components/RegistrationForm'));
const Roulette = React.lazy(() => import('./components/Roulette'));
const WinnerPage = React.lazy(() => import('./components/WinnerPage'));
const RedeemPage = React.lazy(() => import('./components/RedeemPage'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const AdminLogin = React.lazy(() => import('./components/AdminLogin'));
const WhatsAppDashboard = React.lazy(() => import('./pages/WhatsAppDashboard'));
const SamuraiKidComingSoon = React.lazy(() => import('./components/SamuraiKidComingSoon'));
const CheckInPage = React.lazy(() => import('./components/CheckInPage'));
const SommelieriaLanding = React.lazy(() => import('./components/SommelieriaLanding'));

const App: React.FC = () => {
  const { currentView, spinResult, handleRedeem, reset, setCurrentView, isSommelierTextOpen, isAdminAuthenticated, isAuthLoading, navigateToProtectedView, handleAdminLogout } = useApp();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleOpenSamuraiKid = () => {
      window.history.pushState(null, '', '/arrokids');
      setCurrentView('arrokids');
    };
    window.addEventListener('openSamuraiKid', handleOpenSamuraiKid);
    return () => window.removeEventListener('openSamuraiKid', handleOpenSamuraiKid);
  }, [setCurrentView]);

  // Mantener cada superficie alineada con su URL, incluso al usar atrás/adelante.
  useEffect(() => {
    if (isAuthLoading) return;
    const syncViewFromPath = () => {
      const path = window.location.pathname;
      if (path.startsWith('/internal/conversations')) {
        navigateToProtectedView('whatsapp-dashboard');
      } else if (path.startsWith('/internal')) {
        navigateToProtectedView('admin');
      } else if (path.startsWith('/redeem')) {
        setCurrentView('redeem');
      } else if (path.startsWith('/sommelieria')) {
        setCurrentView('sommelieria');
      } else if (path.startsWith('/arrokids')) {
        setCurrentView('arrokids');
      } else if (path.startsWith('/checkin')) {
        setCurrentView('checkin');
      } else if (path.startsWith('/legal/terminos')) {
        setCurrentView('terms');
      } else if (path.startsWith('/legal/privacidad')) {
        setCurrentView('privacy');
      } else {
        setCurrentView('onboarding');
      }
    };
    syncViewFromPath();
    window.addEventListener('popstate', syncViewFromPath);
    return () => window.removeEventListener('popstate', syncViewFromPath);
  // Auth finishes once at startup; routing thereafter is driven by popstate/navigation handlers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading]);

  const isInternalSurface = currentView === 'admin-login' || currentView === 'admin' || currentView === 'whatsapp-dashboard';

  useEffect(() => {
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = isInternalSurface ? 'noindex,nofollow' : 'index,follow';
  }, [isInternalSurface]);

  // Helper para navegar y actualizar la URL
  const navigateWithUrl = (view: View, url: string = '/') => {
    window.history.pushState(null, '', url);
    setCurrentView(view);
    setIsMenuOpen(false);
  };

  const goToRedeem = () => {
    navigateWithUrl('redeem', '/redeem');
  };

  const goToArroKids = () => {
    navigateWithUrl('arrokids', '/arrokids');
  };

  const goToHome = () => {
    navigateWithUrl('register', '/');
    reset();
  };

  const goToInternal = (view: 'admin' | 'whatsapp-dashboard') => {
    const url = view === 'admin' ? '/internal/results' : '/internal/conversations';
    window.history.pushState(null, '', url);
    navigateToProtectedView(view);
    setIsMenuOpen(false);
  };

  const leaveInternal = async () => {
    if (isAdminAuthenticated) await handleAdminLogout();
    window.history.pushState(null, '', '/');
    reset();
  };

  const renderView = () => {
    switch (currentView) {
      case 'onboarding':
        return <Onboarding />;
      case 'invite':
        return <ExclusiveInvite />;
      case 'register':
        return <RegistrationForm />;
      case 'roulette':
        return <Roulette prizes={PRIZES} />;
      case 'winner':
        return spinResult ? <WinnerPage result={spinResult} /> : null;
      case 'redeem':
        return <RedeemPage onRedeem={handleRedeem} />;
      case 'admin-login':
        return <AdminLogin />;
      case 'admin':
        return isAdminAuthenticated ? <AdminDashboard prizes={PRIZES} /> : <AdminLogin />;
      case 'whatsapp-dashboard':
        return isAdminAuthenticated ? <WhatsAppDashboard /> : <AdminLogin />;
      case 'sommelieria':
        return <SommelieriaLanding />;
      case 'arrokids':
        return <SamuraiKidComingSoon onExit={goToHome} />;
      case 'checkin':
        return <CheckInPage onExit={goToHome} onComplete={() => navigateWithUrl('arrokids', '/arrokids')} />;
      case 'terms':
        return <LegalPage kind="terms" />;
      case 'privacy':
        return <LegalPage kind="privacy" />;
      default:
        return <Onboarding />;
    }
  };

  const publicHeader = (
     <header className="px-4 py-3 flex justify-between items-center bg-secondary text-secondary-foreground sticky top-0 z-50 shadow-[0_6px_0_rgba(7,56,61,0.18)]">
        <div
          className="flex items-center space-x-3 cursor-pointer transition-opacity hover:opacity-80"
          onClick={goToHome}
          title="Volver al inicio"
        >
          <img src="/brand/roko-avatar-source.png" alt="Roko, anfitrión de Arrokó" className="h-12 w-12 sm:h-14 sm:w-14 rounded-[14px] object-cover object-top bg-[#F4EBDD]" />
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold leading-none">ARROKÓ</h1>
            <p className="hidden sm:block text-xs text-[#DCE8E5]">Tu antojo, bien acompañado</p>
          </div>
        </div>
        <nav className="hidden md:flex space-x-2 text-sm font-medium">
          <Button variant="ghost" size="sm" onClick={goToHome}>Experiencia</Button>
          <Button variant="ghost" size="sm" onClick={goToRedeem}>Canjear</Button>
          <Button variant="ghost" size="sm" className="text-[#F4EBDD] hover:text-white hover:bg-white/10" onClick={goToArroKids}>🍙 ArroKids</Button>
        </nav>
        <div className="md:hidden relative">
          <Button
            aria-label="Abrir menú"
            onClick={() => setIsMenuOpen(prev => !prev)}
            className="flex items-center gap-2"
            variant="outline"
            size="sm"
          >
            <span className="block w-5 h-[2px] bg-white"></span>
            <span className="block w-5 h-[2px] bg-white mt-[3px]"></span>
            <span className="block w-5 h-[2px] bg-white mt-[3px]"></span>
          </Button>
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-card border border-border rounded-lg shadow-xl p-2 z-50">
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={goToHome}>Experiencia</Button>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={goToRedeem}>Canjear</Button>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={goToArroKids}>🍙 ArroKids</Button>
            </div>
          )}
        </div>
      </header>
  );

  const internalHeader = (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07383D] px-4 py-3 text-[#FFFDF8] shadow-[0_6px_0_rgba(241,91,67,0.9)] sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/brand/roko-avatar-source.png" alt="" className="h-11 w-11 rounded-xl bg-[#F4EBDD] object-cover object-top" />
          <div className="min-w-0">
            <p className="font-display text-xl font-extrabold leading-none sm:text-2xl">ARROKÓ OPERACIÓN</p>
            <p className="truncate text-xs font-bold uppercase tracking-[0.12em] text-[#B9D0CC]">Acceso interno · no público</p>
          </div>
        </div>
        {isAdminAuthenticated && (
          <nav aria-label="Navegación interna" className="hidden items-center gap-1 md:flex">
            <Button variant="ghost" size="sm" aria-current={currentView === 'admin' ? 'page' : undefined} className={currentView === 'admin' ? 'bg-white/12 text-white' : 'text-[#DCE8E5]'} onClick={() => goToInternal('admin')}>Resultados</Button>
            <Button variant="ghost" size="sm" aria-current={currentView === 'whatsapp-dashboard' ? 'page' : undefined} className={currentView === 'whatsapp-dashboard' ? 'bg-white/12 text-white' : 'text-[#DCE8E5]'} onClick={() => goToInternal('whatsapp-dashboard')}>Conversaciones</Button>
          </nav>
        )}
        <Button variant="outline" size="sm" className="shrink-0 border-white/30 bg-transparent text-white hover:bg-white hover:text-[#07383D]" onClick={leaveInternal}>
          {isAdminAuthenticated ? 'Salir' : 'Volver'}
        </Button>
      </div>
      {isAdminAuthenticated && (
        <nav aria-label="Navegación interna móvil" className="mx-auto mt-3 grid max-w-7xl grid-cols-2 gap-2 md:hidden">
          <Button variant="ghost" size="sm" className={currentView === 'admin' ? 'bg-white/12 text-white' : 'text-[#DCE8E5]'} onClick={() => goToInternal('admin')}>Resultados</Button>
          <Button variant="ghost" size="sm" className={currentView === 'whatsapp-dashboard' ? 'bg-white/12 text-white' : 'text-[#DCE8E5]'} onClick={() => goToInternal('whatsapp-dashboard')}>Conversaciones</Button>
        </nav>
      )}
    </header>
  );

  // Public surfaces must never expose the technical connection diagnostic.
  // Backend configuration belongs exclusively to the authenticated operation.
  if (!isSupabaseConfigured && isInternalSurface) {
    return (
       <div className="bg-background text-foreground min-h-screen antialiased">
        {isInternalSurface ? internalHeader : currentView === 'arrokids' ? null : publicHeader}
        <main className="p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <ConfigurationNeeded />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground min-h-screen antialiased">
       {isInternalSurface ? internalHeader : currentView === 'arrokids' ? null : publicHeader}
       {!isInternalSurface && currentView !== 'arrokids' && <BackgroundPaths />}
       <SupabaseErrorNotification />
       <ToastContainer />
      <main className={isInternalSurface ? 'bg-[#E9EFEC] p-3 sm:p-4 md:p-8' : 'p-3 sm:p-4 md:p-8'}>
        <div className="max-w-7xl mx-auto">
          <div key={currentView} className="view-container">
            <React.Suspense fallback={<div className="grid min-h-[55vh] place-items-center text-sm font-bold text-[#0B4F56]">Preparando la experiencia…</div>}>
              {renderView()}
            </React.Suspense>
          </div>
        </div>
      </main>
      { !isInternalSurface && currentView !== 'arrokids' && (
        <>
          <SommelierOrb />
          {isSommelierTextOpen && <SommelierTextModal />}
        </>
      )}

    </div>
  );
};

const LegalPage: React.FC<{ kind: 'terms' | 'privacy' }> = ({ kind }) => (
  <article className="mx-auto max-w-3xl rounded-2xl bg-card p-6 text-card-foreground shadow-[0_14px_32px_rgba(7,56,61,0.18)] sm:p-10">
    <p className="font-display text-sm font-bold uppercase tracking-[0.08em] text-primary">Arrokó · documento de trabajo</p>
    <h2 className="mt-3 text-4xl font-extrabold leading-none text-secondary sm:text-5xl">
      {kind === 'terms' ? 'Términos de la dinámica' : 'Aviso de privacidad'}
    </h2>
    <div className="mt-8 space-y-5 text-base leading-relaxed">
      {kind === 'terms' ? (
        <>
          <p>La experiencia de recompensas está dirigida a personas mayores de 18 años. Cada premio está sujeto a disponibilidad, vigencia, sucursal y reglas visibles antes de confirmar el registro.</p>
          <p>Los códigos son personales, de un solo uso y no pueden cambiarse por efectivo. Arrokó podrá invalidar participaciones duplicadas o manipuladas.</p>
          <p className="font-semibold text-primary">Los premios mostrados en esta variante son demostrativos y requieren aprobación final de Arrokó antes de publicarse.</p>
        </>
      ) : (
        <>
          <p>Los datos solicitados se utilizan para operar la participación, validar el premio y medir el resultado de la campaña. El consentimiento para promociones debe solicitarse por separado.</p>
          <p>No compartas información sensible en el sommelier. Para ejercer derechos sobre tus datos, comunícate directamente con Arrokó al 667 318 6010.</p>
          <p className="font-semibold text-primary">Este texto es una base funcional y debe recibir revisión legal antes del lanzamiento público.</p>
        </>
      )}
    </div>
    <Button className="mt-9" onClick={() => { window.history.pushState(null, '', '/'); window.location.reload(); }}>Volver a la experiencia</Button>
  </article>
);

export default App;
