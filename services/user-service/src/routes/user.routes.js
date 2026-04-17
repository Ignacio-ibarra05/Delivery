export default async function userRoutes(app) {

  // ──────────────────────────────────────────────────────────────
  // PÚBLICO — POST /register
  // Crea una persona + usuario con rol CLIENTE.
  // Accesible sin token desde el formulario de login.
  // ──────────────────────────────────────────────────────────────
  
  app.post("/register", async (req, reply) => {
    const { rut, nombre, apellidos, email, password, fecha_nacimiento } = req.body;

    if (!rut || !nombre || !apellidos || !email || !password) {
      return reply.code(400).send({ error: "Faltan campos obligatorios: rut, nombre, apellidos, email, password" });
    }

    // Verificar duplicados
    const existe = await app.pg.query(
      "SELECT id FROM auth.personas WHERE email = $1 OR rut = $2",
      [email, rut]
    );
    if (existe.rows.length > 0) {
      return reply.code(409).send({ error: "El email o RUT ya está registrado" });
    }

    const client = await app.pg.connect();
    try {
      await client.query("BEGIN");

      const personaRes = await client.query(
        `INSERT INTO auth.personas (rut, nombre, apellidos, email, fecha_nacimiento)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [rut, nombre, apellidos, email, fecha_nacimiento || null]
      );
      const personaId = personaRes.rows[0].id;

      await client.query(
        "INSERT INTO auth.usuarios (persona_id, password) VALUES ($1, $2)",
        [personaId, password]
      );

      await client.query("COMMIT");
      reply.code(201).send({ message: "Cuenta creada correctamente. Ya puedes iniciar sesión." });
    } catch (err) {
      await client.query("ROLLBACK");
      reply.code(500).send({ error: "Error al crear la cuenta" });
    } finally {
      client.release();
    }
  });

  // ──────────────────────────────────────────────────────────────
  // ADMIN — POST /admin/crear-usuario
  // Crea un usuario con cualquier rol (CLIENTE, TRABAJADOR, ADMIN).
  // Solo accesible con token y rol ADMIN (validado por el gateway
  // que inyecta x-user-rol en el header).
  // ──────────────────────────────────────────────────────────────
  app.post("/admin/crear-usuario", async (req, reply) => {
    const rolSolicitante = req.headers["x-user-rol"];

    if (rolSolicitante !== "ADMIN") {
      return reply.code(403).send({ error: "Solo los administradores pueden crear usuarios con este endpoint" });
    }

    const { rut, nombre, apellidos, email, password, fecha_nacimiento, rol, fecha_contratacion } = req.body;

    if (!rut || !nombre || !apellidos || !email || !password || !rol) {
      return reply.code(400).send({ error: "Faltan campos obligatorios: rut, nombre, apellidos, email, password, rol" });
    }

    const rolesValidos = ["CLIENTE", "TRABAJADOR", "ADMIN"];
    if (!rolesValidos.includes(rol)) {
      return reply.code(400).send({ error: `Rol inválido. Debe ser uno de: ${rolesValidos.join(", ")}` });
    }

    const existe = await app.pg.query(
      "SELECT id FROM auth.personas WHERE email = $1 OR rut = $2",
      [email, rut]
    );
    if (existe.rows.length > 0) {
      return reply.code(409).send({ error: "El email o RUT ya está registrado" });
    }

    const client = await app.pg.connect();
    try {
      await client.query("BEGIN");

      // 1. Crear persona base
      const personaRes = await client.query(
        `INSERT INTO auth.personas (rut, nombre, apellidos, email, fecha_nacimiento)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [rut, nombre, apellidos, email, fecha_nacimiento || null]
      );
      const personaId = personaRes.rows[0].id;

      // 2. Siempre crear registro en auth.usuarios (necesario para el login)
      await client.query(
        "INSERT INTO auth.usuarios (persona_id, password) VALUES ($1, $2)",
        [personaId, password]
      );

      // 3. Insertar en la tabla del rol correspondiente
      if (rol === "TRABAJADOR") {
        await client.query(
          "INSERT INTO auth.trabajadores (persona_id, fecha_contratacion) VALUES ($1, $2)",
          [personaId, fecha_contratacion || new Date()]
        );
      } else if (rol === "ADMIN") {
        await client.query(
          "INSERT INTO auth.administradores (persona_id) VALUES ($1)",
          [personaId]
        );
      }
      // CLIENTE no necesita tabla extra

      await client.query("COMMIT");
      reply.code(201).send({ message: `Usuario con rol ${rol} creado correctamente.` });
    } catch (err) {
      await client.query("ROLLBACK");
      reply.code(500).send({ error: "Error al crear el usuario" });
    } finally {
      client.release();
    }
  });
}
