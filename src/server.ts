import Fastify from "fastify";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { askAI } from "./services/ai";
import { sendMessage } from "./services/messenger";

dotenv.config();

const app = Fastify();
const prisma = new PrismaClient();

// HEALTH
app.get("/health", async () => {
  return { ok: true };
});

// WEBHOOK
app.post("/webhook", async (req: any) => {
  const body = req.body;

  const pageId = body.entry?.[0]?.id;
  const msg = body.entry?.[0]?.messaging?.[0];

  if (!msg) return;

  const psid = msg.sender.id;
  const text = msg.message.text;

  const company = await prisma.company.findUnique({
    where: { pageId },
  });

  if (!company) return;

  const reply = await askAI([
    { role: "system", content: company.systemPrompt },
    { role: "user", content: text },
  ]);

  await sendMessage(psid, reply, company.pageAccessToken);
});

const start = async () => {
  await app.listen({
    port: Number(process.env.PORT) || 5000,
    host: "0.0.0.0",
  });
};

start();