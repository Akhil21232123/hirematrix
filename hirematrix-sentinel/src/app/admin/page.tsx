"use client"
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, ShieldCheck, AlertCircle, FileText, Search, ExternalLink } from 'lucide-react';

export default function AdminDashboard() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCandidates();
    // Real-time subscription to see scores pop up live!
    const channel = supabase.channel('admin_room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, payload => {
        fetchCandidates();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchCandidates = async () => {
    const { data } = await supabase.from('candidates').select('*').order('created_at', { ascending: false });
    setCandidates(data || []);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Users className="text-red-600" /> HireMatrix Control Center
            </h1>
            <p className="text-gray-500 text-sm uppercase tracking-widest mt-1">Live Intelligence Feed</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-gray-900 px-4 py-2 rounded-lg border border-gray-800">
               <span className="text-gray-500 text-xs block">ACTIVE SESSIONS</span>
               <span className="text-xl font-mono">{candidates.filter(c => c.status === 'ACTIVE').length}</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-[#0a0a0a] rounded-2xl border border-gray-800 shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="p-4 text-xs font-black uppercase text-gray-500">Candidate</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500">Status</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500">Integrity</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500">Matrix Score</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500">Verdict</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-900/30 transition-colors">
                  <td className="p-4">
                    <div className="font-bold">{c.name}</div>
                    <div className="text-[10px] text-gray-500 uppercase">{c.role} • {c.difficulty}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                      c.status === 'COMPLETED' ? 'bg-green-900/30 text-green-500' : 
                      c.status === 'TERMINATED' ? 'bg-red-900/30 text-red-500' : 'bg-blue-900/30 text-blue-500'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                       <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full ${c.integrity_score < 50 ? 'bg-red-600' : 'bg-green-600'}`} style={{ width: `${c.integrity_score}%` }} />
                       </div>
                       <span className="text-xs font-mono">{c.integrity_score}%</span>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-xl font-black text-yellow-500">
                    {c.final_score || '---'}
                  </td>
                  <td className="p-4">
                    <div className="text-xs text-gray-300 italic max-w-[200px] truncate">
                      {c.final_report?.verdict || 'Waiting for completion...'}
                    </div>
                  </td>
                  <td className="p-4">
                    <button onClick={() => window.open(c.room_url, '_blank')} className="p-2 hover:text-red-500 transition-colors">
                      <ExternalLink size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}