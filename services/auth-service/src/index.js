import Fastify from "fastify";
import jwt from "@fastify/jwt";
import authRoutes from "./routes/auth.routes.js";
import { pool } from "./db/postgres.js";

const app = Fastify({ logger: true });

// DB
app.decorate("pg", pool);

// JWT
app.register(jwt, {
  secret: process.env.JWT_SECRET
});

// Routes
app.register(authRoutes);

// Healthcheck
app.get("/health", async () => ({ status: "ok" }));

app.listen({ port: 3000, host: "0.0.0.0" });