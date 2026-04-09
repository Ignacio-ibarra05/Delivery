import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import proxy from "@fastify/http-proxy";

const app = Fastify({ logger: true });

// ---------- CORS ----------
app.register(cors, {
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});

// ---------- JWT ----------
app.register(jwt, {
  secret: process.env.JWT_SECRET,
});

// ---------- AUTH HOOK ----------
app.addHook("onRequest", async (req, reply) => {
  const publicRoutes = [
    "/api/auth/login",
    "/api/auth/health",
    "/api/users/register",   // registro público de clientes
    "/api/users/health",
  ];

  if (publicRoutes.includes(req.url)) return;
  if (req.method === "OPTIONS") return;

  try {
    const auth = req.headers.authorization;
    if (!auth) {
      return reply.code(401).send({ error: "Token requerido" });
    }

    const decoded = await req.jwtVerify();

    // Inyectamos info del usuario para todos los microservicios
    req.headers["x-user-id"]  = decoded.sub;
    req.headers["x-user-email"] = decoded.email;
    req.headers["x-user-rol"]  = decoded.rol;   // ← nuevo: permite validar rol en los servicios
  } catch (err) {
    reply.code(401).send({ error: "Token inválido" });
  }
});

// ---------- PROXIES ----------
app.register(proxy, {
  upstream: "http://auth:3000",
  prefix: "/api/auth",
  rewritePrefix: "/",
});

app.register(proxy, {
  upstream: "http://users:3000",
  prefix: "/api/users",
  rewritePrefix: "/",
});

app.register(proxy, {
  upstream: "http://orders:3000",
  prefix: "/api/orders",
  rewritePrefix: "/orders",
});

// ---------- START ----------
app.listen({ port: 8080, host: "0.0.0.0" });
