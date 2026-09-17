import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from 'react';
import type { View, Participant, Prize, SpinResult } from '../types';
import { PRIZES } from '../constants';
import { trackInteraction } from '../lib/tracking';
import { useAuth } from '../lib/useAuth';
import { claimReward, redeemReward, startCheckin } from '../lib/arrokoExperience';

// New structured error type for detailed feedback
interface SupabaseErrorDetails {
    table: string;
    operation: 'INSERT' | 'SELECT' | 'UPDATE' | 'DELETE';
    message: string;
    details?: string;
}

interface AppContextType {
  currentView: View;
  participant: Participant | null;
  spinResult: SpinResult | null;
  isSommelierOrbOpen: boolean;
  isSommelierTextOpen: boolean;
  isSommelierVoiceOpen: boolean;
  isAdminAuthenticated: boolean;
  isAuthLoading: boolean;
  supabaseError: SupabaseErrorDetails | null;
  setCurrentView: (view: View) => void;
  handleRegister: (participant: Omit<Participant, 'id'>) => Promise<void>;
  handleSpinFinish: (prize: Prize) => Promise<void>;
  handleRedeem: (code: string) => Promise<{ success: boolean; message: string; prize?: Prize }>;
  handleAdminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  handleAdminLogout: () => Promise<void>;
  reset: () => void;
  toggleSommelierOrb: () => void;
  openSommelierText: () => void;
  closeSommelierText: () => void;
  openSommelierVoice: () => void;
  closeSommelierVoice: () => void;
  navigateToProtectedView: (view: View) => void;
  clearSupabaseError: () => void;
  onboardingPreferences: { flavors: string[], group: string } | null;
  setOnboardingPreferences: (prefs: { flavors: string[], group: string }) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SESSION_KEY = 'arroko_session_v1';
const SESSION_EXPIRY_HOURS = 24;

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state from localStorage if available
  const [currentView, _setCurrentView] = useState<View>(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        const expiryTime = new Date(session.expiresAt).getTime();
        if (Date.now() < expiryTime && session.view) {
          return session.view;
        }
      }
    } catch (e) {
      console.warn('Failed to load session:', e);
    }
    return 'onboarding';
  });

  const [participant, setParticipant] = useState<Participant | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        const expiryTime = new Date(session.expiresAt).getTime();
        if (Date.now() < expiryTime && session.participant) {
          return session.participant;
        }
      }
    } catch (e) {
      console.warn('Failed to load participant:', e);
    }
    return null;
  });

  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [onboardingPreferences, setOnboardingPreferences] = useState<{ flavors: string[], group: string } | null>(null);

  // Auth Hook - replaces hardcoded password
  const { isAdmin, isLoading: isAuthLoading, signIn, signOut } = useAuth();

  // Sommelier State
  const [isSommelierOrbOpen, setIsSommelierOrbOpen] = useState(false);
  const [isSommelierTextOpen, setIsSommelierTextOpen] = useState(false);
  const [isSommelierVoiceOpen, setIsSommelierVoiceOpen] = useState(false);

  // Global Error State
  const [supabaseError, setSupabaseError] = useState<SupabaseErrorDetails | null>(null);
  const clearSupabaseError = () => setSupabaseError(null);

  // Protected Route Redirect State
  const [loginRedirectView, setLoginRedirectView] = useState<View | null>(null);

  useEffect(() => {
    const handleError = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { table, operation, error, source } = customEvent.detail;

      // Log the error to the console with rich details, but only for the first occurrence.
      if (!supabaseError) {
        console.error(
          `--- SUPABASE ERROR ---\n` +
          `Source: ${source || 'a generic operation'}\n` +
          `Message: ${error.message}\n` +
          `Table: ${table}\n` +
          `Operation: ${operation}`
        );
        console.error("Full error object:", error);
      }

      // Check if it's an RLS/Auth error that we should show to the user.
      const isConfigError = error && (
        String(error.message).includes('401') ||
        String(error.message).includes('security policies') ||
        String(error.message).includes('Invalid API key') ||
        String(error.message).includes('violates row-level security policy')
      );

      // Display the UI notification only once for the first RLS error.
      if (isConfigError && !supabaseError) {
        setSupabaseError({
          table: table,
          operation: operation,
          message: error.message,
          details: error.details,
        });
      }
    };

    window.addEventListener('supabaseError', handleError);
    return () => window.removeEventListener('supabaseError', handleError);
  }, [supabaseError]);

  // Save session to localStorage whenever participant or view changes
  useEffect(() => {
    if (participant) {
      try {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);

        const session = {
          participant,
          view: currentView,
          expiresAt: expiresAt.toISOString(),
        };

        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        console.log('✅ Session saved to localStorage');
      } catch (e) {
        console.warn('Failed to save session:', e);
      }
    }
  }, [participant, currentView]);

  const setCurrentView = useCallback((view: View) => {
      trackInteraction('navigation', participant?.id ?? null, { from: currentView, to: view });
      _setCurrentView(view);
  }, [participant?.id, currentView]);


  const handleRegister = async (newParticipantData: Omit<Participant, 'id'>) => {
    const checkin = await startCheckin({
      checkinSlug: 'centro-nfc',
      name: newParticipantData.fullName,
      phone: newParticipantData.phone,
      instagram: newParticipantData.instagram,
      birthDate: newParticipantData.birthDate,
      partySize: 1,
      marketingConsent: newParticipantData.preferences?.marketingConsent === true,
      childParticipationConsent: false,
    });
    const registeredParticipant: Participant = {
      ...newParticipantData,
      id: String(checkin.client_id || ''),
    };
    if (!registeredParticipant.id) throw new Error('El registro no devolvió una identidad válida.');
    setParticipant(registeredParticipant);
    trackInteraction('registration_success', registeredParticipant.id, { source: 'arroko_secure_checkin' });
    if (spinResult && !spinResult.id) await saveSpinToDatabase(registeredParticipant, spinResult.prize);
    else setCurrentView('roulette');
  };

  const saveSpinToDatabase = async (participant: Participant, prize: Prize) => {
    const claim = await claimReward(prize.id);
    const claimId = String(claim.claim_id || '');
    if (!claimId) throw new Error('La recompensa no devolvió un código válido.');
    const updatedResult: SpinResult = {
      id: claimId,
      participant,
      prize,
      timestamp: new Date(),
      expires_at: claim.expires_at ? new Date(String(claim.expires_at)) : undefined,
      redeemed: false,
    };
    trackInteraction('spin_saved', participant.id, { prize_id: prize.id, claim_id: claimId, source: 'arroko_secure_claim' });
    setSpinResult(updatedResult);
    setCurrentView('winner');
  };

  const handleSpinFinish = async (prize: Prize) => {
    // NUEVO FLUJO: Guardar premio temporalmente sin participante
    // El registro se hará DESPUÉS en WinnerPage
    const tempResult: SpinResult = {
      id: '', // Se generará al registrarse
      participant: null as any, // Por ahora null
      prize,
      timestamp: new Date(),
      redeemed: false,
    };

    trackInteraction('spin_result', null, { prize_id: prize.id, prize_name: prize.name });
    setSpinResult(tempResult);
    setCurrentView('winner');
  };

  const handleRedeem = useCallback(async (code: string): Promise<{ success: boolean; message: string; prize?: Prize }> => {
    trackInteraction('redeem_attempt', participant?.id ?? null, { code });
    try {
      const result = await redeemReward(code.trim());
      const prize = PRIZES.find(p => p.id === result.reward_key);
      trackInteraction('redeem_success', participant?.id ?? null, { code, prize_id: prize?.id });
      return { success: true, message: '¡Premio canjeado con éxito!', prize };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al canjear el premio.';
      trackInteraction('redeem_failure', participant?.id ?? null, { code, reason: message });
      return { success: false, message };
    }
  }, [participant?.id]);

  const navigateToProtectedView = (view: View) => {
    if (isAdmin) {
      setCurrentView(view);
    } else {
      setLoginRedirectView(view);
      setCurrentView('admin-login');
    }
  };

  const handleAdminLogin = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const result = await signIn(email, password);

    if (result.success) {
      setCurrentView(loginRedirectView || 'whatsapp-dashboard');
      setLoginRedirectView(null);
    }

    return result;
  };

  const handleAdminLogout = async () => {
    await signOut();
    setLoginRedirectView(null);
    setCurrentView('register');
  };

  const reset = () => {
    setParticipant(null);
    setSpinResult(null);
    setCurrentView('onboarding');
    localStorage.removeItem(SESSION_KEY);
  };

  // --- Sommelier Methods ---
  const toggleSommelierOrb = () => setIsSommelierOrbOpen(prev => !prev);

  const openSommelierText = () => {
    trackInteraction('sommelier_text_open', participant?.id ?? null);
    setIsSommelierTextOpen(true);
    setIsSommelierOrbOpen(false); // Close menu
  };
  const closeSommelierText = () => setIsSommelierTextOpen(false);

  const openSommelierVoice = () => {
    trackInteraction('sommelier_voice_open', participant?.id ?? null);
    setIsSommelierVoiceOpen(true);
    setIsSommelierOrbOpen(false); // Close menu
  };
  const closeSommelierVoice = () => setIsSommelierVoiceOpen(false);

  const value = {
    currentView,
    participant,
    spinResult,
    isSommelierOrbOpen,
    isSommelierTextOpen,
    isSommelierVoiceOpen,
    isAdminAuthenticated: isAdmin,
    isAuthLoading,
    supabaseError,
    setCurrentView,
    handleRegister,
    handleSpinFinish,
    handleRedeem,
    handleAdminLogin,
    handleAdminLogout,
    reset,
    toggleSommelierOrb,
    openSommelierText,
    closeSommelierText,
    openSommelierVoice,
    closeSommelierVoice,
    navigateToProtectedView,
    clearSupabaseError,
    onboardingPreferences,
    setOnboardingPreferences,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
