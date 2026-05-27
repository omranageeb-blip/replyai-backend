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

app.get("/webhook", async (req: any, reply: any) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === process.env.VERIFY_TOKEN
  ) {
    console.log("✅ WEBHOOK VERIFIED");
    return reply.status(200).send(challenge);
  }

  return reply.status(403).send("Forbidden");
});

// WEBHOOK
app.post("/webhook", async (req: any, reply: any) => {
  const body = req.body;

  const pageId = body.entry?.[0]?.id;
  const msg = body.entry?.[0]?.messaging?.[0];

  if (!msg) {
    return reply.send({ ok: true });
  }

  const psid = msg.sender?.id;
  const text = msg.message?.text;

  if (!psid || !text) {
    return reply.send({ ok: true });
  }

  const company = await prisma.company.findUnique({
    where: { pageId },
  });

  if (!company) {
    return reply.send({ ok: true });
  }

  try {
    const replyText = await askAI([
      { role: "system", content: company.systemPrompt },
      { role: "user", content: text },
    ]);

    await sendMessage(psid, replyText, company.pageAccessToken);

    return reply.send({ ok: true });
  } catch (err) {
    console.log("❌ webhook error:", err);
    return reply.status(500).send({ ok: false });
  }
});

const start = async () => {
  await app.listen({
    port: Number(process.env.PORT) || 5000,
    host: "0.0.0.0",
  });
};

start();