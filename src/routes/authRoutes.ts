import { FastifyInstance } from "fastify";
import { registerAdmin, loginAdmin, verifyToken } from "../services/authService";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (req: any, reply) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return reply.status(400).send({ error: "email and password are required" });
    }

    if (password.length < 8) {
      return reply.status(400).send({ error: "Password must be at least 8 characters" });
    }

    try {
      const result = await registerAdmin(email, password);
      console.log("✅ New admin registered:", email);
      return reply.status(201).send({ ok: true, ...result });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  app.post("/auth/login", async (req: any, reply) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return reply.status(400).send({ error: "email and password are required" });
    }

    try {
      const result = await loginAdmin(email, password);
      console.log("🔑 Admin logged in:", email);
      return reply.send({ ok: true, ...result });
    } catch (err: any) {
      return reply.status(401).send({ error: err.message });
    }
  });

  app.get("/auth/me", async (req: any, reply) => {
    const authHeader = req.headers["authorization"];

    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    try {
      const decoded = verifyToken(authHeader.split(" ")[1]);
      return reply.send({ ok: true, ...decoded });
    } catch {
      return reply.status(401).send({ error: "Invalid token" });
    }
  });
}