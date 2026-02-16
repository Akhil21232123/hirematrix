import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { candidateId, code, roundNumber, taskTitle } = await req.json();

    // 1. THE "ZERO TOLERANCE" PROMPT
    const systemPrompt = `
      You are a Strict Code Analysis Engine.
      The user has submitted code for the task: "${taskTitle}".
      
      CRITICAL RULES:
      1. IGNORE polite conversation. If the code is just "hi", "hello", "I don't know", or random characters like "bbwrb", FAIL IMMEDIATELY.
      2. Check for Syntax: Is it valid code?
      3. Check for Logic: Does it attempt to solve "${taskTitle}"?
      
      OUTPUT FORMAT (JSON ONLY):
      {
        "passed": boolean, (TRUE only if code is valid and solves the problem),
        "score": number, (0-100),
        "feedback": "Technical reason for pass/fail.",
        "questions": ["Specific Question 1 about their code", "Question 2 about complexity", "Question 3 about edge cases"]
      }
    `;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `CANDIDATE SUBMISSION:\n${code}` }
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(completion.choices[0]?.message?.content || "{}");

    // 2. LOG THE ATTEMPT IN DB
    await supabase.from('rounds').insert([{
      candidate_id: candidateId,
      round_number: roundNumber,
      task_title: taskTitle,
      submitted_code: code,
      ai_feedback: analysis.feedback,
      score: analysis.score || 0
    }]);

    // 3. THE KILL SWITCH (Logic Enforcement)
    // If the AI says passed: false, WE TERMINATE. No second chances.
    if (!analysis.passed || analysis.score < 30) {
      await supabase.from('candidates').update({ 
        status: 'TERMINATED', 
        integrity_score: 0,
        violation_log: `Code Integrity Failure: ${analysis.feedback}`
      }).eq('id', candidateId);

      return NextResponse.json({ 
        success: false, 
        terminate: true,
        reason: `CODE REJECTED: ${analysis.feedback}` 
      });
    }

    // 4. UPDATE SCORE & RETURN QUESTIONS
    await supabase.from('candidates').update({ integrity_score: analysis.score }).eq('id', candidateId);

    return NextResponse.json({ 
      success: true, 
      passed: true,
      feedback: analysis.feedback,
      questions: analysis.questions || ["Explain your implementation.", "What is the time complexity?", "How would you handle large inputs?"]
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}