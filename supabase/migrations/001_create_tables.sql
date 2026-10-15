-- =============================================
-- SPOTLESS — Phase 1 Database Schema
-- =============================================

-- 1. Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  type TEXT DEFAULT 'conciergerie',
  payment_method TEXT DEFAULT 'cash',
  payment_frequency TEXT DEFAULT 'bi_mensuel',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Apartments
CREATE TABLE apartments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  neighborhood TEXT,
  type TEXT NOT NULL,
  bedrooms INTEGER DEFAULT 1,
  price_menage DECIMAL(10,2) NOT NULL,
  cost_femme DECIMAL(10,2),
  cost_transport DECIMAL(10,2),
  cost_produits DECIMAL(10,2),
  cost_pressing DECIMAL(10,2) DEFAULT 0,
  access_type TEXT,
  access_code TEXT,
  access_notes TEXT,
  wifi_name TEXT,
  wifi_password TEXT,
  has_machine_laver BOOLEAN DEFAULT false,
  has_aspirateur BOOLEAN DEFAULT false,
  client_provides_products BOOLEAN DEFAULT false,
  client_provides_linen BOOLEAN DEFAULT false,
  linen_service TEXT DEFAULT 'none',
  pressing_contact TEXT,
  special_instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Cleaners
CREATE TABLE cleaners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  neighborhood TEXT,
  base_rate_studio DECIMAL(10,2) DEFAULT 80,
  base_rate_2ch DECIMAL(10,2) DEFAULT 100,
  base_rate_3ch DECIMAL(10,2) DEFAULT 120,
  prime_qualite DECIMAL(10,2) DEFAULT 20,
  payment_day TEXT DEFAULT 'jeudi',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Turnovers
CREATE TABLE turnovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
  cleaner_id UUID REFERENCES cleaners(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time_start TIME,
  time_end TIME,
  guest_checkout DATE,
  guest_checkin DATE,
  checkin_time TIME,
  status TEXT DEFAULT 'planifie',
  revenue DECIMAL(10,2),
  cost_femme DECIMAL(10,2),
  cost_transport DECIMAL(10,2),
  cost_produits DECIMAL(10,2),
  cost_pressing DECIMAL(10,2) DEFAULT 0,
  cost_other DECIMAL(10,2) DEFAULT 0,
  cost_other_label TEXT,
  quality_rating INTEGER,
  quality_notes TEXT,
  has_anomalies BOOLEAN DEFAULT false,
  anomalies_text TEXT,
  is_paid_by_client BOOLEAN DEFAULT false,
  client_paid_date DATE,
  is_paid_to_cleaner BOOLEAN DEFAULT false,
  cleaner_paid_date DATE,
  cleaner_got_prime BOOLEAN DEFAULT false,
  notes TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Row Level Security (single-user app)
-- =============================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaners ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnovers ENABLE ROW LEVEL SECURITY;

-- Allow all for authenticated user
CREATE POLICY "Allow all for authenticated" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON apartments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON cleaners FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON turnovers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- Updated_at trigger
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER apartments_updated_at BEFORE UPDATE ON apartments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER cleaners_updated_at BEFORE UPDATE ON cleaners FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER turnovers_updated_at BEFORE UPDATE ON turnovers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- Seed Data
-- =============================================

-- Clients
INSERT INTO clients (id, name, contact_name, phone, type, payment_method, payment_frequency, notes) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Ayoub Immobilino', 'Ayoub', '+212 600-000001', 'conciergerie', 'cash', 'bi_mensuel', '12 apparts, 5 ans d''expérience, paiement cash bi-hebdo (jeudi)'),
  ('a1000000-0000-0000-0000-000000000002', 'Prime Residency SARL', 'Francois', '+212 600-000002', 'conciergerie', 'virement', 'bi_mensuel', 'Conciergerie haut de gamme, système Node'),
  ('a1000000-0000-0000-0000-000000000003', 'Robin', 'Robin', '+212 600-000003', 'host_individuel', 'wise', 'mensuel', '1 appart M29 + 1 en construction'),
  ('a1000000-0000-0000-0000-000000000004', 'Mhamed Hamaras', 'Mhamed', '+212 600-000004', 'host_individuel', 'cash', 'immediat', '1 appart 2ch Hivernage'),
  ('a1000000-0000-0000-0000-000000000005', 'NEXELLA Conciergerie', 'Redouane', '+212 600-000005', 'conciergerie', 'airbnb_rib', 'bi_mensuel', '3 apparts à venir');

-- Apartments (Ayoub)
INSERT INTO apartments (client_id, name, type, bedrooms, price_menage, cost_femme, cost_transport, cost_produits, neighborhood, client_provides_products) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Pearl n26', 'studio', 1, 180, 90, 15, 0, 'Guéliz', true),
  ('a1000000-0000-0000-0000-000000000001', 'Earl n27', 'studio', 1, 180, 90, 15, 0, 'Guéliz', true),
  ('a1000000-0000-0000-0000-000000000001', 'Strive A C2/10', 'studio', 1, 180, 90, 15, 0, 'Guéliz', true),
  ('a1000000-0000-0000-0000-000000000001', 'Trive A C3/06', 'studio', 1, 180, 90, 15, 0, 'Guéliz', true),
  ('a1000000-0000-0000-0000-000000000001', 'Trive B B3/1', 'studio', 1, 180, 90, 15, 0, 'Guéliz', true),
  ('a1000000-0000-0000-0000-000000000001', 'Bureau 33', 'studio', 1, 180, 90, 15, 0, 'Guéliz', true),
  ('a1000000-0000-0000-0000-000000000001', 'Alios 40', '2ch', 2, 220, 110, 15, 0, 'Guéliz', true),
  ('a1000000-0000-0000-0000-000000000001', 'Alios 17', '2ch', 2, 220, 110, 15, 0, 'Guéliz', true),
  ('a1000000-0000-0000-0000-000000000001', 'Palace B N24', '2ch', 2, 220, 110, 15, 0, 'Guéliz', true),
  ('a1000000-0000-0000-0000-000000000001', 'Sloe A M22', 'studio', 1, 180, 90, 15, 0, 'Guéliz', true),
  ('a1000000-0000-0000-0000-000000000001', '61/07', 'studio', 1, 180, 90, 15, 0, 'Guéliz', true),
  ('a1000000-0000-0000-0000-000000000001', '160/04', 'studio', 1, 180, 90, 15, 0, 'Guéliz', true);

-- Apartments (Others)
INSERT INTO apartments (client_id, name, type, bedrooms, price_menage, cost_femme, cost_transport, cost_produits, neighborhood, address, access_type, access_notes) VALUES
  ('a1000000-0000-0000-0000-000000000002', 'Mbrouka', '2ch', 2, 300, 100, 20, 15, 'Route de Casa', 'Route de Casa', 'code', 'Tout compris: ménage+linge+produits+photos'),
  ('a1000000-0000-0000-0000-000000000002', 'Villa 8ch', 'villa', 8, 2000, 500, 50, 50, 'Sidi Abdellah Ghiat', 'Sidi Abdellah Ghiat', 'cle_gardien', 'Villa haut de gamme'),
  ('a1000000-0000-0000-0000-000000000002', 'Appart Targa', '2ch', 2, 300, 100, 20, 15, 'Targa', 'Targa', 'code', NULL),
  ('a1000000-0000-0000-0000-000000000003', 'M29', '2ch', 2, 250, 100, 15, 15, 'Guéliz', 'Résidence Menara Garden, M29', 'cle_sous_tapis', 'Clé sous tapis entrée'),
  ('a1000000-0000-0000-0000-000000000004', 'Appart Hivernage', '2ch', 2, 250, 100, 15, 15, 'Hivernage', 'Hivernage', 'code', NULL);

-- Cleaners
INSERT INTO cleaners (name, phone, neighborhood, base_rate_studio, base_rate_2ch, base_rate_3ch, prime_qualite, notes) VALUES
  ('Amal', '+212 700-000001', 'Guéliz', 90, 110, 130, 20, 'Active, fait turnovers Ayoub/Immobilino'),
  ('Souad', '+212 773-869676', 'Massira 3', 80, 100, 120, 20, 'Disponible week-end');

-- Sample turnovers (today and upcoming)
INSERT INTO turnovers (apartment_id, cleaner_id, date, time_start, status, revenue, cost_femme, cost_transport, cost_produits, source)
SELECT
  a.id, c.id, CURRENT_DATE, '09:00', 'planifie', a.price_menage, a.cost_femme, a.cost_transport, a.cost_produits, 'manual'
FROM apartments a
CROSS JOIN (SELECT id FROM cleaners WHERE name = 'Amal' LIMIT 1) c
WHERE a.name = 'Pearl n26'
LIMIT 1;

INSERT INTO turnovers (apartment_id, cleaner_id, date, time_start, status, revenue, cost_femme, cost_transport, cost_produits, source)
SELECT
  a.id, c.id, CURRENT_DATE, '14:00', 'assigne', a.price_menage, a.cost_femme, a.cost_transport, a.cost_produits, 'manual'
FROM apartments a
CROSS JOIN (SELECT id FROM cleaners WHERE name = 'Souad' LIMIT 1) c
WHERE a.name = 'Mbrouka'
LIMIT 1;

INSERT INTO turnovers (apartment_id, date, time_start, status, revenue, cost_femme, cost_transport, cost_produits, source)
SELECT
  a.id, CURRENT_DATE + 1, '10:00', 'planifie', a.price_menage, a.cost_femme, a.cost_transport, a.cost_produits, 'manual'
FROM apartments a
WHERE a.name = 'M29'
LIMIT 1;
