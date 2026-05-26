import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "replyai_secret_change_in_prod";

export async function registerAdmin(email: string, password: string) {
  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) throw new Error("Email already registered");

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.admin.create({ data: { email, passwordHash } });

  const token = jwt.sign(
    { adminId: admin.id, email: admin.email },
    JWT_SECRET,
    { expiresIn: "30d" }
  );

  return { token, email: admin.email };
}

export async function loginAdmin(email: string, password: string) {
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) throw new Error("Invalid email or password");

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) throw new Error("Invalid email or password");

  const token = jwt.sign(
    { adminId: admin.id, email: admin.email },
    JWT_SECRET,
    { expiresIn: "30d" }
  );

  return { token, email: admin.email };
}

export function verifyToken(token: string): { adminId: string; email: string } {
  try {
    return jwt.verify(token, JWT_SECRET) as { adminId: string; email: string };
  } catch {
    throw new Error("Invalid or expired token");
  }
}