export default async function orderRoutes(app) {

  // ──────────────────────────────────────────────────────
  // PRODUCTS (all authenticated roles)
  // GET /productos
  // ──────────────────────────────────────────────────────
  app.get("/productos", async (req, reply) => {
    const result = await app.pg.query(
      "SELECT id, name, description, price FROM products.products WHERE active = true ORDER BY name"
    );
    reply.send(result.rows);
  });

  // ──────────────────────────────────────────────────────
  // CLIENT
  // POST /delivery            → creates an order with its items
  // GET  /delivery/mi-activo  → active order of CLIENT (PENDING or EN_ROUTE)
  // DELETE /delivery/:id      → CLIENT cancels their order (only if PENDING)
  // ──────────────────────────────────────────────────────
  app.post("/delivery", async (req, reply) => {
    const userId = req.headers["x-user-id"];
    const { items } = req.body; // [{ product_id, amount }]

    if (!items || items.length === 0) {
      return reply.code(400).send({ error: "The order must have at least one product" });
    }

    const client = await app.pg.connect();
    try {
      await client.query("BEGIN");

      const orderRes = await client.query(
        "INSERT INTO orders.orders (user_id, state) VALUES ($1, 'PENDING') RETURNING id",
        [userId]
      );
      const orderId = orderRes.rows[0].id;

      for (const item of items) {
        await client.query(
          "INSERT INTO orders.order_items (order_id, product_id, amount) VALUES ($1, $2, $3)",
          [orderId, item.product_id, item.amount]
        );
      }

      await client.query("COMMIT");
      reply.code(201).send({ id: orderId, state: "PENDING" });
    } catch (err) {
      await client.query("ROLLBACK");
      reply.code(500).send({ error: "Error creating the order" });
    } finally {
      client.release();
    }
  });

  app.get("/delivery/mi-activo", async (req, reply) => {
    const userId = req.headers["x-user-id"];

    const result = await app.pg.query(`
      SELECT
        o.id,
        o.state,
        o.created_at,
        o.worker_lat,
        o.worker_lng,
        o.local_lat,
        o.local_lng,
        json_agg(
          json_build_object(
            'name',   pr.name,
            'amount', oi.amount,
            'price',  pr.price
          )
        ) AS items
      FROM orders.orders o
      LEFT JOIN orders.order_items oi ON oi.order_id = o.id
      LEFT JOIN products.products pr ON pr.id = oi.product_id
      WHERE o.user_id = $1
        AND o.state IN ('PENDING', 'EN_ROUTE')
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 1
    `, [userId]);

    if (result.rows.length === 0) return reply.send(null);
    reply.send(result.rows[0]);
  });

  app.delete("/delivery/:id", async (req, reply) => {
    const userId = req.headers["x-user-id"];
    const { id } = req.params;

    const check = await app.pg.query(
      "SELECT state, user_id FROM orders.orders WHERE id = $1",
      [id]
    );

    if (check.rows.length === 0)
      return reply.code(404).send({ error: "Order not found" });

    const order = check.rows[0];

    if (order.user_id !== userId)
      return reply.code(403).send({ error: "Unauthorized" });

    if (order.state !== "PENDING")
      return reply.code(409).send({
        error: "The order has already been taken by a worker and cannot be cancelled",
      });

    await app.pg.query(
      "UPDATE orders.orders SET state = 'CANCELLED', canceled_at = NOW() WHERE id = $1",
      [id]
    );

    reply.send({ ok: true });
  });

  // ──────────────────────────────────────────────────────
  // WORKER
  // GET   /delivery/pendientes   → lists orders without assigned worker
  // PATCH /delivery/:id/aceptar  → worker takes the order (saves coords)
  // ──────────────────────────────────────────────────────
  app.get("/delivery/pendientes", async (req, reply) => {
    const result = await app.pg.query(`
      SELECT
        o.id,
        o.state,
        o.created_at,
        p.email AS client_email,
        json_agg(
          json_build_object(
            'name',   pr.name,
            'amount', oi.amount,
            'price',  pr.price
          )
        ) AS items
      FROM orders.orders o
      JOIN auth.user u ON u.id = o.user_id
      JOIN auth.people p ON p.id = u.people_id
      LEFT JOIN orders.order_items oi ON oi.order_id = o.id
      LEFT JOIN products.products pr ON pr.id = oi.product_id
      WHERE o.state = 'PENDING'
        AND o.worker_id IS NULL
      GROUP BY o.id, p.email
      ORDER BY o.created_at ASC
    `);
    reply.send(result.rows);
  });

  app.patch("/delivery/:id/aceptar", async (req, reply) => {
    const userId = req.headers["x-user-id"];
    const { id } = req.params;

    if (!userId) {
      return reply.code(401).send({ error: "User not authenticated" });
    }

    // Worker and local coordinates sent from the frontend
    const { worker_lat, worker_lng, local_lat, local_lng } = req.body || {};

    const client = await app.pg.connect();
    try {
      await client.query("BEGIN");

      const tRes = await client.query(
        `SELECT t.id AS worker_id
         FROM auth.worker t
         JOIN auth.user u ON u.people_id = t.people_id
         WHERE u.id = $1
           AND t.state = true`,
        [userId]
      );

      if (tRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return reply.code(403).send({ error: "You are not a registered worker or your account is inactive" });
      }

      const realWorkerId = tRes.rows[0].worker_id;

      const checkRes = await client.query(
        "SELECT id, state, worker_id FROM orders.orders WHERE id = $1",
        [id]
      );

      if (checkRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "Order not found" });
      }

      const order = checkRes.rows[0];

      if (order.state !== "PENDING" || order.worker_id !== null) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "The order has already been taken by another worker" });
      }

      const result = await client.query(
        `UPDATE orders.orders
         SET worker_id  = $1,
             state      = 'EN_ROUTE',
             worker_lat = $3,
             worker_lng = $4,
             local_lat  = $5,
             local_lng  = $6
         WHERE id = $2
         RETURNING id, state, worker_id`,
        [
          realWorkerId, id,
          worker_lat ?? null, worker_lng ?? null,
          local_lat  ?? null, local_lng  ?? null,
        ]
      );

      await client.query("COMMIT");
      reply.send(result.rows[0]);

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error accepting order:", err);
      reply.code(500).send({ error: "Internal error accepting the order", detail: err.message });
    } finally {
      client.release();
    }
  });

  // ──────────────────────────────────────────────────────
  // WORKER: mark order as delivered
  // PATCH /delivery/:id/entregar
  // ──────────────────────────────────────────────────────
  app.patch("/delivery/:id/entregar", async (req, reply) => {
    const userId = req.headers["x-user-id"];
    const { id } = req.params;

    if (!userId) {
      return reply.code(401).send({ error: "User not authenticated" });
    }

    const client = await app.pg.connect();
    try {
      await client.query("BEGIN");

      // Verify the user is an active worker
      const tRes = await client.query(
        `SELECT t.id AS worker_id
         FROM auth.worker t
         JOIN auth.user u ON u.people_id = t.people_id
         WHERE u.id = $1 AND t.state = true`,
        [userId]
      );

      if (tRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return reply.code(403).send({ error: "You are not a registered worker or your account is inactive" });
      }

      const realWorkerId = tRes.rows[0].worker_id;

      // Verify the order exists, is EN_ROUTE and belongs to this worker
      const checkRes = await client.query(
        "SELECT id, state, worker_id FROM orders.orders WHERE id = $1",
        [id]
      );

      if (checkRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "Order not found" });
      }

      const order = checkRes.rows[0];

      if (order.state !== "EN_ROUTE") {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "The order is not en route" });
      }

      if (order.worker_id !== realWorkerId) {
        await client.query("ROLLBACK");
        return reply.code(403).send({ error: "This order does not belong to you" });
      }

      const result = await client.query(
        `UPDATE orders.orders
         SET state = 'DELIVERED', delivery_at = NOW()
         WHERE id = $1
         RETURNING id, state`,
        [id]
      );

      await client.query("COMMIT");
      reply.send(result.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error delivering order:", err);
      reply.code(500).send({ error: "Internal error delivering the order", detail: err.message });
    } finally {
      client.release();
    }
  });

  // ──────────────────────────────────────────────────────
  // CLIENT: rate delivered order
  // PATCH /delivery/:id/puntuar
  // ──────────────────────────────────────────────────────
  app.patch("/delivery/:id/puntuar", async (req, reply) => {
    const userId = req.headers["x-user-id"];
    const { id } = req.params;
    const { rating } = req.body || {};

    if (!userId) {
      return reply.code(401).send({ error: "User not authenticated" });
    }

    // rating can be null (no rating given) or a number 0-5
    if (rating !== null && rating !== undefined && (rating < 0 || rating > 5)) {
      return reply.code(400).send({ error: "Rating must be between 0 and 5" });
    }

    const check = await app.pg.query(
      "SELECT state, user_id FROM orders.orders WHERE id = $1",
      [id]
    );

    if (check.rows.length === 0) {
      return reply.code(404).send({ error: "Order not found" });
    }

    const order = check.rows[0];

    if (order.user_id !== userId) {
      return reply.code(403).send({ error: "This order does not belong to you" });
    }

    if (order.state !== "DELIVERED") {
      return reply.code(409).send({ error: "Only delivered orders can be rated" });
    }

    await app.pg.query(
      "UPDATE orders.orders SET rating = $1 WHERE id = $2",
      [rating ?? null, id]
    );

    reply.send({ ok: true });
  });

  // ──────────────────────────────────────────────────────
  // CLIENT: recently delivered order (to show rating screen)
  // GET /delivery/mi-entregado
  // ──────────────────────────────────────────────────────
  app.get("/delivery/mi-entregado", async (req, reply) => {
    const userId = req.headers["x-user-id"];

    const result = await app.pg.query(`
      SELECT id, state, delivery_at, rating
      FROM orders.orders
      WHERE user_id = $1
        AND state = 'DELIVERED'
        AND rating IS NULL
        AND delivery_at > NOW() - INTERVAL '10 minutes'
      ORDER BY delivery_at DESC
      LIMIT 1
    `, [userId]);

    if (result.rows.length === 0) return reply.send(null);
    reply.send(result.rows[0]);
  });

  // ──────────────────────────────────────────────────────
  // ADMIN
  // GET /admin/user
  // GET /admin/worker
  // GET /admin/delivery
  // ──────────────────────────────────────────────────────
  app.get("/admin/user", async (req, reply) => {
    const result = await app.pg.query(`
      SELECT
        p.first_name,
        p.last_name,
        p.email,
        p.rut,
        u.state,
        u.created_at
      FROM auth.user u
      JOIN auth.people p ON p.id = u.people_id
      ORDER BY u.created_at DESC
    `);
    reply.send(result.rows);
  });

  app.get("/admin/worker", async (req, reply) => {
    const result = await app.pg.query(`
      SELECT
        p.first_name,
        p.last_name,
        p.email,
        p.rut,
        t.available,
        t.state,
        t.contract_date
      FROM auth.worker t
      JOIN auth.people p ON p.id = t.people_id
      ORDER BY p.first_name ASC
    `);
    reply.send(result.rows);
  });

  app.get("/admin/delivery", async (req, reply) => {
    const result = await app.pg.query(`
      SELECT
        o.id,
        o.state,
        o.created_at,
        pc.email AS client_email,
        pt.email AS worker_email
      FROM orders.orders o
      JOIN auth.user u ON u.id = o.user_id
      JOIN auth.people pc ON pc.id = u.people_id
      LEFT JOIN auth.worker t ON t.id = o.worker_id
      LEFT JOIN auth.people pt ON pt.id = t.people_id
      ORDER BY o.created_at DESC
    `);
    reply.send(result.rows);
  });

  // ── ADMIN: delete order ──
  app.delete("/admin/delivery/:id", async (req, reply) => {
    if (req.headers["x-user-rol"] !== "ADMIN")
      return reply.code(403).send({ error: "Only administrators can delete orders" });
    const { id } = req.params;
    const check = await app.pg.query("SELECT id FROM orders.orders WHERE id = $1", [id]);
    if (check.rows.length === 0) return reply.code(404).send({ error: "Order not found" });
    await app.pg.query("DELETE FROM orders.orders WHERE id = $1", [id]);
    reply.send({ ok: true, message: "Order deleted successfully" });
  });

  // ── ADMIN: delete user by email ──
  app.delete("/admin/user/:email", async (req, reply) => {
    if (req.headers["x-user-rol"] !== "ADMIN")
      return reply.code(403).send({ error: "Only administrators can delete users" });
    const { email } = req.params;

    const peopleRes = await app.pg.query("SELECT id FROM auth.people WHERE email = $1", [email]);
    if (peopleRes.rows.length === 0) return reply.code(404).send({ error: "User not found" });
    const peopleId = peopleRes.rows[0].id;

    const userRes = await app.pg.query("SELECT id FROM auth.user WHERE people_id = $1", [peopleId]);
    if (userRes.rows.length === 0) return reply.code(404).send({ error: "User not found" });
    const userId = userRes.rows[0].id;

    const isAdmin = await app.pg.query("SELECT id FROM auth.admin WHERE people_id = $1", [peopleId]);
    if (isAdmin.rows.length > 0)
      return reply.code(403).send({ error: "Cannot delete an administrator" });

    const client = await app.pg.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM orders.orders WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM auth.worker WHERE people_id = $1", [peopleId]);
      await client.query("DELETE FROM auth.user WHERE people_id = $1", [peopleId]);
      await client.query("DELETE FROM auth.people WHERE id = $1", [peopleId]);
      await client.query("COMMIT");
      reply.send({ ok: true, message: "User deleted successfully" });
    } catch (err) {
      await client.query("ROLLBACK");
      reply.code(500).send({ error: "Internal error deleting the user", detail: err.message });
    } finally {
      client.release();
    }
  });
}
