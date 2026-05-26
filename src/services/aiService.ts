import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export async function generateAIResponse(messages: any[]) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5000",
          "X-Title": "ReplyAI",
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error: any) {
    console.error(
      "❌ OpenRouter Error:",
      error.response?.data || error.message
    );
    return "عذراً، حدث خطأ مؤقت. يرجى المحاولة مرة أخرى.";
  }
}