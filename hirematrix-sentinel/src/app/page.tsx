"use client"
import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
import DailyIframe from '@daily-co/daily-js';
import { supabase } from '@/lib/supabase';
import { 
  ShieldAlert, Terminal, Play, Timer, Zap, Lock, User, 
  CheckCircle, ArrowRight, Brain, Camera, Mic, Send, 
  Award, ShieldCheck, Loader2, AlertTriangle, FileText, 
  BarChart3, Cpu, Activity
} from 'lucide-react';

export default function SentinelClient() {
  // --- STATE ---
  const [gameState, setGameState] = useState<'REGISTRATION' | 'ACCESS_DENIED' | 'LOADING' | 'ROUND_ACTIVE' | 'INTERROGATION' | 'FEEDBACK' | 'COMPLETED' | 'TERMINATED'>('REGISTRATION');
  const [terminationReason, setTerminationReason] = useState("Unknown Integrity Breach");

  // --- DATA ---
  const [formData, setFormData] = useState({ name: '', email: '', role: 'Frontend Developer', seniority: 'Intermediate' });
  const [candidateId, setCandidateId] = useState("");
  const [finalReport, setFinalReport] = useState<any>(null);
  
  // --- ROUND DATA ---
  const [currentRound, setCurrentRound] = useState(1);
  const [task, setTask] = useState({ title: "Initializing...", description: "", starterCode: "" });
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("> Console Ready...");
  
  // --- INTERROGATION ---
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [chatHistory, setChatHistory] = useState<{sender: 'AI' | 'USER', text: string}[]>([]);
  const [aiFeedback, setAiFeedback] = useState("");

  const videoRef = useRef<HTMLDivElement>(null);
  const callFrame = useRef<any>(null);
  const [timeLeft, setTimeLeft] = useState(1200);

  // 1. START
  const requestAccessAndStart = async () => {
    if (!formData.name.trim() || !formData.email.includes('@')) return alert("IDENTITY REQUIRED");
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(() => { throw new Error("PERMISSION_DENIED"); });
      if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      setGameState('LOADING');
      
      const res = await fetch('/api/start-interview', { method: 'POST', body: JSON.stringify({ ...formData, difficulty: formData.seniority === 'Senior' ? 'Hard' : 'Medium' }) });
      if (!res.ok) throw new Error("Connection Failed");
      const data = await res.json();
      setCandidateId(data.candidateId);

      setTimeout(async () => {
        if (videoRef.current && !callFrame.current) {
          callFrame.current = DailyIframe.createFrame(videoRef.current, { showLeaveButton: false, iframeStyle: { width: '100%', height: '100%', borderRadius: '12px', border: 'none' } });
          await callFrame.current.join({ url: data.roomUrl });
        }
      }, 500);
      await loadRound(1);
    } catch (e: any) {
      if (e.message === "PERMISSION_DENIED") setGameState('ACCESS_DENIED');
      else { alert(e.message); setGameState('REGISTRATION'); }
    }
  };

  // 2. ROUNDS
  const loadRound = async (roundNum: number) => {
    try {
      setGameState('LOADING');
      const res = await fetch('/api/get-round', { method: 'POST', body: JSON.stringify({ role: formData.role, difficulty: formData.seniority, roundNumber: roundNum }) });
      const newTask = await res.json();
      setTask(newTask); setCode(newTask.starterCode); setCurrentRound(roundNum); setTimeLeft(1200); 
      setGameState('ROUND_ACTIVE');
    } catch (e) { window.location.reload(); }
  };

  const submitRound = async () => {
    setGameState('LOADING');
    try {
      const res = await fetch('/api/submit-round', { method: 'POST', body: JSON.stringify({ candidateId, code, roundNumber: currentRound, role: formData.role, taskTitle: task.title }) });
      const result = await res.json();

      if (result.terminate || !result.success) {
        setTerminationReason(result.reason || "Code Quality Critical Failure");
        setGameState('TERMINATED');
        return;
      }
      setAiFeedback(result.feedback);
      setAiQuestions(result.questions || ["Explain logic."]);
      setCurrentQuestionIndex(0);
      setChatHistory([{ sender: 'AI', text: result.questions ? result.questions[0] : "Explain." }]);
      setGameState('INTERROGATION');
    } catch (e) { setGameState('ROUND_ACTIVE'); alert("Submission Failed"); }
  };

  // 3. INTERROGATION
  const submitAnswer = async () => {
    if (!userAnswer.trim()) return;
    const userText = userAnswer; setUserAnswer("");
    setChatHistory(prev => [...prev, { sender: 'USER', text: userText }]);

    setTimeout(async () => {
      if (currentQuestionIndex < aiQuestions.length - 1) {
        const nextQ = aiQuestions[currentQuestionIndex + 1];
        setChatHistory(prev => [...prev, { sender: 'AI', text: nextQ }]);
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        if (currentRound < 3) {
          setGameState('FEEDBACK');
        } else {
          await finishInterview();
        }
      }
    }, 800);
  };

  const finishInterview = async () => {
    setGameState('LOADING');
    const res = await fetch('/api/submit-report', { method: 'POST', body: JSON.stringify({ candidateId }) });
    const data = await res.json();
    setFinalReport(data.report);
    setGameState('COMPLETED');
  };

  // 4. SECURITY
  useEffect(() => {
    if (gameState !== 'ROUND_ACTIVE' && gameState !== 'INTERROGATION') return;
    const terminate = (reason: string) => {
      setTerminationReason(reason); setGameState('TERMINATED');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      supabase.from('candidates').update({ status: 'TERMINATED', integrity_score: 0 }).eq('id', candidateId).then();
    };
    const handleFS = () => { if (!document.fullscreenElement) terminate("FULLSCREEN_BREACH"); };
    const handleVis = () => { if (document.hidden) terminate("TAB_SWITCH_BREACH"); };
    const timer = setInterval(() => setTimeLeft(p => p <= 1 ? (terminate("TIME_EXPIRED"), 0) : p - 1), 1000);
    document.addEventListener("fullscreenchange", handleFS); document.addEventListener("visibilitychange", handleVis);
    return () => { document.removeEventListener("fullscreenchange", handleFS); document.removeEventListener("visibilitychange", handleVis); clearInterval(timer); };
  }, [gameState, candidateId]);

  const runCode = () => {
    setOutput("> Compiling...");
    setTimeout(() => {
      try {
        let logs: string[] = [];
        const mockConsole = { log: (...args: any[]) => logs.push(args.join(' ')) };
        new Function('console', code + `\ntry { return solution(); } catch(e) { return "Error: " + e.message; }`)(mockConsole);
        setOutput(`> LOGS:\n${logs.join('\n')}`);
      } catch (e: any) { setOutput(`> SYNTAX ERROR:\n${e.message}`); }
    }, 500);
  };

  // --- UI ---

  if (gameState === 'REGISTRATION') return (
    <div className="h-screen bg-black flex items-center justify-center font-mono text-white p-4">
      <div className="max-w-md w-full bg-[#0a0a0a] border border-gray-800 p-8 rounded-3xl shadow-2xl">
        <div className="text-center mb-8"><ShieldAlert size={56} className="mx-auto text-red-600 mb-4 animate-pulse"/><h1 className="text-4xl font-black italic uppercase text-white">HireMatrix <span className="text-red-600">V5</span></h1></div>
        <div className="space-y-4">
          <input className="w-full bg-[#111] border border-gray-700 rounded-lg p-3 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Full Name"/>
          <input className="w-full bg-[#111] border border-gray-700 rounded-lg p-3 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Email"/>
          <div className="grid grid-cols-2 gap-4">
            <select className="bg-[#111] border border-gray-700 rounded-lg p-3" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}><option>Frontend</option><option>Backend</option></select>
            <select className="bg-[#111] border border-gray-700 rounded-lg p-3" value={formData.seniority} onChange={e => setFormData({...formData, seniority: e.target.value})}><option>Junior</option><option>Senior</option></select>
          </div>
          <button onClick={requestAccessAndStart} className="w-full py-4 mt-6 bg-red-600 hover:bg-red-700 rounded-xl font-bold uppercase tracking-widest flex justify-center gap-2"><Camera size={16}/> Start</button>
        </div>
      </div>
    </div>
  );

  if (gameState === 'ACCESS_DENIED') return <div className="h-screen bg-black flex flex-col items-center justify-center text-white"><Lock size={60} className="text-red-600 mb-4"/><h1 className="text-3xl font-black">ACCESS DENIED</h1><button onClick={() => window.location.reload()} className="mt-8 bg-white text-black px-6 py-2 rounded-full font-bold">RETRY</button></div>;
  
  if (gameState === 'LOADING') return <div className="h-screen bg-black/90 flex flex-col items-center justify-center text-white"><Loader2 size={64} className="animate-spin text-red-600"/><p className="mt-4 font-bold tracking-widest">PROCESSING...</p></div>;

  if (gameState === 'INTERROGATION') return (
    <div className="h-screen bg-[#050505] flex items-center justify-center text-white p-6 font-sans">
      <div className="max-w-2xl w-full bg-[#0a0a0a] border border-gray-800 p-6 rounded-3xl h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center gap-3 mb-4 border-b border-gray-800 pb-4"><Brain size={32} className="text-red-500 animate-pulse"/><div><h2 className="text-xl font-bold uppercase">Defense Protocol</h2></div></div>
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">{chatHistory.map((m, i) => (<div key={i} className={`p-3 rounded-xl text-sm max-w-[85%] ${m.sender === 'AI' ? 'bg-red-950/20 text-red-100' : 'bg-blue-600 text-white self-end'}`}>{m.text}</div>))}</div>
        <div className="flex gap-2"><input value={userAnswer} onChange={e => setUserAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitAnswer()} className="flex-1 bg-[#111] border border-gray-700 rounded-lg p-3 outline-none" autoFocus placeholder="Type answer..."/><button onClick={submitAnswer} className="bg-red-600 p-3 rounded-lg"><Send size={18}/></button></div>
      </div>
    </div>
  );

  if (gameState === 'FEEDBACK') return (
    <div className="h-screen bg-[#050505] flex items-center justify-center text-white p-6">
      <div className="max-w-2xl w-full bg-[#0a0a0a] border border-gray-800 p-8 rounded-3xl">
        <h2 className="text-2xl font-bold uppercase mb-4 text-blue-500">Round {currentRound} Complete</h2>
        <div className="bg-blue-900/10 border border-blue-500/20 p-6 rounded-xl mb-8 text-blue-100 italic">"{aiFeedback}"</div>
        <button onClick={() => loadRound(currentRound + 1)} className="w-full py-4 bg-white text-black font-bold uppercase rounded-xl flex justify-center gap-2">Next Round <ArrowRight/></button>
      </div>
    </div>
  );

  if (gameState === 'TERMINATED') return <div className="h-screen bg-red-700 flex flex-col items-center justify-center text-black font-black uppercase"><Lock size={100} className="mb-6"/><h1 className="text-8xl">TERMINATED</h1><p className="text-2xl mt-4 bg-black text-red-500 px-4 py-2">{terminationReason}</p></div>;

  // --- FINAL SCORECARD ---
  if (gameState === 'COMPLETED' && finalReport) return (
    <div className="h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-4 overflow-hidden relative">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:20px_20px]"></div>
      
      <div className="relative bg-[#111] border-4 border-yellow-600/40 p-8 rounded-xl max-w-5xl w-full shadow-[0_0_100px_rgba(234,179,8,0.15)] flex gap-8">
        
        {/* Left: Certificate Info */}
        <div className="flex-1 text-left space-y-6">
          <div className="flex items-center gap-4">
             <Award size={64} className="text-yellow-500" />
             <div>
               <h1 className="text-4xl font-serif font-bold text-yellow-500">HIREMATRIX</h1>
               <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Intelligence Report</p>
             </div>
          </div>

          <div className="space-y-2">
            <p className="text-gray-400 text-xs uppercase">Candidate</p>
            <h2 className="text-3xl font-bold">{formData.name}</h2>
            <div className="flex gap-2">
               <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-300">{formData.seniority}</span>
               <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-300">{formData.role}</span>
            </div>
          </div>

          <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800">
             <p className="text-xs text-gray-400 uppercase mb-2">Sentinel Verdict</p>
             <p className="text-xl font-bold text-white italic">"{finalReport.verdict}"</p>
             <p className="text-xs text-gray-500 mt-2">{finalReport.summary}</p>
          </div>

          <div className="flex items-center gap-8 pt-8 opacity-80">
            <div>
               <div className="font-serif text-2xl italic text-yellow-600 font-bold">A.K.H.I.L</div>
               <div className="h-px w-32 bg-gray-600 mb-1"/>
               <p className="text-[8px] uppercase">Sentinel AI Admin</p>
            </div>
            <div className="w-16 h-16 rounded-full border-2 border-red-900 text-red-900 flex items-center justify-center rotate-[-12deg]">
               <ShieldCheck size={24}/>
            </div>
          </div>
        </div>

        {/* Right: The Data Visuals */}
        <div className="w-96 bg-black/50 rounded-xl p-6 border border-gray-800 flex flex-col justify-between">
           
           {/* Total Score */}
           <div className="text-center mb-6">
             <div className="text-6xl font-black text-white mb-1">{finalReport.hirematrix_score}</div>
             <div className="text-xs uppercase tracking-widest text-gray-500">/ 1000 Score</div>
           </div>

           {/* Metrics */}
           <div className="space-y-4">
             <div>
               <div className="flex justify-between text-xs mb-1">
                 <span className="text-gray-400 flex items-center gap-1"><Cpu size={12}/> Correctness</span>
                 <span className="font-bold">{finalReport.breakdown.correctness}%</span>
               </div>
               <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${finalReport.breakdown.correctness}%` }}/></div>
             </div>
             <div>
               <div className="flex justify-between text-xs mb-1">
                 <span className="text-gray-400 flex items-center gap-1"><Zap size={12}/> Efficiency</span>
                 <span className="font-bold">{finalReport.breakdown.time_efficiency}%</span>
               </div>
               <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-yellow-500" style={{ width: `${finalReport.breakdown.time_efficiency}%` }}/></div>
             </div>
             <div>
               <div className="flex justify-between text-xs mb-1">
                 <span className="text-gray-400 flex items-center gap-1"><Activity size={12}/> Logic</span>
                 <span className="font-bold">{finalReport.breakdown.critical_thinking}%</span>
               </div>
               <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${finalReport.breakdown.critical_thinking}%` }}/></div>
             </div>
           </div>

           {/* Key Insights */}
           <div className="mt-8 space-y-3">
              <div className="text-xs">
                <span className="text-green-500 font-bold uppercase">Strength:</span> <span className="text-gray-300">{finalReport.key_strength}</span>
              </div>
              <div className="text-xs">
                <span className="text-red-500 font-bold uppercase">Weakness:</span> <span className="text-gray-300">{finalReport.key_weakness}</span>
              </div>
           </div>

        </div>

      </div>
    </div>
  );

  // G. ACTIVE ROUND
  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden font-sans">
      <div className="h-14 bg-black border-b border-gray-800 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-6"><div className="flex items-center gap-2 bg-red-950/20 px-3 py-1 rounded border border-red-900/40"><span className="w-2 h-2 bg-red-600 rounded-full animate-ping"/><span className="text-[10px] font-black uppercase text-red-500 tracking-widest">Live Uplink</span></div><div className="text-xs font-mono text-gray-400 flex items-center gap-2"><Timer size={14}/> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</div></div>
        <div className="flex items-center gap-4 text-[10px] font-bold uppercase text-gray-500"><span className="text-yellow-500 border border-yellow-500/30 px-3 py-1 rounded">Round {currentRound}/3</span><span>{formData.name}</span></div>
      </div>
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col border-r border-gray-800 min-w-0 relative">
          <div className="bg-[#0a0a0a] border-b border-gray-800 p-5"><h2 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Zap size={14}/> {task.title}</h2><p className="text-sm text-gray-300 leading-relaxed font-medium">{task.description}</p></div>
          <div className="flex-1 relative"><Editor height="100%" defaultLanguage="javascript" theme="vs-dark" value={code} onChange={v => setCode(v || "")} options={{ fontSize: 14, minimap: { enabled: false }, fontFamily: 'JetBrains Mono, monospace', padding: { top: 20 } }} /><div className="absolute bottom-6 right-6 flex gap-3 z-10"><button onClick={runCode} className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2 rounded shadow-lg text-xs font-bold uppercase flex items-center gap-2 border border-gray-600"><Play size={12}/> Run</button><button onClick={submitRound} className="bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded shadow-lg text-xs font-bold uppercase flex items-center gap-2">Submit Code</button></div></div>
          <div className="h-40 bg-black border-t border-gray-800 p-4 font-mono text-[11px] overflow-y-auto"><div className="text-gray-500 font-bold uppercase mb-2 flex items-center gap-2"><Terminal size={12}/> Console</div><pre className="text-gray-300 whitespace-pre-wrap pl-2 border-l-2 border-gray-800">{output}</pre></div>
        </div>
        <div className="w-80 bg-black flex flex-col border-l border-gray-800 shrink-0">
          <div className="p-4 h-full bg-[#050505] flex flex-col gap-4">
            <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-gray-800 relative shadow-inner"><div ref={videoRef} className="w-full h-full object-cover"/><div className="absolute top-3 left-3 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase flex items-center gap-1"><span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"/> REC</div></div>
            <div className="flex-1 bg-gray-900/20 rounded-xl p-4 border border-gray-800"><div className="text-[10px] font-black uppercase text-gray-500 mb-4 flex items-center gap-2"><Lock size={12}/> Protocols</div><ul className="text-[11px] text-gray-400 space-y-4 list-disc pl-4 leading-relaxed"><li>Round 1: Logic</li><li>Round 2: Practical</li><li>Round 3: Optimization</li><li className="text-red-400 font-bold">Leaving Fullscreen = TERMINATION</li></ul></div>
          </div>
        </div>
      </div>
    </div>
  );
}