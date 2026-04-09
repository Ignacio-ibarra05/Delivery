CREATE TABLE orders.order_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  trabajador_id UUID NOT NULL,
  estado TEXT DEFAULT 'PENDIENTE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notification_order
    FOREIGN KEY (order_id)
    REFERENCES orders.orders(id),

  CONSTRAINT fk_notification_trabajador
    FOREIGN KEY (trabajador_id)
    REFERENCES auth.trabajadores(id)
);