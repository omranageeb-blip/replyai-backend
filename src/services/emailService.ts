import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendRenewalReminder(params: {
  to: string;
  companyName: string;
  daysLeft: number;
  checkoutUrl: string;
}) {
  const { to, companyName, daysLeft, checkoutUrl } = params;

  await transporter.sendMail({
    from: `"ReplyAI" <${process.env.EMAIL_USER}>`,
    to,
    subject: `⚠️ اشتراك ${companyName} ينتهي خلال ${daysLeft} أيام`,
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;max-width:600px;margin:0 auto;background:#0f0f1a;color:#fff;padding:40px;border-radius:16px">
        <h1 style="color:#6c63ff;margin-bottom:16px">⚡ ReplyAI</h1>
        <h2 style="margin-bottom:24px">تنبيه تجديد الاشتراك</h2>
        <p style="color:#aaa;line-height:1.8;margin-bottom:24px">
          مرحباً،<br><br>
          اشتراك شركة <strong style="color:#fff">${companyName}</strong> في ReplyAI 
          سينتهي خلال <strong style="color:#ff9900">${daysLeft} أيام</strong>.<br><br>
          لضمان استمرار خدمة الرد التلقائي بدون انقطاع، يرجى تجديد اشتراكك الآن.
        </p>
        <a href="${checkoutUrl}" 
           style="display:inline-block;padding:14px 32px;background:#6c63ff;color:#fff;text-decoration:none;border-radius:10px;font-size:16px">
          تجديد الاشتراك الآن
        </a>
        <p style="color:#555;font-size:12px;margin-top:32px">
          إذا قمت بالتجديد بالفعل، تجاهل هذه الرسالة.
        </p>
      </div>
    `,
  });

  console.log(`📧 Renewal reminder sent to: ${to}`);
}

export async function sendSubscriptionExpired(params: {
  to: string;
  companyName: string;
  checkoutUrl: string;
}) {
  const { to, companyName, checkoutUrl } = params;

  await transporter.sendMail({
    from: `"ReplyAI" <${process.env.EMAIL_USER}>`,
    to,
    subject: `❌ انتهى اشتراك ${companyName} في ReplyAI`,
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;max-width:600px;margin:0 auto;background:#0f0f1a;color:#fff;padding:40px;border-radius:16px">
        <h1 style="color:#6c63ff;margin-bottom:16px">⚡ ReplyAI</h1>
        <h2 style="color:#ff4444;margin-bottom:24px">انتهى اشتراكك</h2>
        <p style="color:#aaa;line-height:1.8;margin-bottom:24px">
          انتهى اشتراك شركة <strong style="color:#fff">${companyName}</strong>.<br><br>
          تم إيقاف خدمة الرد التلقائي مؤقتاً. جدد اشتراكك لإعادة تفعيل الخدمة.
        </p>
        <a href="${checkoutUrl}"
           style="display:inline-block;padding:14px 32px;background:#6c63ff;color:#fff;text-decoration:none;border-radius:10px;font-size:16px">
          تجديد الاشتراك
        </a>
      </div>
    `,
  });

  console.log(`📧 Expiry notice sent to: ${to}`);
}