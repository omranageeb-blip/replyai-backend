import { verifyToken } from "../services/authService";

export async function authMiddleware(req: any, reply: any) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Unauthorized — token required" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);
    req.admin = decoded;
  } catch {
    return reply.status(401).send({ error: "Unauthorized — invalid token" });
  }
}