import Fastify from "fastify";
import orderRoutes from "./routes/orders.routes.js";
import { pool } from "./db/postgres.js";

const app = Fastify({ logger: true });

app.decorate("pg", pool);

app.register(orderRoutes, { prefix: "/orders" });

app.get("/health", async () => ({ status: "ok" }));

app.listen({ port: 3000, host: "0.0.0.0" });
