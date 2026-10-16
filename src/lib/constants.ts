// Status values and labels
// Simplified: À faire → Fait (old statuses kept for DB compatibility)
export const TURNOVER_STATUSES = {
  planifie: { label: 'À faire', color: 'bg-status-planifie', textColor: 'text-white' },
  assigne: { label: 'À faire', color: 'bg-status-planifie', textColor: 'text-white' },
  en_cours: { label: 'En cours', color: 'bg-status-en-cours', textColor: 'text-white' },
  termine: { label: 'Fait', color: 'bg-status-termine', textColor: 'text-white' },
  verifie: { label: 'Fait', color: 'bg-status-verifie', textColor: 'text-white' },
  annule: { label: 'Annulé', color: 'bg-status-annule', textColor: 'text-white' },
} as const;

export type TurnoverStatus = keyof typeof TURNOVER_STATUSES;

// Simplified flow: À faire → Fait (one click)
export const STATUS_TRANSITIONS: Record<TurnoverStatus, TurnoverStatus | null> = {
  planifie: 'verifie',
  assigne: 'verifie',
  en_cours: 'verifie',
  termine: null,
  verifie: null,
  annule: null,
};

export const APARTMENT_TYPES = [
  { value: 'studio', label: 'Studio' },
  { value: '1ch', label: '1 Chambre' },
  { value: '2ch', label: '2 Chambres' },
  { value: '3ch', label: '3 Chambres' },
  { value: 'villa', label: 'Villa' },
] as const;

export const CLIENT_TYPES = [
  { value: 'conciergerie', label: 'Conciergerie' },
  { value: 'host_individuel', label: 'Hôte individuel' },
  { value: 'agence', label: 'Agence' },
] as const;

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'virement', label: 'Virement' },
  { value: 'wise', label: 'Wise' },
  { value: 'airbnb_rib', label: 'Airbnb RIB' },
] as const;

export const PAYMENT_FREQUENCIES = [
  { value: 'immediat', label: 'Immédiat' },
  { value: 'hebdo', label: 'Hebdomadaire' },
  { value: 'bi_mensuel', label: 'Bi-mensuel' },
  { value: 'mensuel', label: 'Mensuel' },
] as const;

export const ACCESS_TYPES = [
  { value: 'code', label: 'Code' },
  { value: 'cle_boite', label: 'Clé boîte' },
] as const;

export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: 'Home' },
  { href: '/turnovers', label: 'Turnovers', icon: 'Calendar' },
  { href: '/clients', label: 'Clients', icon: 'Users' },
  { href: '/appartements', label: 'Appartements', icon: 'Building2' },
  { href: '/cleaners', label: 'Équipe', icon: 'Sparkles' },
] as const;
