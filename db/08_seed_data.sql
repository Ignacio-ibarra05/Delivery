-- Insertar Personas
INSERT INTO auth.personas (rut, nombre, apellidos, email, fecha_nacimiento)
VALUES
('11.111.111-1', 'Juan',  'Cliente',    'cliente@test.cl',    '1995-05-10'),
('22.222.222-2', 'Pedro', 'Repartidor', 'repartidor@test.cl', '1990-03-20'),
('33.333.333-3', 'Ana',   'Admin',      'admin@test.cl',      '1985-07-15')
ON CONFLICT (email) DO NOTHING;

-- Insertar Usuarios (todos necesitan registro en auth.usuarios para poder autenticarse)
INSERT INTO auth.usuarios (persona_id, password)
SELECT id, 'cliente123'
FROM auth.personas WHERE email = 'cliente@test.cl'
ON CONFLICT DO NOTHING;

INSERT INTO auth.usuarios (persona_id, password)
SELECT id, 'repartidor123'
FROM auth.personas WHERE email = 'repartidor@test.cl'
ON CONFLICT DO NOTHING;

INSERT INTO auth.usuarios (persona_id, password)
SELECT id, 'admin123'
FROM auth.personas WHERE email = 'admin@test.cl'
ON CONFLICT DO NOTHING;

-- Insertar Trabajadores
INSERT INTO auth.trabajadores (persona_id, fecha_contratacion)
SELECT id, CURRENT_DATE
FROM auth.personas WHERE email = 'repartidor@test.cl'
ON CONFLICT DO NOTHING;

-- Insertar Administradores
INSERT INTO auth.administradores (persona_id)
SELECT id
FROM auth.personas WHERE email = 'admin@test.cl'
ON CONFLICT DO NOTHING;

-- Insertar Productos
INSERT INTO products.products (nombre, descripcion, precio)
VALUES
('Pizza Familiar', 'Pizza tamaño familiar', 12990),
('Hamburguesa',    'Hamburguesa con queso', 5990),
('Bebida 1.5L',    'Bebida gaseosa',        2990)
ON CONFLICT DO NOTHING;

-- Insertar Pedido de prueba (PENDIENTE para que aparezca en la vista del repartidor)
WITH nuevo_pedido AS (
  INSERT INTO orders.orders (usuario_id, estado)
  SELECT u.id, 'PENDIENTE'
  FROM auth.usuarios u
  JOIN auth.personas p ON p.id = u.persona_id
  WHERE p.email = 'cliente@test.cl'
  RETURNING id
)
INSERT INTO orders.order_items (order_id, product_id, cantidad)
SELECT np.id, pr.id, 2
FROM nuevo_pedido np
CROSS JOIN (SELECT id FROM products.products WHERE nombre = 'Pizza Familiar' LIMIT 1) pr;
