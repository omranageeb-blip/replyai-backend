import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { sendRenewalReminder, sendSubscriptionExpired } from "./emailService";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

export function startCronJobs() {
  // يعمل كل يوم الساعة 9 صباحاً
  cron.schedule("0 9 * * *", async () => {
    console.log("⏰ Running subscription check...");

    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // =========================
    // 1. إيقاف المنتهية
    // =========================
    const expired = await prisma.company.findMany({
      where: {
        plan: { not: "free" },
        subscriptionStatus: "active",
        subscriptionEnd: { lt: now },
        isActive: true,
      },
    });

    for (const company of expired) {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          subscriptionStatus: "expired",
          isActive: false,
          plan: "free",
          messageLimit: 500,
        },
      });

      console.log(`❌ Subscription expired: ${company.name}`);

      if (company.contactEmail) {
        try {
          await sendSubscriptionExpired({
            to: company.contactEmail,
            companyName: company.name,
            checkoutUrl: `${process.env.APP_URL}/dashboard.html`,
          });
        } catch (err: any) {
          console.error("❌ Email error:", err.message);
        }
      }
    }

    // =========================
    // 2. تنبيه قرب الانتهاء (3 أيام)
    // =========================
    const expiringSoon = await prisma.company.findMany({
      where: {
        plan: { not: "free" },
        subscriptionStatus: "active",
        subscriptionEnd: {
          gte: now,
          lte: in3Days,
        },
        contactEmail: { not: null },
      },
    });

    for (const company of expiringSoon) {
      const daysLeft = Math.ceil(
        (new Date(company.subscriptionEnd!).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      try {
        await sendRenewalReminder({
          to: company.contactEmail!,
          companyName: company.name,
          daysLeft,
          checkoutUrl: `${process.env.APP_URL}/dashboard.html`,
        });
      } catch (err: any) {
        console.error("❌ Reminder email error:", err.message);
      }
    }

    console.log(
      `✅ Cron done — expired: ${expired.length}, reminders: ${expiringSoon.length}`
    );
  });

  console.log("⏰ Cron jobs started");
}