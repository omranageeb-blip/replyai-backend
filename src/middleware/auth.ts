import jwt from "jsonwebtoken";

export async function authMiddleware(req: any, reply: any) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return reply.status(401).send({ error: "No token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.admin = decoded;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}