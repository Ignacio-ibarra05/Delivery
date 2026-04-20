import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export default async function userRoutes(app) {

  // ──────────────────────────────────────────────────────────────
  // PUBLIC — POST /register
  // Creates a people + user with CLIENT role.
  // Accessible without token from the login form.
  // ──────────────────────────────────────────────────────────────
  
  app.post("/register", async (req, reply) => {
    const { rut, first_name, last_name, email, password, birth_date } = req.body;

    if (!rut || !first_name || !last_name || !email || !password) {
      return reply.code(400).send({ error: "Missing required fields: rut, first_name, last_name, email, password" });
    }

    // Check for duplicates
    const exists = await app.pg.query(
      "SELECT id FROM auth.people WHERE email = $1 OR rut = $2",
      [email, rut]
    );
    if (exists.rows.length > 0) {
      return reply.code(409).send({ error: "Email or RUT already registered" });
    }

    const client = await app.pg.connect();
    try {
      await client.query("BEGIN");

      const peopleRes = await client.query(
        `INSERT INTO auth.people (rut, first_name, last_name, email, birth_date)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [rut, first_name, last_name, email, birth_date || null]
      );
      const peopleId = peopleRes.rows[0].id;

      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      await client.query(
        "INSERT INTO auth.user (people_id, password) VALUES ($1, $2)",
        [peopleId, hashedPassword]
      );

      await client.query("COMMIT");
      reply.code(201).send({ message: "Account created successfully. You can now log in." });
    } catch (err) {
      await client.query("ROLLBACK");
      reply.code(500).send({ error: "Error creating the account" });
    } finally {
      client.release();
    }
  });

  // ──────────────────────────────────────────────────────────────
  // ADMIN — POST /admin/crear-usuario
  // Creates a user with any role (CLIENT, WORKER, ADMIN).
  // Only accessible with token and ADMIN role (validated by the gateway
  // which injects x-user-rol in the header).
  // ──────────────────────────────────────────────────────────────
  app.post("/admin/crear-usuario", async (req, reply) => {
    const requesterRole = req.headers["x-user-rol"];

    if (requesterRole !== "ADMIN") {
      return reply.code(403).send({ error: "Only administrators can create users with this endpoint" });
    }

    const { rut, first_name, last_name, email, password, birth_date, rol, contract_date } = req.body;

    if (!rut || !first_name || !last_name || !email || !password || !rol) {
      return reply.code(400).send({ error: "Missing required fields: rut, first_name, last_name, email, password, rol" });
    }

    const validRoles = ["CLIENT", "WORKER", "ADMIN"];
    if (!validRoles.includes(rol)) {
      return reply.code(400).send({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
    }

    const exists = await app.pg.query(
      "SELECT id FROM auth.people WHERE email = $1 OR rut = $2",
      [email, rut]
    );
    if (exists.rows.length > 0) {
      return reply.code(409).send({ error: "Email or RUT already registered" });
    }

    const client = await app.pg.connect();
    try {
      await client.query("BEGIN");

      // 1. Create base people record
      const peopleRes = await client.query(
        `INSERT INTO auth.people (rut, first_name, last_name, email, birth_date)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [rut, first_name, last_name, email, birth_date || null]
      );
      const peopleId = peopleRes.rows[0].id;

      // 2. Always create auth.user record (needed for login)
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      await client.query(
        "INSERT INTO auth.user (people_id, password) VALUES ($1, $2)",
        [peopleId, hashedPassword]
      );

      // 3. Insert into the corresponding role table
      if (rol === "WORKER") {
        await client.query(
          "INSERT INTO auth.worker (people_id, contract_date) VALUES ($1, $2)",
          [peopleId, contract_date || new Date()]
        );
      } else if (rol === "ADMIN") {
        await client.query(
          "INSERT INTO auth.admin (people_id) VALUES ($1)",
          [peopleId]
        );
      }
      // CLIENT needs no extra table

      await client.query("COMMIT");
      reply.code(201).send({ message: `User with role ${rol} created successfully.` });
    } catch (err) {
      await client.query("ROLLBACK");
      reply.code(500).send({ error: "Error creating the user" });
    } finally {
      client.release();
    }
  });
}
