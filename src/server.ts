import Fastify from "fastify";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { generateAIResponse } from "./services/aiService";
import { sendMessage } from "./services/messengerService";
import { authRoutes } from "./routes/authRoutes";
import { paymentRoutes } from "./routes/paymentRoutes";
import { authMiddleware } from "./middleware/auth";
import fastifyStatic from "@fastify/static";
import { startCronJobs } from "./services/cronService";
import path from "path";
import {
  PLANS,
  FREE_PLAN_LIMIT,
  getPlanLimit,
  isValidPlan,
  isPlanAvailable,
} from "./config/plans";

dotenv.config();

const app = Fastify();
const prisma = new PrismaClient();

async function start() {
  try {
    await prisma.$connect();
    console.log("🟢 Prisma connected");

    await app.register(authRoutes);

    await app.register(paymentRoutes);

    await app.register(fastifyStatic, {
      root: path.join(__dirname, "../public"),
      prefix: "/",
    });

    // =========================
    // WEBHOOK VERIFICATION
    // =========================
    app.get("/webhook", async (req: any, reply) => {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
        console.log("✅ WEBHOOK VERIFIED");
        return reply.status(200).send(challenge);
      }
      return reply.status(403).send("Forbidden");
    });

    // =========================
    // RECEIVE MESSAGES
    // =========================

    app.post("/test-ai", async (req, reply) => {
      return { reply: "AI test working" };
    });
    app.post("/webhook", async (req: any, reply) => {
      try {
        const body = req.body;

        if (body.object !== "page") return reply.send({ ok: true });

        const entry = body.entry?.[0];
        const messaging = entry?.messaging?.[0];
        const pageId = entry?.id;

        if (!messaging || !pageId) return reply.send({ ok: true });
        if (messaging.sender.id === pageId) return reply.send({ ok: true });
        if (!messaging.message) return reply.send({ ok: true });
        if (messaging.message.is_echo) return reply.send({ ok: true });

        const psid = messaging.sender.id;
        const messageText = messaging.message?.text;

        if (!messageText) return reply.send({ ok: true });

        console.log("📩 MESSAGE:", messageText);
        console.log("👤 USER:", psid);
        console.log("🏢 PAGE:", pageId);

        const company = await prisma.company.findUnique({ where: { pageId } });

        if (!company) {
          console.log("⚠️ No company found for pageId:", pageId);
          return reply.send({ ok: true });
        }

        if (!company.isActive) {
          console.log("⚠️ Company inactive:", company.name);
          return reply.send({ ok: true });
        }

        const planLimit = getPlanLimit(company.plan);

        if (company.messageCount >= planLimit) {
          console.log(`🚫 Limit reached: ${company.name} [${company.plan}]`);
          await sendMessage(
            psid,
            company.plan === "free"
              ? "انتهت رسائل الخطة المجانية لهذا الشهر. تواصل معنا لترقية خطتك."
              : "انتهت رسائل خطتك لهذا الشهر. يرجى ترقية الخطة للاستمرار.",
            company.pageAccessToken
          );
          return reply.send({ ok: true });
        }

        let user = await prisma.user.findUnique({
          where: { psid_companyId: { psid, companyId: company.id } },
        });

        if (!user) {
          user = await prisma.user.create({
            data: { psid, companyId: company.id },
          });
          console.log("🆕 New user:", psid, "for", company.name);
        }

        await prisma.message.create({
          data: { text: messageText, role: "user", userId: user.id },
        });

        const history = await prisma.message.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "asc" },
          take: 10,
        });

        const aiMessages = [
          { role: "system", content: company.systemPrompt },
          ...history.map((msg) => ({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.text,
          })),
        ];

        const aiReply = await generateAIResponse(aiMessages);
        console.log("🤖 AI:", aiReply);

        await sendMessage(psid, aiReply, company.pageAccessToken);

        await prisma.message.create({
          data: { text: aiReply, role: "assistant", userId: user.id },
        });

        await prisma.company.update({
          where: { id: company.id },
          data: { messageCount: { increment: 1 } },
        });

        console.log(
          `📊 ${company.name} [${company.plan}]: ${company.messageCount + 1}/${planLimit}`
        );

        return reply.send({ ok: true });
      } catch (err: any) {
        console.error("❌ WEBHOOK ERROR:", err.response?.data || err.message || err);
        return reply.send({ ok: true });
      }
    });

    // =========================
    // PLANS (public endpoint)
    // =========================
    app.get("/plans", async (req, reply) => {
      const availablePlans = Object.entries(PLANS)
        .filter(([, plan]) => plan.available)
        .map(([key, plan]) => ({ id: key, ...plan }));

      return reply.send({ plans: availablePlans });
    });

    // =========================
    // ADMIN — ADD COMPANY
    // =========================
    app.post("/admin/companies", async (req: any, reply) => {
      await authMiddleware(req, reply);
      if (reply.sent) return;

      const { name, pageId, pageAccessToken, systemPrompt, plan } = req.body;

      if (!name || !pageId || !pageAccessToken) {
        return reply.status(400).send({
          error: "name, pageId, pageAccessToken are required",
        });
      }

      // حماية الـ Free Plan — 5 شركات فقط
      if (!plan || plan === "free") {
        const freeCount = await prisma.company.count({
          where: { plan: "free" },
        });

        if (freeCount >= FREE_PLAN_LIMIT) {
          return reply.status(403).send({
            error: `Free plan is limited to ${FREE_PLAN_LIMIT} businesses only. Please choose a paid plan.`,
          });
        }
      }

      const selectedPlan = plan && isValidPlan(plan) ? plan : "free";
      const messageLimit = getPlanLimit(selectedPlan);

      const company = await prisma.company.create({
        data: {
          name,
          pageId,
          pageAccessToken,
          plan: selectedPlan,
          messageLimit,
          systemPrompt:
            systemPrompt ||
            "You are a helpful customer support assistant. Always reply in the same language the customer uses.",
        },
      });

      console.log(`🏢 New company: ${company.name} [${selectedPlan}]`);
      return reply.send({ ok: true, company });
    });

    // =========================
    // ADMIN — LIST COMPANIES
    // =========================
    app.get("/admin/companies", async (req: any, reply) => {
      await authMiddleware(req, reply);
      if (reply.sent) return;

      const companies = await prisma.company.findMany({
        select: {
          id: true,
          name: true,
          pageId: true,
          plan: true,
          messageCount: true,
          messageLimit: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const freeCount = companies.filter((c) => c.plan === "free").length;

      return reply.send({
        companies,
        meta: {
          total: companies.length,
          freeUsed: freeCount,
          freeLimit: FREE_PLAN_LIMIT,
          freeAvailable: freeCount < FREE_PLAN_LIMIT,
        },
      });
    });

    // =========================
    // ADMIN — UPGRADE PLAN
    // =========================
    app.patch("/admin/companies/:id/plan", async (req: any, reply) => {
      await authMiddleware(req, reply);
      if (reply.sent) return;

      const { plan } = req.body;

      if (!plan || !isValidPlan(plan)) {
        return reply.status(400).send({
          error: "Invalid plan. Choose: free, starter, pro, business",
        });
      }

      if (!isPlanAvailable(plan) && plan !== "free") {
        return reply.status(400).send({
          error: `Plan [${plan}] is not available yet. Coming soon after MVP.`,
        });
      }

      const messageLimit = getPlanLimit(plan);

      const updated = await prisma.company.update({
        where: { id: req.params.id },
        data: { plan, messageLimit },
      });

      console.log(`⬆️ ${updated.name} → [${plan}] limit: ${messageLimit}`);
      return reply.send({ ok: true, name: updated.name, plan, messageLimit });
    });

    // =========================
    // ADMIN — TOGGLE COMPANY
    // =========================
    app.patch("/admin/companies/:id/toggle", async (req: any, reply) => {
      await authMiddleware(req, reply);
      if (reply.sent) return;

      const company = await prisma.company.findUnique({
        where: { id: req.params.id },
      });
      if (!company) return reply.status(404).send({ error: "Company not found" });

      const updated = await prisma.company.update({
        where: { id: req.params.id },
        data: { isActive: !company.isActive },
      });

      console.log(`🔄 ${updated.name} → ${updated.isActive ? "active" : "inactive"}`);
      return reply.send({ ok: true, isActive: updated.isActive });
    });

    // =========================
    // ADMIN — RESET MESSAGE COUNT
    // =========================
    app.patch("/admin/companies/:id/reset", async (req: any, reply) => {
      await authMiddleware(req, reply);
      if (reply.sent) return;

      const updated = await prisma.company.update({
        where: { id: req.params.id },
        data: { messageCount: 0 },
      });

      console.log(`🔄 Reset count: ${updated.name}`);
      return reply.send({ ok: true, company: updated.name, messageCount: 0 });
    });

    // =========================
    // ADMIN — UPDATE SYSTEM PROMPT
    // =========================
    app.patch("/admin/companies/:id/prompt", async (req: any, reply) => {
      await authMiddleware(req, reply);
      if (reply.sent) return;

      const { systemPrompt } = req.body;
      if (!systemPrompt) {
        return reply.status(400).send({ error: "systemPrompt is required" });
      }

      const updated = await prisma.company.update({
        where: { id: req.params.id },
        data: { systemPrompt },
      });

      console.log(`✏️ Updated prompt: ${updated.name}`);
      return reply.send({ ok: true, company: updated.name });
    });

    // =========================
    // ADMIN — DELETE COMPANY
    // =========================
    app.delete("/admin/companies/:id", async (req: any, reply) => {
      await authMiddleware(req, reply);
      if (reply.sent) return;

      const users = await prisma.user.findMany({
        where: { companyId: req.params.id },
      });

      for (const user of users) {
        await prisma.message.deleteMany({ where: { userId: user.id } });
      }
      await prisma.user.deleteMany({ where: { companyId: req.params.id } });
      await prisma.company.delete({ where: { id: req.params.id } });

      console.log(`🗑️ Deleted: ${req.params.id}`);
      return reply.send({ ok: true });
    });

    // =========================
    // ADMIN — COMPANY STATS
    // =========================
    app.get("/admin/companies/:id/stats", async (req: any, reply) => {
      await authMiddleware(req, reply);
      if (reply.sent) return;

      const company = await prisma.company.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { users: true } } },
      });

      if (!company) return reply.status(404).send({ error: "Company not found" });

      const totalMessages = await prisma.message.count({
        where: { user: { companyId: req.params.id } },
      });

      const planLimit = getPlanLimit(company.plan);

      return reply.send({
        name: company.name,
        plan: company.plan,
        isActive: company.isActive,
        users: company._count.users,
        messageCount: company.messageCount,
        messageLimit: planLimit,
        remaining: planLimit - company.messageCount,
        totalMessages,
        createdAt: company.createdAt,
      });
    });

    // =========================
    // HEALTH CHECK
    // =========================
    app.get("/health", async (req, reply) => {
      const companies = await prisma.company.count();
      const freeCompanies = await prisma.company.count({ where: { plan: "free" } });
      const users = await prisma.user.count();
      const messages = await prisma.message.count();

      return reply.send({
        status: "ok",
        timestamp: new Date().toISOString(),
        stats: {
          companies,
          freeCompanies,
          freeLimit: FREE_PLAN_LIMIT,
          users,
          messages,
        },
      });
    });

    await app.listen({ port: process.env.PORT || 5000 });
    startCronJobs();
    console.log("🚀 ReplyAI running on http://0.0.0.0:5000");
  } catch (err) {
    console.error("❌ STARTUP ERROR:", err);
  }
}

start();