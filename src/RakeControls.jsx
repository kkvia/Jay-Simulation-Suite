import React from 'react';
import { Settings, Maximize2, Filter, ImageIcon, Upload, FileText, Wind } from 'lucide-react';

const RakeControls = ({ 
  config, setConfig, imageSource, fileInputRef, handleImageUpload 
}) => {
  const update = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

  return (
    <div className="w-full lg:w-[420px] flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar shrink-0 pb-20 lg:pb-0">
      {/* 上傳 */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg space-y-4">
         <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 font-bold"><ImageIcon className="w-4 h-4 text-indigo-500" /> Image Source</h3>
         <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
         <button onClick={() => fileInputRef.current.click()} className="w-full py-4 bg-indigo-50 text-indigo-600 rounded-2xl border-2 border-dashed border-indigo-200 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2 font-bold">
           <Upload className="w-4 h-4" /> {imageSource ? "Change Data Base" : "Upload Bottom Map"}
         </button>
      </div>

      {/* ROI Setup */}
      <div className="bg-white p-7 rounded-[2rem] border border-slate-100 shadow-lg space-y-8 font-bold">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"><Maximize2 className="w-4 h-4" /> ROI Positioning</h3>
        </div>
        <div className="grid grid-cols-2 gap-8 font-bold">
            {[
              { label: "Center X", key: "centerX", min: 0, max: 500 },
              { label: "Center Y", key: "centerY", min: 0, max: 500 },
              { label: "L1 Length", key: "roiL1", min: 10, max: 250 },
              { label: "L2 Width", key: "roiL2", min: 10, max: 250 }
            ].map((item) => (
              <div key={item.key} className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-black uppercase">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="text-indigo-600 font-mono">{Math.round(config[item.key])}</span>
                </div>
                <input type="range" min={item.min} max={item.max} value={config[item.key]} onChange={e=>update(item.key, Number(e.target.value))} className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600" />
              </div>
            ))}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          {['TopToBottom', 'BottomToTop', 'LeftToRight', 'RightToLeft'].map(d => (
            <button key={d} onClick={() => update('direction', d)} className={`py-3 text-[9px] font-black rounded-xl border-2 transition-all ${config.direction === d ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg font-bold' : 'bg-white border-slate-100 text-slate-400 font-bold'}`}>{d}</button>
          ))}
        </div>
      </div>

      {/* Algorithm Control */}
      <div className="bg-white p-7 rounded-[2rem] border border-slate-100 shadow-lg space-y-10 font-bold">
        <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><Settings className="w-4 h-4" /> Algorithm Control</h3>
        <div className="space-y-10">
          <div className="space-y-4 font-bold">
            <div className="flex justify-between items-center font-bold"><label className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Sigma</label><span className="text-indigo-600 font-mono text-xs font-bold">{config.sigma.toFixed(1)}</span></div>
            <input type="range" min="0.4" max="5.0" step="0.1" value={config.sigma} onChange={e=>update('sigma', Number(e.target.value))} className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600" />
          </div>
          {/* ... 其他參數 ... */}
        </div>
      </div>

      {/* Jay's Expert Insights */}
      <div className="bg-[#0F172A] rounded-[2rem] p-8 shadow-2xl relative overflow-hidden shrink-0">
         <div className="relative z-10 space-y-4 font-bold">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500 rounded-lg animate-pulse"><FileText className="w-4 h-4 text-white" /></div>
              <span className="text-white font-black text-[10px] uppercase tracking-widest">量測實驗室報告</span>
            </div>
            <div className="space-y-4 text-[11px] text-slate-400 leading-relaxed font-medium">
              <p className="border-l-2 border-indigo-500 pl-4"><b>極性對齊：</b> 實體邊緣具備厚度。在 <code className="text-indigo-400">Negative</code> 極性下，Rake 鎖定進入線段的邊界。</p>
            </div>
         </div>
         <Wind className="absolute -right-10 -bottom-10 w-48 h-48 text-indigo-500 opacity-5" />
      </div>
    </div>
  );
};

export default RakeControls;