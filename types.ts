export type View =
  | "onboarding"
  | "invite"
  | "register"
  | "roulette"
  | "winner"
  | "redeem"
  | "admin"
  | "admin-login"
  | "whatsapp-dashboard"
  | "sommelieria"
  | "arrokids"
  | "checkin"
  | "terms"
  | "privacy";

export interface Prize {
  id: string;
  name: string;
  probability_weight: number;
  color: string;
  icon: string;
}

export interface Participant {
  id: string;
  fullName: string;
  instagram: string;
  phone: string;
  birthDate: string;
  termsAcceptedAt?: string;
  termsVersion?: string;
  preferences?: {
    flavors: string[];
    group: string;
    marketingConsent?: boolean;
    marketingConsentAt?: string;
  };
}

export interface SpinResult {
  id: string;
  participant: Participant;
  prize: Prize;
  timestamp: Date;
  expires_at?: Date;
  redeemed: boolean;
}
