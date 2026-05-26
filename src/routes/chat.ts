import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { auth } from "../middleware/auth";
import { generateAIResponse } from "../services/aiService";

export async function chatRoutes(app: FastifyInstance) {
  app.post("/chat", { preHandler: auth }, async (req, reply) => {
    try {
      const { message } = (req.body as any) || {};

      if (!message || message.trim() === "") {
        return reply.status(400).send({
          success: false,
          error: "Message is required",
        });
      }

      const store = (req as any).store;

      console.log("📩 MESSAGE:", message);

      // 1. Save user message
      await prisma.message.create({
        data: {
          role: "user",
          content: message,
          storeId: store.id,
        },
      });

      // 2. Get last 12 messages (memory)
      const history = await prisma.message.findMany({
        where: { storeId: store.id },
        orderBy: { createdAt: "asc" },
        take: 12,
      });

      const formattedMessages = history.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      console.log("📦 MEMORY:", formattedMessages);

      // 3. Get AI response
      const aiMessage = await generateAIResponse([
        {
          role: "system",
          content: `
          You are ReplyAI, an advanced AI assistant for businesses.

          Rules:
          - Be smart, direct, and helpful
          - Never reply with empty or generic responses
          - Always understand context
          - If user asks personal question, answer naturally
          - Keep responses short unless user asks for detail
          `,
        },
        ...formattedMessages,
      ]);

      // 4. Save AI message
      await prisma.message.create({
        data: {
          role: "assistant",
          content: aiMessage,
          storeId: store.id,
        },
      });

      // 5. Response
      return reply.send({
        success: true,
        reply: aiMessage,
      });
    } catch (error: any) {
      console.log("❌ CHAT ERROR:", error?.message);

      return reply.status(500).send({
        success: false,
        error: "Internal Server Error",
      });
    }
  });
}