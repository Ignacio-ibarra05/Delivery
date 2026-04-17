-- Coordenadas del trabajador al momento de aceptar el pedido
ALTER TABLE orders.orders
  ADD COLUMN IF NOT EXISTS trabajador_lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS trabajador_lng NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS sucursal_lat   NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS sucursal_lng   NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS cancelado_en   TIMESTAMP;