import bcrypt from "bcrypt";

export default async function authRoutes(app) {

  app.post("/login", async (req, reply) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return reply.code(400).send({ error: "Email y password requeridos" });
    }

    const result = await app.pg.query(
      `
      SELECT
        u.id AS usuario_id,
        p.email,
        u.password,
        CASE
          WHEN a.id IS NOT NULL THEN 'ADMIN'
          WHEN t.id IS NOT NULL THEN 'TRABAJADOR'
          ELSE 'CLIENTE'
        END AS rol
      FROM auth.personas p
      LEFT JOIN auth.usuarios u ON u.persona_id = p.id
      LEFT JOIN auth.trabajadores t ON t.persona_id = p.id
      LEFT JOIN auth.administradores a ON a.persona_id = p.id
      WHERE p.email = $1
        AND (u.estado = true OR u.id IS NULL)
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return reply.code(401).send({ error: "Credenciales inválidas" });
    }

    const user = result.rows[0];

    if (!user.password) {
      return reply.code(401).send({ error: "Credenciales inválidas" });
    }

    // ⚠️ Contraseñas planas (desarrollo local)
    if (user.password !== password) {
      return reply.code(401).send({ error: "Credenciales inválidas" });
    }

    // ✅ Cuando actives bcrypt:
    // const valid = await bcrypt.compare(password, user.password);
    // if (!valid) return reply.code(401).send({ error: "Credenciales inválidas" });

    const token = app.jwt.sign(
      {
        sub: user.usuario_id,
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
