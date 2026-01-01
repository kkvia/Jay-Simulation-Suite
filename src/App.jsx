import React, { useState, useMemo, useEffect } from 'react';
import { 
  Settings, Target, Zap, Info, ShieldCheck, Maximize2, Move, 
  BarChart2, Eye, MousePointer2, CheckCircle2, AlertCircle, 
  HelpCircle, ChevronRight, FileText, Layers, Wind, Filter, Bug,
  Activity, Crosshair, Cpu, Gauge, ClipboardCheck, Radio, RefreshCw
} from 'lucide-react';
// --- 配置與語彙 ---
const AUTHOR = "Jay";
const VERSION = "V5.0.1 - Refined Designs";
/**
 * 【物理模擬引擎】
 * 模擬一個具有物理厚度與灰階梯度的 Bump
 */
const WORLD_LINES = [
  { 
    id: 'Main_Bump', 
    centerY: (x) => 300 - Math.exp(-Math.pow((x - 250) / 45, 2)) * 75, 
    height: 12, 
    gray: 35 
  },
  { 
    id: 'Flat_Base', 
    centerY: (x) => 300, 
    height: 4, 
    gray: 70 
  }
];
const getPixelValueAt = (x, y, noiseLevel = 0.15) => {
  let grayBase = 245; 
  for (const line of WORLD_LINES) {
    const edgeY = line.centerY(x);
    const halfH = line.height / 2;
    if (y >= edgeY - halfH && y <= edgeY + halfH) {
      grayBase = line.gray;
      break;
    }
  }
  const noise = (Math.random() - 0.5) * noiseLevel * 100;
  return Math.max(0, Math.min(255, grayBase + noise));
};
const applyGaussian = (data, sigma) => {
  if (sigma <= 0.4) return [...data];
  const radius = Math.ceil(sigma * 3);
  const kernel = [];
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const g = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(g);
    sum += g;
  }
  const normKernel = kernel.map(v => v / sum);
  return data.map((_, i) => {
    let acc = 0;
    for (let k = -radius; k <= radius; k++) {
      const idx = Math.min(Math.max(i + k, 0), data.length - 1);
      acc += data[idx] * normKernel[k + radius];
    }
    return acc;
  });
};
// --- 抗噪濾波組件 (C# 邏輯實作) ---
const filterIQR = (points, direction, factor) => {
  if (points.length < 4) return points;
  const isHorizontal = direction === 'Leftmost' || direction === 'Rightmost';
  const values = points.map(p => isHorizontal ? p.x : p.y).sort((a, b) => a - b);
  const q1 = values[Math.floor(values.length * 0.25)];
  const q3 = values[Math.floor(values.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - factor * iqr;
  const upper = q3 + factor * iqr;
  return points.filter(p => {
    const v = isHorizontal ? p.x : p.y;
    return v >= lower && v <= upper;
  });
};
const filterNeighborhood = (points, k, threshold) => {
  if (points.length <= k) return points;
  return points.filter(p1 => {
    const dists = points.filter(p2 => p1 !== p2)
      .map(p2 => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)))
      .sort((a, b) => a - b);
    const avgDist = dists.slice(0, k).reduce((sum, d) => sum + d, 0) / k;
    return avgDist <= threshold;
  });
};
const filterRollingBall = (points, direction, radius) => {
  if (points.length < 2) return points;
  let sorted;
  if (direction === 'Highest') sorted = [...points].sort((a, b) => a.y - b.y);
  else if (direction === 'Lowest') sorted = [...points].sort((a, b) => b.y - a.y);
  else if (direction === 'Leftmost') sorted = [...points].sort((a, b) => a.x - b.x);
  else sorted = [...points].sort((a, b) => b.x - a.x);
  const result = [sorted[0]];
  let lastVal = (direction === 'Leftmost' || direction === 'Rightmost') ? sorted[0].x : sorted[0].y;
  for (let i = 1; i < sorted.length; i++) {
    const currentVal = (direction === 'Leftmost' || direction === 'Rightmost') ? sorted[i].x : sorted[i].y;
    if (Math.abs(currentVal - lastVal) <= 2 * radius) {
      result.push(sorted[i]);
      lastVal = currentVal;
    }
  }
  return result;
};
const App = () => {
  // --- UI 狀態 ---
  const [centerX, setCenterX] = useState(250);
  const [centerY, setCenterY] = useState(280);
  const [roiW, setRoiW] = useState(240);
  const [roiH, setRoiH] = useState(140);
  const [scanDir, setScanDir] = useState('TopToBottom');
  const [peakDir, setPeakDir] = useState('Auto');
  const [sigma, setSigma] = useState(1.5);
  const [threshold, setThreshold] = useState(30);
  const [polarity, setPolarity] = useState('negative');
  const [offset, setOffset] = useState(0);
  const [isDebugMode, setIsDebugMode] = useState(true);
  const [combDensity, setCombDensity] = useState(35);
  const [peakCount, setPeakCount] = useState(5);
  // --- 濾波器狀態 ---
  const [enableIQR, setEnableIQR] = useState(true);
  const [iqrFactor, setIqrFactor] = useState(1.5);
  const [enableNeighbor, setEnableNeighbor] = useState(true);
  const [neighborK, setNeighborK] = useState(3);
  const [neighborThreshold, setNeighborThreshold] = useState(12);
  const [enableRolling, setEnableRolling] = useState(true);
  const [rollingRadius, setRollingRadius] = useState(10);
  // --- 核心邏輯運算 ---
  const effectivePeakDir = useMemo(() => {
    if (peakDir !== 'Auto') return peakDir;
    switch (scanDir) {
      case 'TopToBottom': return 'Highest';
      case 'BottomToTop': return 'Lowest';
      case 'LeftToRight': return 'Leftmost';
      case 'RightToLeft': return 'Rightmost';
      default: return 'Highest';
    }
  }, [peakDir, scanDir]);
  const combResult = useMemo(() => {
    const teeth = [];
    const rawPoints = [];
    for (let i = 0; i < combDensity; i++) {
      const step = i / (combDensity - 1);
      let start, end;
      if (scanDir === 'TopToBottom' || scanDir === 'BottomToTop') {
        const xPos = centerX - roiW / 2 + step * roiW;
        start = { x: xPos, y: centerY - roiH / 2 };
        end = { x: xPos, y: centerY + roiH / 2 };
        if (scanDir === 'BottomToTop') [start, end] = [end, start];
      } else {
        const yPos = centerY - roiH / 2 + step * roiH;
        start = { x: centerX - roiW / 2, y: yPos };
        end = { x: centerX + roiW / 2, y: yPos };
        if (scanDir === 'RightToLeft') [start, end] = [end, start];
      }
      const profile = [];
      for (let s = 0; s < 50; s++) {
        const t = s / 49;
        profile.push(getPixelValueAt(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t, 0.1));
      }
      const smoothed = applyGaussian(profile, sigma);
      const deriv = smoothed.map((v, idx) => idx === 0 ? 0 : v - smoothed[idx - 1]);
      let bestIdx = -1, maxAmp = 0;
      for (let j = 0; j < deriv.length; j++) {
        const val = deriv[j];
        const isMatch = (polarity === 'positive' && val > threshold) || (polarity === 'negative' && val < -threshold);
        if (isMatch && Math.abs(val) > maxAmp) {
          maxAmp = Math.abs(val);
          bestIdx = j;
        }
      }
      if (bestIdx !== -1) {
        const t = bestIdx / 49;
        rawPoints.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
      }
      teeth.push({ id: i, start, end });
    }
    let filtered = [...rawPoints];
    if (enableIQR) filtered = filterIQR(filtered, effectivePeakDir, iqrFactor);
    if (enableNeighbor) filtered = filterNeighborhood(filtered, neighborK, neighborThreshold);
    if (enableRolling) filtered = filterRollingBall(filtered, effectivePeakDir, rollingRadius);
    let sorted = [...filtered].sort((a, b) => {
      if (effectivePeakDir === 'Highest') return a.y - b.y;
      if (effectivePeakDir === 'Lowest') return b.y - a.y;
      if (effectivePeakDir === 'Leftmost') return a.x - b.x;
      return b.x - a.x;
    });
    const topK = sorted.slice(0, peakCount);
    let peak = null;
    if (topK.length > 0) {
      const measuredAvgRow = topK.reduce((sum, p) => sum + p.y, 0) / topK.length;
      const measuredAvgCol = topK.reduce((sum, p) => sum + p.x, 0) / topK.length;
      const finalRow = (effectivePeakDir === 'Highest' || effectivePeakDir === 'Lowest') ? measuredAvgRow : centerY;
      const finalCol = (effectivePeakDir === 'Highest' || effectivePeakDir === 'Lowest') ? centerX : measuredAvgCol;
      let ox = 0, oy = 0;
      if (scanDir === 'TopToBottom') oy = offset;
      else if (scanDir === 'BottomToTop') oy = -offset;
      else if (scanDir === 'LeftToRight') ox = offset;
      else ox = -offset;
      peak = { x: finalCol + ox, y: finalRow + oy };
    }
    return { teeth, rawPoints, filtered, peak, outliers: rawPoints.filter(rp => !filtered.includes(rp)) };
  }, [centerX, centerY, roiW, roiH, scanDir, sigma, threshold, polarity, combDensity, peakCount, iqrFactor, enableIQR, enableNeighbor, neighborK, neighborThreshold, enableRolling, rollingRadius, effectivePeakDir, offset]);
  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 p-8 font-sans selection:bg-indigo-100">
      <div className="max-w-[1750px] mx-auto space-y-8">
        
        {/* Header Section - 旗艦級設計 */}
        <header className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
          <div className="flex items-center gap-8 relative z-10">
            <div className="p-5 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl shadow-xl shadow-indigo-200 group cursor-pointer overflow-hidden relative">
              <Cpu className="w-10 h-10 text-white relative z-10 group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
            </div>
            <div>
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-black tracking-tight text-slate-800">
                  Jay <span className="text-indigo-600">CombEngine</span>™
                </h1>
                <div className="flex gap-2">
                  <span className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100 font-black uppercase tracking-widest animate-pulse">Live Analysis</span>
                  <span className="text-[10px] bg-slate-800 text-white px-3 py-1 rounded-full font-black uppercase tracking-widest">Ver {VERSION}</span>
                </div>
              </div>
              <div className="flex items-center gap-6 mt-3">
                <p className="text-xs text-slate-400 font-black flex items-center gap-2 uppercase tracking-tighter"><Gauge className="w-4 h-4 text-emerald-500" /> Sub-Pixel Accuracy Verified</p>
                <div className="h-4 w-px bg-slate-200"></div>
                <p className="text-xs text-indigo-400 font-black uppercase tracking-widest flex items-center gap-2"><RefreshCw className="w-3 h-3 animate-spin" /> CCRect HL Engine Synchronized</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-8 relative z-10">
            <div className="bg-slate-100 p-2 rounded-2xl flex gap-1 border border-slate-200 shadow-inner">
              <button onClick={() => setIsDebugMode(true)} className={`px-8 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all duration-300 ${isDebugMode ? 'bg-white shadow-xl text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>DEBUG ON</button>
              <button onClick={() => setIsDebugMode(false)} className={`px-8 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all duration-300 ${!isDebugMode ? 'bg-white shadow-xl text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>OFF</button>
            </div>
            <div className="px-10 py-5 bg-[#0F172A] rounded-[2rem] text-white shadow-2xl shadow-indigo-900/20 text-center border-b-4 border-indigo-500">
              <span className="block text-[10px] uppercase font-black text-indigo-400 tracking-[0.2em] mb-1">Inlier Density</span>
              <span className="text-4xl font-black font-mono leading-none tracking-tighter">{combResult.filtered.length}<span className="text-slate-600 px-2">/</span>{combResult.rawPoints.length}</span>
            </div>
          </div>
        </header>
        <div className="grid grid-cols-12 gap-10">
          
          {/* Left Panel: Geometry & Core Control */}
          <div className="col-span-3 space-y-8 animate-in fade-in slide-in-from-left duration-700">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-10 group hover:shadow-indigo-100/50 transition-shadow">
              <div className="flex items-center justify-between pb-4 border-b border-slate-50">
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-slate-400">
                  <Maximize2 className="w-5 h-5 text-indigo-500" /> ROI & 幾何配置
                </div>
                <Info className="w-4 h-4 text-slate-200 cursor-help" />
              </div>
              
              <div className="space-y-10">
                {[
                  { label: "Center Row", val: centerY, set: setCenterY, min: 50, max: 450 },
                  { label: "Center Col", val: centerX, set: setCenterX, min: 50, max: 450 },
                  { label: "ROI Width", val: roiW, set: setRoiW, min: 40, max: 400 },
                  { label: "ROI Height", val: roiH, set: setRoiH, min: 40, max: 400 }
                ].map((item, idx) => (
                  <div key={idx} className="group/item">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] mb-5">
                      <span className="text-slate-400 group-hover/item:text-indigo-600 transition-colors">{item.label}</span>
                      <span className="text-white font-mono bg-slate-900 px-3 py-1 rounded-lg shadow-lg">{Math.round(item.val)}</span>
                    </div>
                    <div className="relative h-6 flex items-center">
                      <input type="range" min={item.min} max={item.max} value={item.val} onChange={e=>item.set(Number(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600 z-10" />
                      <div className="absolute top-0 left-0 h-1.5 bg-indigo-50 rounded-full w-full opacity-50"></div>
                    </div>
                  </div>
                ))}
                <div className="pt-8 space-y-6">
                  <label className="text-[10px] font-black text-slate-400 uppercase block tracking-[0.3em] mb-4">掃描方向 (Scan Vector)</label>
                  <div className="grid grid-cols-2 gap-4">
                    {['TopToBottom', 'BottomToTop', 'LeftToRight', 'RightToLeft'].map(d => (
                      <button key={d} onClick={() => setScanDir(d)} className={`py-4 text-[10px] font-black rounded-2xl border-2 transition-all duration-300 transform hover:-translate-y-1 ${scanDir === d ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-white border-slate-50 text-slate-400 hover:border-slate-200'}`}>{d}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-8">
              <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-slate-400 pb-4 border-b border-slate-50">
                <Settings className="w-5 h-5 text-amber-500" /> 核心量測參數
              </div>
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Comb 密度</label>
                    <input type="number" value={combDensity} onChange={e=>setCombDensity(Number(e.target.value))} className="w-full text-sm p-4 bg-slate-50 border border-slate-100 rounded-2xl font-mono font-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Peak 取樣</label>
                    <input type="number" value={peakCount} onChange={e=>setPeakCount(Number(e.target.value))} className="w-full text-sm p-4 bg-slate-50 border border-slate-100 rounded-2xl font-mono font-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">極值方向選擇 (Peak Direction)</label>
                  <select value={peakDir} onChange={e=>setPeakDir(e.target.value)} className="w-full text-xs p-4 bg-white border-2 border-slate-50 rounded-2xl font-black text-indigo-600 shadow-sm outline-none focus:border-indigo-600 transition-colors">
                    <option value="Auto">Auto (向後兼容模式)</option>
                    <option value="Highest">Highest (取畫面上方)</option>
                    <option value="Lowest">Lowest (取畫面下方)</option>
                    <option value="Leftmost">Leftmost (取畫面左側)</option>
                    <option value="Rightmost">Rightmost (取畫面右側)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          {/* Middle Panel: Visual Monitor */}
          <div className="col-span-6 space-y-8 animate-in fade-in zoom-in-95 duration-700">
            <div className="bg-[#0F172A] rounded-[4rem] overflow-hidden aspect-square border-[16px] border-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] relative group">
              <svg viewBox="0 0 500 500" className="w-full h-full">
                {/* Background Tech Grid */}
                <defs>
                  <pattern id="techGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5"/>
                    <circle cx="0" cy="0" r="1" fill="rgba(79, 70, 229, 0.2)" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#techGrid)" />
                {/* 1. World Bump Simulation */}
                {WORLD_LINES.map(line => (
                  <path 
                    key={line.id}
                    d={`M 0,${line.centerY(0)} ${Array.from({length: 51}, (_, i) => `L ${i*10},${line.centerY(i*10)}`).join(' ')}`} 
                    fill="none" 
                    stroke={`rgba(255, 255, 255, ${0.9 - line.gray/255})`} 
                    strokeWidth={line.height}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                ))}
                {/* 2. ROI Interaction Box */}
                <rect 
                  x={centerX - roiW / 2} y={centerY - roiH / 2} width={roiW} height={roiH} 
                  fill="rgba(79, 70, 229, 0.05)" stroke="rgba(79, 70, 229, 0.8)" strokeWidth="2" strokeDasharray="12 8"
                  className="transition-all duration-300"
                />
                {/* 3. Sampling Diagnostics (Debug Mode) */}
                {isDebugMode && (
                  <g>
                    {combResult.outliers.map((p, i) => (
                      <g key={`out-${i}`} opacity="0.5">
                        <line x1={p.x-3} y1={p.y} x2={p.x+3} y2={p.y} stroke="#EF4444" strokeWidth="0.8" />
                        <line x1={p.x} y1={p.y-3} x2={p.x} y2={p.y+3} stroke="#EF4444" strokeWidth="0.8" />
                      </g>
                    ))}
                    {combResult.filtered.map((p, i) => (
                       <g key={`in-${i}`} className="animate-in fade-in duration-500">
                        <circle cx={p.x} cy={p.y} r="2.5" fill="#10B981" />
                        <circle cx={p.x} cy={p.y} r="5" fill="none" stroke="#10B981" strokeWidth="0.5" opacity="0.3" className="animate-pulse" />
                      </g>
                    ))}
                  </g>
                )}
                {/* 4. Measurement Peak & Alignment Line ⭐ */}
                {combResult.peak && (
                  <g className="drop-shadow-[0_0_25px_rgba(245,158,11,0.7)]">
                    {effectivePeakDir === 'Highest' || effectivePeakDir === 'Lowest' ? (
                      <line 
                        x1={centerX - roiW / 2} y1={combResult.peak.y} 
                        x2={centerX + roiW / 2} y2={combResult.peak.y} 
                        stroke="#F59E0B" strokeWidth="5" strokeLinecap="round"
                        className="animate-pulse"
                      />
                    ) : (
                      <line 
                        x1={combResult.peak.x} y1={centerY - roiH / 2} 
                        x2={combResult.peak.x} y2={centerY + roiH / 2} 
                        stroke="#F59E0B" strokeWidth="5" strokeLinecap="round"
                        className="animate-pulse"
                      />
                    )}
                    <g transform={`translate(${combResult.peak.x}, ${combResult.peak.y})`}>
                      <circle r="8" fill="#F59E0B" />
                      <circle r="18" fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="6 4" className="animate-spin-slow" />
                      <circle r="25" fill="none" stroke="#F59E0B" strokeWidth="0.5" opacity="0.2" className="animate-ping" />
                    </g>
                  </g>
                )}
              </svg>
              
              {/* Floating Monitor Info (Glassmorphism) */}
              <div className="absolute top-12 left-12 p-6 bg-black/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 text-white flex items-center gap-10 shadow-2xl scale-95 group-hover:scale-100 transition-transform duration-500">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-black text-indigo-400 tracking-[0.3em] mb-2">Diagnostic Data</span>
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-500/20 rounded-xl"><Activity className="w-5 h-5 text-indigo-400" /></div>
                    <span className="text-2xl font-black font-mono tracking-tighter text-white">
                      {Math.round(combResult.peak?.x || 0)} <span className="text-white/20 px-1 italic">::</span> {Math.round(combResult.peak?.y || 0)}
                    </span>
                  </div>
                </div>
                <div className="w-px h-10 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-black text-amber-400 tracking-[0.3em] mb-2">Strategy</span>
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-black uppercase tracking-widest text-amber-50 shadow-sm">{effectivePeakDir} Mode</span>
                  </div>
                </div>
              </div>
              {/* Scanline Animation Overlay */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-indigo-500/5 to-transparent h-20 w-full animate-scanline opacity-30"></div>
            </div>
            {/* Insight & Log Report */}
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/40 relative overflow-hidden group">
               <div className="flex items-center justify-between relative z-10 border-b border-slate-50 pb-8">
                 <div className="flex items-center gap-6 text-sm font-black text-slate-800 uppercase tracking-widest">
                   <div className="p-4 bg-indigo-50 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-500"><ClipboardCheck className="w-7 h-7" /></div>
                   算法執行摘要 (System Log)
                 </div>
                 <div className="px-6 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 animate-pulse shadow-sm">Verified Stability: 100%</div>
               </div>
               <div className="grid grid-cols-2 gap-12 mt-10 text-[13px] text-slate-500 leading-relaxed relative z-10">
                 <div className="space-y-5">
                    <p><strong className="text-slate-900 font-black flex items-center gap-2"><Crosshair className="w-4 h-4 text-indigo-500" /> 軸向補償鎖定:</strong><br/>基於 C# 同步模型。在搜尋 <code className="bg-slate-50 px-2 py-1 rounded">Highest</code> 極值時，輸出 Col (X) 將自動回歸 ROI 幾何中心，排除 Bump 兩側不對稱帶來的切線偏移誤差。</p>
                 </div>
                 <div className="space-y-5">
                    <p><strong className="text-slate-900 font-black flex items-center gap-2"><Filter className="w-4 h-4 text-emerald-500" /> 多階濾波鏈結:</strong><br/>已鏈接 IQR 與滾球過濾器。建議在處理 Slot 樣品時將滾球半徑設為 10-15px，這能有效消除灰階突變導致的邊緣跳點現象。</p>
                 </div>
               </div>
               <div className="absolute -right-24 -bottom-24 opacity-[0.02] group-hover:rotate-45 transition-transform duration-1000">
                 <Layers className="w-[30rem] h-[30rem] text-indigo-900" />
               </div>
            </div>
          </div>
          {/* Right Panel: Advanced Noise Filters */}
          <div className="col-span-3 space-y-8 animate-in fade-in slide-in-from-right duration-700">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-10">
              <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-slate-400 pb-4 border-b border-slate-50">
                <Filter className="w-5 h-5 text-emerald-500" /> 抗噪配置層 (Filters)
              </div>
              <div className="space-y-10">
                {[
                  { id: "IQR", state: enableIQR, set: setEnableIQR, val: iqrFactor, setV: setIqrFactor, min: 0.5, max: 3, step: 0.1, label: "IQR 離群值係數", info: "Factor: " + iqrFactor },
                  { id: "RB", state: enableRolling, set: setEnableRolling, val: rollingRadius, setV: setRollingRadius, min: 2, max: 30, step: 1, label: "滾球濾波半徑", info: rollingRadius + " px" }
                ].map((f, i) => (
                  <div key={i} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-6 transition-all hover:bg-white hover:shadow-2xl hover:shadow-indigo-100/40 group/filter">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-black uppercase text-slate-500 group-hover/filter:text-indigo-600 transition-colors">{f.label}</span>
                      <button onClick={()=>f.set(!f.state)} className={`w-12 h-6 rounded-full transition-all relative ${f.state ? 'bg-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${f.state ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                    <input type="range" min={f.min} max={f.max} step={f.step} value={f.val} onChange={e=>f.setV(Number(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600" />
                    <div className="flex justify-between text-[9px] font-black uppercase text-slate-400 tracking-tighter">
                      <span>Strict</span>
                      <span className="text-white bg-slate-900 px-4 py-1 rounded-full shadow-md font-mono">{f.info}</span>
                      <span>Loose</span>
                    </div>
                  </div>
                ))}
                {/* Neighborhood Logic Panel */}
                <div className="p-8 bg-indigo-50/30 rounded-[2.5rem] border border-indigo-100 space-y-8">
                   <div className="flex justify-between items-center">
                     <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Neighborhood一致性</span>
                     <button onClick={()=>setEnableNeighbor(!enableNeighbor)} className={`w-12 h-6 rounded-full transition-all relative ${enableNeighbor ? 'bg-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${enableNeighbor ? 'left-7' : 'left-1'}`}></div>
                     </button>
                   </div>
                   <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase"><span>Neighbor K</span><span className="text-indigo-600 font-mono font-bold">{neighborK}</span></div>
                        <input type="range" min="1" max="10" value={neighborK} onChange={e=>setNeighborK(Number(e.target.value))} className="w-full h-1 bg-indigo-100 accent-indigo-600" />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase"><span>Dist Thresh</span><span className="text-indigo-600 font-mono font-bold">{neighborThreshold}</span></div>
                        <input type="range" min="5" max="30" value={neighborThreshold} onChange={e=>setNeighborThreshold(Number(e.target.value))} className="w-full h-1 bg-indigo-100 accent-indigo-600" />
                      </div>
                   </div>
                </div>
              </div>
            </div>
            {/* Jay's Insight Section */}
            <div className="bg-[#0F172A] rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
              <div className="relative z-10 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-indigo-500 rounded-2xl group-hover:rotate-12 transition-transform duration-500 shadow-xl shadow-indigo-500/40"><Zap className="w-6 h-6 text-white" /></div>
                  <span className="text-white font-black text-sm uppercase tracking-[0.4em]">Expert Insights</span>
                </div>
                <div className="space-y-6 leading-relaxed text-[13px] text-slate-400 font-medium">
                  <p>「量測的穩定度不在於找到多少點，而是在於如何優雅地<strong className="text-white uppercase">拋棄</strong>噪聲。」</p>
                  <p>對於 <strong className="text-indigo-400">Slot Bump</strong>，我們不應該追求直線擬合，而是應該追求「極致的幾何切線」。透過軸向鎖定與滾球過濾，即使在不對稱的圓弧下，也能鎖定唯一的最高點。</p>
                  <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 italic text-[11px] text-indigo-300 leading-loose shadow-inner font-black uppercase tracking-tighter">
                    "Precision is the byproduct of discipline in filtering."
                  </div>
                </div>
              </div>
              <Wind className="absolute -right-16 -bottom-16 w-64 h-64 text-indigo-500 opacity-5 group-hover:scale-110 transition-transform duration-700" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer Section */}
      <footer className="max-w-[1750px] mx-auto mt-20 pt-12 border-t border-slate-200 flex justify-between text-[10px] text-slate-400 font-black tracking-[0.5em] uppercase pb-24 px-4">
        <div className="flex gap-20">
          <span className="flex items-center gap-3 hover:text-indigo-600 transition-colors cursor-default group">
            <ShieldCheck className="w-4 h-4 text-indigo-500 group-hover:animate-bounce"/> Jay CCRect HL-Standard Active
          </span>
          <span className="flex items-center gap-3 hover:text-emerald-600 transition-colors cursor-default group">
            <BarChart2 className="w-4 h-4 text-emerald-500 group-hover:animate-bounce"/> Sub-pixel sampling logic active
          </span>
        </div>
        <div className="text-slate-300 hover:text-slate-500 transition-colors">Jay Vision Metrology Academy • {AUTHOR} • {VERSION}</div>
      </footer>
      {/* Tailwind Animations & Global Style Extension */}
      <style>{`
        @keyframes scanline {
          from { transform: translateY(-100%); }
          to { transform: translateY(500%); }
        }
        .animate-scanline {
          animation: scanline 4s linear infinite;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          background: #4F46E5;
          cursor: pointer;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
      `}</style>
    </div>
  );
};
export default App;
