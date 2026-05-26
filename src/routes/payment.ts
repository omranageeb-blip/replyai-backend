import { FastifyInstance } from "fastify";
import { createInvoice } from "../services/plisio";
import { authMiddleware } from "../middleware/auth";

export async function paymentRoutes(app: FastifyInstance) {

  // =========================
  // CREATE CHECKOUT
  // =========================
  app.post("/api/checkout", async (req: any, reply) => {
    await authMiddleware(req, reply);
    if (reply.sent) return;

    const { email, amount } = req.body;

    if (!email || !amount) {
      return reply.status(400).send({ error: "email and amount required" });
    }

    try {
      const invoiceUrl = await createInvoice(email, amount);

      console.log("💳 Invoice created:", email, amount);

      return reply.send({
        ok: true,
        invoiceUrl,
      });

    } catch (err: any) {
      console.error("❌ Payment error:", err.message);
      return reply.status(500).send({ error: "Failed to create invoice" });
    }
  });

}