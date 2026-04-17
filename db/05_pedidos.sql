CREATE TABLE orders.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL,
  trabajador_id UUID,
  estado TEXT DEFAULT 'PENDIENTE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_order_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES auth.usuarios(id),

  CONSTRAINT fk_order_trabajador
    FOREIGN KEY (trabajador_id)
    REFERENCES auth.trabajadores(id)
);

-- DETALLE DEL PEDIDO
CREATE TABLE orders.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  product_id UUID NOT NULL,
  cantidad INT NOT NULL,

  CONSTRAINT fk_item_order
    FOREIGN KEY (order_id)
    REFERENCES orders.orders(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_item_product
    FOREIGN KEY (product_id)
    REFERENCES products.products(id)
);

-- COLUMNAS ADICIONALES para entrega y puntuación
ALTER TABLE orders.orders
  ADD COLUMN IF NOT EXISTS trabajador_lat  NUMERIC,
  ADD COLUMN IF NOT EXISTS trabajador_lng  NUMERIC,
  ADD COLUMN IF NOT EXISTS sucursal_lat    NUMERIC,
  ADD COLUMN IF NOT EXISTS sucursal_lng    NUMERIC,
  ADD COLUMN IF NOT EXISTS rating          SMALLINT CHECK (rating BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS entregado_at    TIMESTAMP;
