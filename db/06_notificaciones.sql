CREATE TABLE orders.order_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  state TEXT DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notification_order
    FOREIGN KEY (order_id)
    REFERENCES orders.orders(id),

  CONSTRAINT fk_notification_worker
    FOREIGN KEY (worker_id)
    REFERENCES auth.worker(id)
);
