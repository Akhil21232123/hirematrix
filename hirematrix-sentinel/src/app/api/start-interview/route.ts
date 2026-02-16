import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { name, email, role, difficulty } = await req.json();

    // 1. Create Video Room (Daily.co) - Recording Disabled for Free Tier
    const DAILY_API_KEY = process.env.DAILY_API_KEY;
    const roomRes = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          exp: Math.round(Date.now() / 1000) + 7200, // 2 Hours
          enable_chat: true,
          enable_recording: "false" // Fixes payment error
        }
      }),
    });
    const room = await roomRes.json();

    // 2. Register Candidate
    const { data, error } = await supabase.from('candidates').insert([{
      name, email, role, difficulty,
      room_url: room.url,
      status: 'ACTIVE',
      current_round: 1,
      integrity_score: 100
    }]).select().single();

    if (error) throw error;

    return NextResponse.json({ success: true, candidateId: data.id, roomUrl: room.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}