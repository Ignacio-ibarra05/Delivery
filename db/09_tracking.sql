-- Worker coordinates at the time of accepting the order
ALTER TABLE orders.orders
  ADD COLUMN IF NOT EXISTS worker_lat  NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS worker_lng  NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS local_lat   NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS local_lng   NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP;
