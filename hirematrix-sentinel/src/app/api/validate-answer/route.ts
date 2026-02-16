import Groq from "groq-sdk";
import { NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { question, answer, previousChat } = await req.json();

    const systemPrompt = `
      You are an Interrogator. The user is answering a technical question.
      Question: "${question}"
      User Answer: "${answer}"
      
      Determine if the answer is:
      1. Valid (Attempts to answer)
      2. Gibberish/Spam (e.g., "bbwrb", "fsdfs", "idk")
      3. Evasive
      
      Output JSON ONLY:
      {
        "isValid": (boolean),
        "rating": "GOOD" | "WEAK" | "SPAM",
        "botReply": "Your response to them. If SPAM, be angry."
      }
    `;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...previousChat.slice(-2) // Short context
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return NextResponse.json(result);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}