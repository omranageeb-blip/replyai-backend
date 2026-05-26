import axios from "axios";

export async function askAI(messages: any[]) {
  const res = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "openai/gpt-4o-mini",
      messages,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
    }
  );

  return res.data.choices[0].message.content;
}