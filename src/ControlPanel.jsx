import React from 'react';
import { Settings, Maximize2, Filter, ImageIcon, Trash2, Upload, Zap, Wind } from 'lucide-react';

const ControlPanel = ({ 
  config, setConfig, imageSource, setImageSource, setPixelData, fileInputRef, handleImageUpload 
}) => {
  const update = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

  return (
    <div className="w-[420px] flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar shrink-0">
      {/* Image Source */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ImageIcon className="w-4 h-4 text-indigo-500" /> Image Source</h3>
          {imageSource && <button onClick={() => { setImageSource(null); setPixelData(null); }} className="text-rose-500 hover:scale-110 transition-transform"><Trash2 className="w-4 h-4" /></button>}
        </div>
        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
        <button onClick={() => fileInputRef.current.click()} className="w-full py-4 bg-indigo-50 text-indigo-600 rounded-2xl border-2 border-dashed border-indigo-200 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2">
          <Upload className="w-4 h-4" /> {imageSource ? "Change Image" : "Upload Bottom Map"}
        </button>
      </div>

      {/* ROI Geometry */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg space-y-6">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Maximize2 className="w-4 h-4 text-indigo-500" /> ROI Geometry</h3>
        <div className="grid grid-cols-1 gap-5">
          {[
            { label: "Center Row", key: "centerY", min: 0, max: 500 },
            { label: "Center Col", key: "centerX", min: 0, max: 500 },
            { label: "Width", key: "roiW", min: 10, max: 500 },
            { label: "Height", key: "roiH", min: 10, max: 500 }
          ].map((item) => (
            <div key={item.key} className="space-y-3">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                <span className="text-slate-400">{item.label}</span>
                <span className="text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded">{Math.round(config[item.key])}</span>
              </div>
              <input type="range" min={item.min} max={item.max} value={config[item.key]} onChange={e => update(item.key, Number(e.target.value))} className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {['TopToBottom', 'BottomToTop', 'LeftToRight', 'RightToLeft'].map(d => (
            <button key={d} onClick={() => update('scanDir', d)} className={`py-2.5 text-[9px] font-black rounded-xl border-2 transition-all ${config.scanDir === d ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}>{d}</button>
          ))}
        </div>
      </div>

      {/* Algorithm Logic */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg space-y-6">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Settings className="w-4 h-4 text-amber-500" /> Algorithm Logic</h3>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase">Comb Density</label>
              <input type="number" value={config.combDensity} onChange={e => update('combDensity', Number(e.target.value))} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-black font-mono" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase">Peak Count</label>
              <input type="number" value={config.peakCount} onChange={e => update('peakCount', Number(e.target.value))} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-black font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase">Sigma</label>
              <input type="number" step="0.1" value={config.sigma} onChange={e => update('sigma', Number(e.target.value))} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-black font-mono" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase">Threshold</label>
              <input type="number" value={config.threshold} onChange={e => update('threshold', Number(e.target.value))} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-black font-mono" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Polarity</label>
            <div className="grid grid-cols-2 gap-2">
              {['negative', 'positive'].map(p => (
                <button key={p} onClick={() => update('polarity', p)} className={`py-3 text-[9px] font-black rounded-xl border-2 transition-all uppercase ${config.polarity === p ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>{p}</button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transition Select</label>
            <div className="grid grid-cols-3 gap-2">
              {['first', 'last', 'strongest'].map(mode => (
                <button key={mode} onClick={() => update('edgeSelection', mode)} className={`py-2 text-[8px] font-black rounded-lg border transition-all uppercase ${config.edgeSelection === mode ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>{mode}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Layers */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg space-y-6">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Filter className="w-4 h-4 text-emerald-500" /> Filter Layers</h3>
        <div className="space-y-6">
          {[
            { key: 'enableIQR', vKey: 'iqrFactor', label: "IQR 統計離群係數", min: 0.5, max: 3 },
            { key: 'enableRolling', vKey: 'rollingRadius', label: "滾球形態學半徑", min: 2, max: 30 }
          ].map((f) => (
            <div key={f.key} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-600">{f.label}</span>
                <button onClick={() => update(f.key, !config[f.key])} className={`w-10 h-5 rounded-full transition-all relative ${config[f.key] ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config[f.key] ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>
              <input type="range" min={f.min} max={f.max} step="0.1" value={config[f.vKey]} onChange={e => update(f.vKey, Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-full appearance-none accent-indigo-600" />
            </div>
          ))}
          
          <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
            <div className="flex justify-between items-center text-[10px] font-black text-indigo-600">
              <span>NEIGHBORHOOD 鄰域</span>
              <button onClick={() => update('enableNeighbor', !config.enableNeighbor)} className={`w-10 h-5 rounded-full relative ${config.enableNeighbor ? 'bg-indigo-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full ${config.enableNeighbor ? 'left-6' : 'left-1'}`}></div></button>
            </div>
            <input type="range" min="1" max="10" value={config.neighborK} onChange={e => update('neighborK', Number(e.target.value))} className="w-full h-1 bg-indigo-100 accent-indigo-600" />
          </div>
        </div>
      </div>

      {/* Insight Panel */}
      <div className="bg-[#0F172A] rounded-3xl p-8 shadow-2xl relative overflow-hidden shrink-0">
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500 rounded-xl shadow-lg animate-pulse"><Zap className="w-5 h-5 text-white" /></div>
            <span className="text-white font-black text-[11px] uppercase tracking-[0.3em]">Jay's Insight</span>
          </div>
          <p className="text-[12px] leading-relaxed text-slate-400 font-medium italic border-l-2 border-indigo-500 pl-4">
            「面對反光，別跟它硬碰硬。切換到 <strong className="text-white">Last Mode</strong>，讓算法自動繞過前端的雜訊。」
          </p>
        </div>
        <Wind className="absolute -right-8 -bottom-8 w-40 h-40 text-indigo-500 opacity-5" />
      </div>
    </div>
  );
};

export default ControlPanel;