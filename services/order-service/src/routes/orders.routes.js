export default async function orderRoutes(app) {

  // ──────────────────────────────────────────────────────
  // PRODUCTOS (todos los roles autenticados)
  // GET /productos
  // ──────────────────────────────────────────────────────
  app.get("/productos", async (req, reply) => {
    const result = await app.pg.query(
      "SELECT id, nombre, descripcion, precio FROM products.products WHERE activo = true ORDER BY nombre"
    );
    reply.send(result.rows);
  });

  // ──────────────────────────────────────────────────────
  // CLIENTE
  // POST /pedidos            → crea un pedido con sus items
  // GET  /pedidos/mi-activo  → pedido activo del cliente (PENDIENTE o EN_CAMINO)
  // DELETE /pedidos/:id      → cliente cancela su pedido (solo si PENDIENTE)
  // ──────────────────────────────────────────────────────
  app.post("/pedidos", async (req, reply) => {
    const usuarioId = req.headers["x-user-id"];
    const { items } = req.body; // [{ product_id, cantidad }]

    if (!items || items.length === 0) {
      return reply.code(400).send({ error: "El pedido debe tener al menos un producto" });
    }

    const client = await app.pg.connect();
    try {
      await client.query("BEGIN");

      const orderRes = await client.query(
        "INSERT INTO orders.orders (usuario_id, estado) VALUES ($1, 'PENDIENTE') RETURNING id",
        [usuarioId]
      );
      const orderId = orderRes.rows[0].id;

      for (const item of items) {
        await client.query(
          "INSERT INTO orders.order_items (order_id, product_id, cantidad) VALUES ($1, $2, $3)",
          [orderId, item.product_id, item.cantidad]
        );
      }

      await client.query("COMMIT");
      reply.code(201).send({ id: orderId, estado: "PENDIENTE" });
    } catch (err) {
      await client.query("ROLLBACK");
      reply.code(500).send({ error: "Error al crear el pedido" });
    } finally {
      client.release();
    }
  });

  app.get("/pedidos/mi-activo", async (req, reply) => {
    const usuarioId = req.headers["x-user-id"];

    const result = await app.pg.query(`
      SELECT
        o.id,
        o.estado,
        o.created_at,
        o.trabajador_lat,
        o.trabajador_lng,
        o.sucursal_lat,
        o.sucursal_lng,
        json_agg(
          json_build_object(
            'nombre',   pr.nombre,
            'cantidad', oi.cantidad,
            'precio',   pr.precio
          )
        ) AS items
      FROM orders.orders o
      LEFT JOIN orders.order_items oi ON oi.order_id = o.id
      LEFT JOIN products.products pr ON pr.id = oi.product_id
      WHERE o.usuario_id = $1
        AND o.estado IN ('PENDIENTE', 'EN_CAMINO')
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 1
    `, [usuarioId]);

    if (result.rows.length === 0) return reply.send(null);
    reply.send(result.rows[0]);
  });

  app.delete("/pedidos/:id", async (req, reply) => {
    const usuarioId = req.headers["x-user-id"];
    const { id } = req.params;

    const check = await app.pg.query(
      "SELECT estado, usuario_id FROM orders.orders WHERE id = $1",
      [id]
    );

    if (check.rows.length === 0)
      return reply.code(404).send({ error: "Pedido no encontrado" });

    const pedido = check.rows[0];

    if (pedido.usuario_id !== usuarioId)
      return reply.code(403).send({ error: "No autorizado" });

    if (pedido.estado !== "PENDIENTE")
      return reply.code(409).send({
        error: "El pedido ya fue tomado por un repartidor y no puede cancelarse",
      });

    await app.pg.query(
      "UPDATE orders.orders SET estado = 'CANCELADO', cancelado_en = NOW() WHERE id = $1",
      [id]
    );

    reply.send({ ok: true });
  });

  // ──────────────────────────────────────────────────────
  // TRABAJADOR
  // GET   /pedidos/pendientes   → lista pedidos sin trabajador asignado
  // PATCH /pedidos/:id/aceptar  → trabajador toma el pedido (guarda coords)
  // ──────────────────────────────────────────────────────
  app.get("/pedidos/pendientes", async (req, reply) => {
    const result = await app.pg.query(`
      SELECT
        o.id,
        o.estado,
        o.created_at,
        p.email AS cliente_email,
        json_agg(
          json_build_object(
            'nombre',   pr.nombre,
            'cantidad', oi.cantidad,
            'precio',   pr.precio
          )
        ) AS items
      FROM orders.orders o
      JOIN auth.usuarios u ON u.id = o.usuario_id
      JOIN auth.personas p ON p.id = u.persona_id
      LEFT JOIN orders.order_items oi ON oi.order_id = o.id
      LEFT JOIN products.products pr ON pr.id = oi.product_id
      WHERE o.estado = 'PENDIENTE'
        AND o.trabajador_id IS NULL
      GROUP BY o.id, p.email
      ORDER BY o.created_at ASC
    `);
    reply.send(result.rows);
  });

  app.patch("/pedidos/:id/aceptar", async (req, reply) => {
    const usuarioId = req.headers["x-user-id"];
    const { id } = req.params;

    if (!usuarioId) {
      return reply.code(401).send({ error: "Usuario no autenticado" });
    }

    // Coordenadas del trabajador y sucursal enviadas desde el frontend
    const { trabajador_lat, trabajador_lng, sucursal_lat, sucursal_lng } = req.body || {};

    const client = await app.pg.connect();
    try {
      await client.query("BEGIN");

      const tRes = await client.query(
        `SELECT t.id AS trabajador_id
         FROM auth.trabajadores t
         JOIN auth.usuarios u ON u.persona_id = t.persona_id
         WHERE u.id = $1
           AND t.estado = true`,
        [usuarioId]
      );

      if (tRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return reply.code(403).send({ error: "No eres un trabajador registrado o tu cuenta está inactiva" });
      }

      const trabajadorRealId = tRes.rows[0].trabajador_id;

      const checkRes = await client.query(
        "SELECT id, estado, trabajador_id FROM orders.orders WHERE id = $1",
        [id]
      );

      if (checkRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "Pedido no encontrado" });
      }

      const pedido = checkRes.rows[0];

      if (pedido.estado !== "PENDIENTE" || pedido.trabajador_id !== null) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "El pedido ya fue tomado por otro trabajador" });
      }

      const result = await client.query(
        `UPDATE orders.orders
         SET trabajador_id  = $1,
             estado         = 'EN_CAMINO',
             trabajador_lat = $3,
             trabajador_lng = $4,
             sucursal_lat   = $5,
             sucursal_lng   = $6
         WHERE id = $2
         RETURNING id, estado`,
        [
          trabajadorRealId, id,
          trabajador_lat ?? null, trabajador_lng ?? null,
          sucursal_lat   ?? null, sucursal_lng   ?? null,
        ]
      );

      await client.query("COMMIT");
      reply.send(result.rows[0]);

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error al aceptar pedido:", err);
      reply.code(500).send({ error: "Error interno al aceptar el pedido", detalle: err.message });
    } finally {
      client.release();
    }
  });

  // ──────────────────────────────────────────────────────
  // TRABAJADOR: marcar pedido como entregado
  // PATCH /pedidos/:id/entregar
  // ──────────────────────────────────────────────────────
  app.patch("/pedidos/:id/entregar", async (req, reply) => {
    const usuarioId = req.headers["x-user-id"];
    const { id } = req.params;

    if (!usuarioId) {
      return reply.code(401).send({ error: "Usuario no autenticado" });
    }

    const client = await app.pg.connect();
    try {
      await client.query("BEGIN");

      // Verificar que el usuario es un trabajador activo
      const tRes = await client.query(
        `SELECT t.id AS trabajador_id
         FROM auth.trabajadores t
         JOIN auth.usuarios u ON u.persona_id = t.persona_id
         WHERE u.id = $1 AND t.estado = true`,
        [usuarioId]
      );

      if (tRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return reply.code(403).send({ error: "No eres un trabajador registrado o tu cuenta está inactiva" });
      }

      const trabajadorRealId = tRes.rows[0].trabajador_id;

      // Verificar que el pedido existe, está EN_CAMINO y le pertenece a este trabajador
      const checkRes = await client.query(
        "SELECT id, estado, trabajador_id FROM orders.orders WHERE id = $1",
        [id]
      );

      if (checkRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "Pedido no encontrado" });
      }

      const pedido = checkRes.rows[0];

      if (pedido.estado !== "EN_CAMINO") {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "El pedido no está en camino" });
      }

      if (pedido.trabajador_id !== trabajadorRealId) {
        await client.query("ROLLBACK");
        return reply.code(403).send({ error: "Este pedido no te pertenece" });
      }

      const result = await client.query(
        `UPDATE orders.orders
         SET estado = 'ENTREGADO', entregado_at = NOW()
         WHERE id = $1
         RETURNING id, estado`,
        [id]
      );

      await client.query("COMMIT");
      reply.send(result.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error al entregar pedido:", err);
      reply.code(500).send({ error: "Error interno al entregar el pedido", detalle: err.message });
    } finally {
      client.release();
    }
  });

  // ──────────────────────────────────────────────────────
  // CLIENTE: puntuar pedido entregado
  // PATCH /pedidos/:id/puntuar
  // ──────────────────────────────────────────────────────
  app.patch("/pedidos/:id/puntuar", async (req, reply) => {
    const usuarioId = req.headers["x-user-id"];
    const { id } = req.params;
    const { rating } = req.body || {};

    if (!usuarioId) {
      return reply.code(401).send({ error: "Usuario no autenticado" });
    }

    // rating puede ser null (no quiso puntuar) o un número 0-5
    if (rating !== null && rating !== undefined && (rating < 0 || rating > 5)) {
      return reply.code(400).send({ error: "La puntuación debe ser entre 0 y 5" });
    }

    const check = await app.pg.query(
      "SELECT estado, usuario_id FROM orders.orders WHERE id = $1",
      [id]
    );

    if (check.rows.length === 0) {
      return reply.code(404).send({ error: "Pedido no encontrado" });
    }

    const pedido = check.rows[0];

    if (pedido.usuario_id !== usuarioId) {
      return reply.code(403).send({ error: "Este pedido no te pertenece" });
    }

    if (pedido.estado !== "ENTREGADO") {
      return reply.code(409).send({ error: "Solo se pueden puntuar pedidos entregados" });
    }

    await app.pg.query(
      "UPDATE orders.orders SET rating = $1 WHERE id = $2",
      [rating ?? null, id]
    );

    reply.send({ ok: true });
  });

  // ──────────────────────────────────────────────────────
  // CLIENTE: pedido entregado reciente (para mostrar pantalla de puntuación)
  // GET /pedidos/mi-entregado
  // ──────────────────────────────────────────────────────
  app.get("/pedidos/mi-entregado", async (req, reply) => {
    const usuarioId = req.headers["x-user-id"];

    const result = await app.pg.query(`
      SELECT id, estado, entregado_at, rating
      FROM orders.orders
      WHERE usuario_id = $1
        AND estado = 'ENTREGADO'
        AND rating IS NULL
        AND entregado_at > NOW() - INTERVAL '10 minutes'
      ORDER BY entregado_at DESC
      LIMIT 1
    `, [usuarioId]);

    if (result.rows.length === 0) return reply.send(null);
    reply.send(result.rows[0]);
  });

  // ──────────────────────────────────────────────────────
  // ADMIN
  // GET /admin/usuarios
  // GET /admin/trabajadores
  // GET /admin/pedidos
  // ──────────────────────────────────────────────────────
  app.get("/admin/usuarios", async (req, reply) => {
    const result = await app.pg.query(`
      SELECT
        p.nombre,
        p.apellidos,
        p.email,
        p.rut,
        u.estado,
        u.created_at
      FROM auth.usuarios u
      JOIN auth.personas p ON p.id = u.persona_id
      ORDER BY u.created_at DESC
    `);
    reply.send(result.rows);
  });

  app.get("/admin/trabajadores", async (req, reply) => {
    const result = await app.pg.query(`
      SELECT
        p.nombre,
        p.apellidos,
        p.email,
        p.rut,
        t.disponible,
        t.estado,
        t.fecha_contratacion
      FROM auth.trabajadores t
      JOIN auth.personas p ON p.id = t.persona_id
      ORDER BY p.nombre ASC
    `);
    reply.send(result.rows);
  });

  app.get("/admin/pedidos", async (req, reply) => {
    const result = await app.pg.query(`
      SELECT
        o.id,
        o.estado,
        o.created_at,
        pc.email AS cliente_email,
        pt.email AS trabajador_email
      FROM orders.orders o
      JOIN auth.usuarios u ON u.id = o.usuario_id
      JOIN auth.personas pc ON pc.id = u.persona_id
      LEFT JOIN auth.trabajadores t ON t.id = o.trabajador_id
      LEFT JOIN auth.personas pt ON pt.id = t.persona_id
      ORDER BY o.created_at DESC
    `);
    reply.send(result.rows);
  });

  // ── ADMIN: eliminar pedido ──
  app.delete("/admin/pedidos/:id", async (req, reply) => {
    if (req.headers["x-user-rol"] !== "ADMIN")
      return reply.code(403).send({ error: "Solo administradores pueden eliminar pedidos" });
    const { id } = req.params;
    const check = await app.pg.query("SELECT id FROM orders.orders WHERE id = $1", [id]);
    if (check.rows.length === 0) return reply.code(404).send({ error: "Pedido no encontrado" });
    await app.pg.query("DELETE FROM orders.orders WHERE id = $1", [id]);
    reply.send({ ok: true, mensaje: "Pedido eliminado correctamente" });
  });

  // ── ADMIN: eliminar usuario por email ──
  app.delete("/admin/usuarios/:email", async (req, reply) => {
    if (req.headers["x-user-rol"] !== "ADMIN")
      return reply.code(403).send({ error: "Solo administradores pueden eliminar usuarios" });
    const { email } = req.params;

    const personaRes = await app.pg.query("SELECT id FROM auth.personas WHERE email = $1", [email]);
    if (personaRes.rows.length === 0) return reply.code(404).send({ error: "Usuario no encontrado" });
    const personaId = personaRes.rows[0].id;

    const usuarioRes = await app.pg.query("SELECT id FROM auth.usuarios WHERE persona_id = $1", [personaId]);
    if (usuarioRes.rows.length === 0) return reply.code(404).send({ error: "Usuario no encontrado" });
    const usuarioId = usuarioRes.rows[0].id;

    const esAdmin = await app.pg.query("SELECT id FROM auth.administradores WHERE persona_id = $1", [personaId]);
    if (esAdmin.rows.length > 0)
      return reply.code(403).send({ error: "No se puede eliminar a un administrador" });

    const client = await app.pg.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM orders.orders WHERE usuario_id = $1", [usuarioId]);
      await client.query("DELETE FROM auth.trabajadores WHERE persona_id = $1", [personaId]);
      await client.query("DELETE FROM auth.usuarios WHERE persona_id = $1", [personaId]);
      await client.query("DELETE FROM auth.personas WHERE id = $1", [personaId]);
      await client.query("COMMIT");
      reply.send({ ok: true, mensaje: "Usuario eliminado correctamente" });
    } catch (err) {
      await client.query("ROLLBACK");
      reply.code(500).send({ error: "Error interno al eliminar el usuario", detalle: err.message });
    } finally {
      client.release();
    }
  });
}
