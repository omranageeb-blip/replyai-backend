export function generateApiKey() {
  return (
    "replyai_" +
    Math.random().toString(36).substring(2) +
    Date.now().toString(36)
  );
}