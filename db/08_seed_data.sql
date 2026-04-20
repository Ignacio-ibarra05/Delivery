-- Insert people
INSERT INTO auth.people (rut, first_name, last_name, email, birth_date)
VALUES
('11.111.111-1', 'Juan',  'Cliente',    'cliente@test.cl',    '1995-05-10'),
('22.222.222-2', 'Pedro', 'Repartidor', 'repartidor@test.cl', '1990-03-20'),
('33.333.333-3', 'Ana',   'Admin',      'admin@test.cl',      '1985-07-15')
ON CONFLICT (email) DO NOTHING;

INSERT INTO auth.user (people_id, password)
SELECT id, '$2b$12$x3mzgvJt202FRyuXupnm8.uQCnh8PJq94W5bmjcbsagYd2VEtnl9q'
FROM auth.people WHERE email = 'cliente@test.cl'
ON CONFLICT DO NOTHING;

INSERT INTO auth.user (people_id, password)
SELECT id, '$2b$12$YHt.3/CyIarnaZrxhWvx5upMPG.n36aPXxLP0IBlZZDf76qj1wi4W'
FROM auth.people WHERE email = 'repartidor@test.cl'
ON CONFLICT DO NOTHING;

INSERT INTO auth.user (people_id, password)
SELECT id, '$2b$12$H7Nmdl8U2lPNrR0rQf6yUu36I3jT4pWC1ly6MKCaQck9.QBVsG7DK'
FROM auth.people WHERE email = 'admin@test.cl'
ON CONFLICT DO NOTHING;

-- Insert worker
INSERT INTO auth.worker (people_id, contract_date)
SELECT id, CURRENT_DATE
FROM auth.people WHERE email = 'repartidor@test.cl'
ON CONFLICT DO NOTHING;

-- Insert admin
INSERT INTO auth.admin (people_id)
SELECT id
FROM auth.people WHERE email = 'admin@test.cl'
ON CONFLICT DO NOTHING;

-- Insert products
INSERT INTO products.products (name, description, price)
VALUES
('Family Pizza',  'Family size pizza',  12990),
('Burger',        'Cheeseburger',        5990),
('Soda 1.5L',     'Carbonated soda',     2990)
ON CONFLICT DO NOTHING;
