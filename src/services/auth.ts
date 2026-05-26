import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function register(email: string, password: string) {
  const hash = await bcrypt.hash(password, 10);

  const admin = await prisma.admin.create({
    data: { email, passwordHash: hash },
  });

  return jwt.sign({ adminId: admin.id }, process.env.JWT_SECRET!);
}

export async function login(email: string, password: string) {
  const admin = await prisma.admin.findUnique({ where: { email } });

  if (!admin) throw new Error("Invalid");

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) throw new Error("Invalid");

  return jwt.sign({ adminId: admin.id }, process.env.JWT_SECRET!);
}