import React, { useState } from 'react';
import { Activity, Target, ArrowLeft, Zap, LayoutGrid, Cpu } from 'lucide-react';
import CombSimulator from './App';
import RakeSimulator from './rake';

const MainSwitch = () => {
  const [activeModule, setActiveModule] = useState(null);

  // --- 渲染 Comb Simulator ---
  if (activeModule === 'comb') {
    return (
      <div className="relative animate-in fade-in duration-500">
        <CombSimulator />
        <FloatingHomeButton onClick={() => setActiveModule(null)} />
      </div>
    );
  }

  // --- 渲染 Rake Simulator ---
  if (activeModule === 'rake') {
    return (
      <div className="relative animate-in fade-in duration-500">
        <RakeSimulator />
        <FloatingHomeButton onClick={() => setActiveModule(null)} />
      </div>
    );
  }

  // --- 首頁 (Launcher) ---
  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col items-center justify-center p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-4xl w-full space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black tracking-tight flex items-center justify-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/30">
              <Zap className="w-8 h-8 text-white" />
            </div>
            Jay <span className="text-indigo-500">Simulation Suite</span>
          </h1>
          <p className="text-slate-400 font-medium text-lg">Select an experimental engine to begin analysis</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Comb Card */}
          <button 
            onClick={() => setActiveModule('comb')}
            className="group relative bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 rounded-[2.5rem] p-8 text-left transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 space-y-6">
              <div className="w-14 h-14 bg-indigo-900/50 rounded-2xl flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
                <Cpu className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white mb-2 group-hover:text-indigo-400 transition-colors">Comb Engine</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Advanced edge detection with multi-tooth sampling and glare mitigation strategies.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-500 uppercase tracking-widest">
                <span>Launch Simulator</span>
                <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          {/* Rake Card */}
          <button 
            onClick={() => setActiveModule('rake')}
            className="group relative bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-[2.5rem] p-8 text-left transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 space-y-6">
              <div className="w-14 h-14 bg-emerald-900/50 rounded-2xl flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
                <Target className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white mb-2 group-hover:text-emerald-400 transition-colors">Rake Engine</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Precision line fitting with robust outlier rejection and sub-pixel accuracy.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase tracking-widest">
                <span>Launch Simulator</span>
                <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

const FloatingHomeButton = ({ onClick }) => (
  <button 
    onClick={onClick}
    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur-xl border border-slate-700 text-white px-6 py-3 rounded-full hover:bg-indigo-600 hover:border-indigo-500 hover:scale-105 transition-all shadow-2xl group flex items-center gap-3"
  >
    <LayoutGrid className="w-5 h-5" />
    <span className="text-xs font-black uppercase tracking-widest">Return to Suite</span>
  </button>
);

export default MainSwitch;