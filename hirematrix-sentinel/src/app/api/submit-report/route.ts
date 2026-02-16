import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { candidateId } = await req.json();

    // 1. GATHER EVIDENCE (Fetch all rounds)
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('round_number', { ascending: true });

    const { data: candidate } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (!rounds || rounds.length === 0) {
      return NextResponse.json({ error: "No data found" }, { status: 400 });
    }

    // 2. THE GRAND JURY PROMPT
    const systemPrompt = `
      You are the Chief Architect of HireMatrix.
      Analyze this candidate's performance across 3 technical rounds.
      
      CANDIDATE DATA:
      Name: ${candidate.name}
      Role: ${candidate.role} (${candidate.seniority})
      
      PERFORMANCE LOG:
      ${rounds.map((r: any) => `
        Round ${r.round_number}: ${r.task_title}
        Code Submitted: 
        ${r.submitted_code.substring(0, 500)}... (truncated)
        AI Feedback: ${r.ai_feedback}
      `).join('\n')}
      
      GENERATE FINAL REPORT (JSON ONLY):
      {
        "hirematrix_score": (Integer 0-1000),
        "verdict": "TOP 1% TALENT" | "HIGHLY SKILLED" | "COMPETENT" | "NEEDS IMPROVEMENT",
        "thinking_level": "Level 1 (Basic)" to "Level 5 (Visionary)",
        "breakdown": {
          "correctness": (0-100),
          "time_efficiency": (0-100, judge based on code complexity/Big O),
          "critical_thinking": (0-100)
        },
        "summary": "2 sentence ruthless summary of their coding style.",
        "key_strength": "Their best trait",
        "key_weakness": "Their worst habit"
      }
    `;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "system", content: systemPrompt }],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });

    const report = JSON.parse(completion.choices[0]?.message?.content || "{}");

    // 3. STORE THE VERDICT
    await supabase.from('candidates').update({ 
      final_report: report,
      final_score: report.hirematrix_score,
      status: 'COMPLETED'
    }).eq('id', candidateId);

    return NextResponse.json({ success: true, report });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}