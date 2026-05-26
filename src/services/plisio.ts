import axios from "axios";

export async function createInvoice(email: string, amount: number) {
  const res = await axios.get("https://plisio.net/api/v1/invoices/new", {
    params: {
      api_key: process.env.PLISIO_API_KEY,
      amount,
      currency: "USDT",
      email,
    },
  });

  return res.data.data.invoice_url;
}