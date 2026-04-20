CREATE INDEX idx_people_email ON auth.people(email);
CREATE INDEX idx_orders_user ON orders.orders(user_id);
CREATE INDEX idx_orders_worker ON orders.orders(worker_id);
CREATE INDEX idx_notify_worker ON orders.order_notifications(worker_id);
