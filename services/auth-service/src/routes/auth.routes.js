import bcrypt from "bcrypt";

export default async function authRoutes(app) {

  app.post("/login", async (req, reply) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password are required" });
    }

    const result = await app.pg.query(
      `
      SELECT
        u.id AS user_id,
        p.email,
        u.password,
        CASE
          WHEN a.id IS NOT NULL THEN 'ADMIN'
          WHEN t.id IS NOT NULL THEN 'WORKER'
          ELSE 'CLIENT'
        END AS rol
      FROM auth.people p
      LEFT JOIN auth.user u ON u.people_id = p.id
      LEFT JOIN auth.worker t ON t.people_id = p.id
      LEFT JOIN auth.admin a ON a.people_id = p.id
      WHERE p.email = $1
        AND (u.state = true OR u.id IS NULL)
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    if (!user.password) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    // ✅ bcrypt comparison — works with hashed passwords in the DB
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return reply.code(401).send({ error: "Invalid credentials" });

    const token = app.jwt.sign(
      {
        sub: user.user_id,
        email: user.email,
        rol: user.rol
      },
      { expiresIn: "1h" }
    );

    reply.send({
      token,
      rol: user.rol
    });
  });
}
