import Groq from "groq-sdk";
import { NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  const { role, difficulty, roundNumber } = await req.json();

  // DEFINE THE MISSION PROFILE
  let promptContext = "";
  if (roundNumber === 1) promptContext = "Round 1: Algorithmic Logic. Ask a data structure question (Arrays, Maps, Trees).";
  if (roundNumber === 2) promptContext = "Round 2: Practical Engineering. Ask them to build a small utility function or fix a broken React/Node snippet.";
  if (roundNumber === 3) promptContext = "Round 3: Optimization & Security. Ask them to refactor a slow function or secure a vulnerable API handler.";

  const systemPrompt = `
    Generate a unique technical interview task for a ${difficulty} ${role}.
    Context: ${promptContext}
    
    Output JSON ONLY:
    {
      "title": "Short Task Name",
      "description": "Clear 2-sentence requirement.",
      "starterCode": "// Function signature..."
    }
  `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate task." }
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });

    const task = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return NextResponse.json(task);
  } catch (e) {
    return NextResponse.json({ 
      title: "Backup Task", 
      description: "Write a function to reverse a string.", 
      starterCode: "function solve() {}" 
    });
  }
}