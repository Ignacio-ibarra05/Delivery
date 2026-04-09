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
  // POST /pedidos  → crea un pedido con sus items
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

  // ──────────────────────────────────────────────────────
  // TRABAJADOR
  // GET /pedidos/pendientes  → lista pedidos sin trabajador asignado
  // PATCH /pedidos/:id/aceptar  → trabajador toma el pedido
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

    const client = await app.pg.connect();
    try {
      await client.query("BEGIN");

      // Buscar el trabajador a partir del usuario_id del JWT
      // El JWT lleva el usuario_id (auth.usuarios.id), del cual obtenemos persona_id
      // y con eso buscamos en auth.trabajadores
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

      // Verificar que el pedido existe y está disponible
      const checkRes = await client.query(
        "SELECT id, estado, trabajador_id FROM orders.orders WHERE id = $1",
        [id]
      );

      if (checkRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "Pedido no encontrado" });
      }

      const pedido = checkRes.rows[0];

      if (pedido.estado !== 'PENDIENTE' || pedido.trabajador_id !== null) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "El pedido ya fue tomado por otro trabajador" });
      }

      // Asignar el pedido al trabajador
      const result = await client.query(
        `UPDATE orders.orders
         SET trabajador_id = $1, estado = 'EN_CAMINO'
         WHERE id = $2
         RETURNING id, estado`,
        [trabajadorRealId, id]
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
}
