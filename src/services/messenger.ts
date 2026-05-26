import axios from "axios";

export async function sendMessage(psid: string, text: string, token: string) {
  await axios.post(
    "https://graph.facebook.com/v19.0/me/messages",
    {
      recipient: { id: psid },
      message: { text },
    },
    {
      params: { access_token: token },
    }
  );
}