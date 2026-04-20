CREATE TABLE orders.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  worker_id UUID,
  state TEXT DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_order_user
    FOREIGN KEY (user_id)
    REFERENCES auth.user(id),

  CONSTRAINT fk_order_worker
    FOREIGN KEY (worker_id)
    REFERENCES auth.worker(id)
);

-- ORDER ITEMS
CREATE TABLE orders.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  product_id UUID NOT NULL,
  amount INT NOT NULL,

  CONSTRAINT fk_item_order
    FOREIGN KEY (order_id)
    REFERENCES orders.orders(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_item_product
    FOREIGN KEY (product_id)
    REFERENCES products.products(id)
);

-- ADDITIONAL COLUMNS for delivery and rating
ALTER TABLE orders.orders
  ADD COLUMN IF NOT EXISTS worker_lat  NUMERIC,
  ADD COLUMN IF NOT EXISTS worker_lng  NUMERIC,
  ADD COLUMN IF NOT EXISTS local_lat   NUMERIC,
  ADD COLUMN IF NOT EXISTS local_lng   NUMERIC,
  ADD COLUMN IF NOT EXISTS rating      SMALLINT CHECK (rating BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS delivery_at TIMESTAMP;
