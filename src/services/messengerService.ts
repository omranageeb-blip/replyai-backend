export async function sendMessage(psid: string, text: string) {
  // 🔥 DEV MODE (No Facebook dependency)
  console.log("📤 [MOCK MESSAGE SENT]");
  console.log("➡️ To:", psid);
  console.log("💬 Message:", text);

  return {
    success: true,
    mode: "mock",
  };
}