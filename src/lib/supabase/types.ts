export interface Client {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  type: 'conciergerie' | 'host_individuel' | 'agence';
  payment_method: 'cash' | 'virement' | 'wise' | 'airbnb_rib';
  payment_frequency: 'immediat' | 'hebdo' | 'bi_mensuel' | 'mensuel';
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Apartment {
  id: string;
  client_id: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  type: 'studio' | '1ch' | '2ch' | '3ch' | 'villa';
  bedrooms: number;
  price_menage: number;
  cost_femme: number | null;
  cost_transport: number | null;
  cost_produits: number | null;
  cost_pressing: number | null;
  access_type: string | null;
  access_code: string | null;
  access_notes: string | null;
  wifi_name: string | null;
  wifi_password: string | null;
  has_machine_laver: boolean;
  has_aspirateur: boolean;
  client_provides_products: boolean;
  client_provides_linen: boolean;
  linen_service: 'none' | 'swap_only' | 'pressing_included' | 'pressing_extra';
  pressing_contact: string | null;
  special_instructions: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  client?: Client;
}

export interface Cleaner {
  id: string;
  name: string;
  phone: string | null;
  neighborhood: string | null;
  base_rate_studio: number;
  base_rate_2ch: number;
  base_rate_3ch: number;
  prime_qualite: number;
  payment_day: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Turnover {
  id: string;
  apartment_id: string;
  cleaner_id: string | null;
  date: string;
  time_start: string | null;
  time_end: string | null;
  guest_checkout: string | null;
  guest_checkin: string | null;
  checkin_time: string | null;
  status: 'planifie' | 'assigne' | 'en_cours' | 'termine' | 'verifie' | 'annule';
  revenue: number | null;
  cost_femme: number | null;
  cost_transport: number | null;
  cost_produits: number | null;
  cost_pressing: number | null;
  cost_other: number | null;
  cost_other_label: string | null;
  quality_rating: number | null;
  quality_notes: string | null;
  has_anomalies: boolean;
  anomalies_text: string | null;
  is_paid_by_client: boolean;
  client_paid_date: string | null;
  is_paid_to_cleaner: boolean;
  cleaner_paid_date: string | null;
  cleaner_got_prime: boolean;
  notes: string | null;
  source: 'manual' | 'node';
  created_at: string;
  updated_at: string;
  // Joined
  apartment?: Apartment & { client?: Client };
  cleaner?: Cleaner;
}

export interface Database {
  public: {
    Tables: {
      clients: { Row: Client; Insert: Omit<Client, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Client> };
      apartments: { Row: Apartment; Insert: Omit<Apartment, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Apartment> };
      cleaners: { Row: Cleaner; Insert: Omit<Cleaner, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Cleaner> };
      turnovers: { Row: Turnover; Insert: Omit<Turnover, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Turnover> };
    };
  };
}
