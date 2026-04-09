CREATE INDEX idx_personas_email ON auth.personas(email);
CREATE INDEX idx_orders_usuario ON orders.orders(usuario_id);
CREATE INDEX idx_orders_trabajador ON orders.orders(trabajador_id);
CREATE INDEX idx_notify_trabajador ON orders.order_notifications(trabajador_id);
