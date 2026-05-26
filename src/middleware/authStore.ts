import { prisma } from "../lib/prisma";

export async function authStore(req: any) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) return null;

  const store = await prisma.store.findUnique({
    where: { apiKey: apiKey as string },
  });

  if (!store) return null;
  if (!store.isActive) return null;
  if (new Date() > store.trialEndsAt) return null;

  if (store.messagesUsed >= store.messageLimit) return null;

  return store;
}