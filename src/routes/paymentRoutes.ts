import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth";
import { createInvoice, verifyPlisioSignature, PLAN_PRICES } from "../services/plisioService";
import { getPlanLimit, isValidPlan, isPlanAvailable } from "../config/plans";

const prisma = new PrismaClient();

export async function paymentRoutes(app: FastifyInstance) {

  // =========================
  // POST /api/checkout
  // =========================
  app.post("/api/checkout", async (req: any, reply) => {
    await authMiddleware(req, reply);
    if (reply.sent) return;

    const { companyId, plan } = req.body;

    if (!companyId || !plan) {
      return reply.status(400).send({ error: "companyId and plan are required" });
    }

    if (!isValidPlan(plan) || plan === "free") {
      return reply.status(400).send({ error: "Invalid plan for checkout" });
    }

    if (!isPlanAvailable(plan)) {
      return reply.status(400).send({
        error: `Plan [${plan}] is coming soon after MVP launch`,
      });
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return reply.status(404).send({ error: "Company not found" });
    }

    try {
      const { invoiceUrl, invoiceId } = await createInvoice({
        companyId: company.id,
        companyName: company.name,
        plan,
        email: req.admin.email,
      });

      console.log(`💳 Invoice created: ${company.name} → [${plan}] — ${invoiceId}`);

      return reply.send({
        ok: true,
        invoiceUrl,
        invoiceId,
        plan,
        amount: PLAN_PRICES[plan],
        currency: "USDT",
      });
    } catch (err: any) {
      console.error("❌ Plisio error:", err.message);
      return reply.status(500).send({ error: "Failed to create invoice" });
    }
  });

  // =========================
  // POST /api/plisio/webhook
  // =========================
  app.post("/api/plisio/webhook", async (req: any, reply) => {
    try {
      const data = req.body;

      console.log("💰 Plisio webhook:", JSON.stringify(data));

      // التحقق من التوقيع
      const isValid = verifyPlisioSignature(data);
      if (!isValid) {
        console.log("❌ Invalid Plisio signature");
        return reply.status(400).send({ error: "Invalid signature" });
      }

      const status = data.status;
      const orderNumber = data.order_number;

      // order_number = companyId-plan-timestamp
      const parts = orderNumber?.split("-");
      if (!parts || parts.length < 2) {
        return reply.status(400).send({ error: "Invalid order number" });
      }

      // استخراج companyId و plan
      const plan = parts[parts.length - 2];
      const companyId = parts.slice(0, parts.length - 2).join("-");

      console.log(`💰 Payment status: ${status} — Company: ${companyId} — Plan: ${plan}`);

      // فقط عند نجاح الدفع
      if (status === "completed" || status === "mismatch") {
        const company = await prisma.company.findUnique({ where: { id: companyId } });

        if (!company) {
          console.log("⚠️ Company not found:", companyId);
          return reply.send({ ok: true });
        }

        const messageLimit = getPlanLimit(plan);
        const now = new Date();
        const subscriptionEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        await prisma.company.update({
          where: { id: companyId },
          data: {
            plan,
            messageLimit,
            messageCount: 0,
            isActive: true,
            subscriptionStatus: "active",
            subscriptionStart: now,
            subscriptionEnd,
          },
        });

        console.log(`✅ UPGRADED: ${company.name} → [${plan}] until ${subscriptionEnd.toDateString()}`);
      }

      return reply.send({ ok: true });
    } catch (err: any) {
      console.error("❌ Plisio webhook error:", err.message);
      return reply.status(500).send({ error: "Webhook processing failed" });
    }
  });

  // =========================
  // GET /api/checkout/plans
  // =========================
  app.get("/api/checkout/plans", async (req, reply) => {
    return reply.send({
      plans: [
        { id: "starter",  price: 19,  limit: 5000,   label: "Starter",  available: true  },
        { id: "pro",      price: 49,  limit: 20000,  label: "Pro",      available: false },
        { id: "business", price: 149, limit: 100000, label: "Business", available: false },
      ],
      note: "Pro and Business plans launching after MVP month",
    });
  });
}