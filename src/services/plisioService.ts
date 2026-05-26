import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const PLISIO_API_KEY = process.env.PLISIO_API_KEY!;
const BASE_URL = "https://plisio.net/api/v1";

export const PLAN_PRICES: Record<string, number> = {
  starter: 19,
  pro:     49,
  business: 149,
};

// =========================
// CREATE INVOICE
// =========================
export async function createInvoice(params: {
  companyId: string;
  companyName: string;
  plan: string;
  email: string;
}) {
  const { companyId, companyName, plan, email } = params;
  const amount = PLAN_PRICES[plan];

  if (!amount) throw new Error(`Invalid plan: ${plan}`);

  const response = await axios.get(`${BASE_URL}/invoices/new`, {
    params: {
      api_key:      PLISIO_API_KEY,
      currency:     "USDT_TRX",
      amount:       amount,
      order_number: `${companyId}-${plan}-${Date.now()}`,
      order_name:   `ReplyAI ${plan} — ${companyName}`,
      email:        email,
      callback_url: `${process.env.APP_URL}/api/plisio/webhook`,
      success_url:  `${process.env.APP_URL}/payment/success`,
      fail_url:     `${process.env.APP_URL}/payment/failed`,
    },
  });

  if (response.data.status !== "success") {
    throw new Error("Plisio invoice creation failed");
  }

  return {
    invoiceUrl: response.data.data.invoice_url,
    invoiceId:  response.data.data.txn_id,
  };
}

// =========================
// VERIFY PLISIO SIGNATURE
// =========================
export function verifyPlisioSignature(data: any): boolean {
  try {
    const receivedSignature = data.verify_hash;
    if (!receivedSignature) return false;

    const dataToVerify = { ...data };
    delete dataToVerify.verify_hash;

    const sortedData = Object.keys(dataToVerify)
      .sort()
      .reduce((acc: any, key) => {
        acc[key] = dataToVerify[key];
        return acc;
      }, {});

    const queryString = new URLSearchParams(sortedData).toString();
    const expectedSignature = crypto
      .createHmac("sha1", PLISIO_API_KEY)
      .update(queryString)
      .digest("hex");

    return receivedSignature === expectedSignature;
  } catch {
    return false;
  }
}