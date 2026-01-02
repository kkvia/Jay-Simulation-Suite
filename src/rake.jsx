import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Settings, Target, Zap, Info, ShieldCheck, Maximize2, Move, 
  BarChart2, Eye, MousePointer2, CheckCircle2, AlertCircle, 
  HelpCircle, ChevronRight, FileText, Layers, Wind, Filter, Bug,
  Activity, Crosshair, Cpu, Gauge, ClipboardCheck, Radio, RefreshCw,
  Upload, ImageIcon, Trash2, Sliders, Monitor, ZoomIn, ZoomOut, Hand,
  Target as TargetIcon, AlignLeft
} from 'lucide-react';

// --- 配置與版本 ---
const AUTHOR = "Jay";
const VERSION = "V4.2.0 - Rake Precision Engine";

/**
 * 【物理模擬引擎】預設底圖線段
 * 這裡定義了具有真實寬度的實體邊緣
 */
const WORLD_LINES = [
  { id: 'Line_A', centerX: (y) => 180 + Math.sin(y / 45) * 15, width: 14, gray: 40 },
  { id: 'Line_B', centerX: (y) => 280 + Math.cos(y / 55) * 10, width: 10, gray: 30 },
  { id: 'Line_C', centerX: (y) => 380 - (y / 10), width: 8, gray: 20 },
];

const getSimulatedPixel = (x, y, noiseLevel = 0.2) => {
  let grayBase = 245; 
  for (const line of WORLD_LINES) {
    const edgeX = line.centerX(y);
    const halfW = line.width / 2;
    if (x >= edgeX - halfW && x <= edgeX + halfW) {
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

// --- Rake 擬合與濾波邏輯 ---

/**
 * 穩健擬合 (Robust Fit)
 */
const performRobustFit = (points, threshold = 6) => {
  if (points.length < 2) return null;
  const fit = (pts) => {
    const n = pts.length;
    let sx = 0, sy = 0, sxy = 0, sx2 = 0;
    pts.forEach(p => { sx += p.x; sy += p.y; sxy += p.x * p.y; sx2 += p.x * p.x; });
    const den = n * sx2 - sx * sx;
    if (Math.abs(den) < 1e-8) return { m: 1e8, b: sx / n, isVertical: true };
    const m = (n * sxy - sx * sy) / den;
    const b = (sy - m * sx) / n;
    return { m, b, isVertical: false };
  };
  const firstPass = fit(points);
  const inliers = points.filter(p => {
    const d = firstPass.isVertical ? Math.abs(p.x - firstPass.b) : Math.abs(firstPass.m * p.x - p.y + firstPass.b) / Math.sqrt(firstPass.m * firstPass.m + 1);
    return d < threshold;
  });
  if (inliers.length < 2) return { ...firstPass, inliers: points, outliers: [] };
  const refined = fit(inliers);
  return { ...refined, inliers, outliers: points.filter(p => !inliers.includes(p)) };
};

// --- 抗噪濾波組件 (移植自 Jay 的 Comb 邏輯) ---
const filterIQR = (points, factor) => {
  if (points.length < 4) return points;
  const values = points.map(p => p.x).sort((a, b) => a - b);
  const q1 = values[Math.floor(values.length * 0.25)];
  const q3 = values[Math.floor(values.length * 0.75)];
  const iqr = q3 - q1;
  return points.filter(p => p.x >= q1 - factor * iqr && p.x <= q3 + factor * iqr);
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

const App = () => {
  const [imageSource, setImageSource] = useState(null);
  const [pixelData, setPixelData] = useState(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- 視覺狀態 ---
  const [viewScale, setViewScale] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // --- Rake 控制狀態 ---
  const [centerX, setCenterX] = useState(250);
  const [centerY, setCenterY] = useState(250);
  const [roiL1, setRoiL1] = useState(120);
  const [roiL2, setRoiL2] = useState(140);
  const [direction, setDirection] = useState('LeftToRight');
  const [sigma, setSigma] = useState(1.2);
  const [threshold, setThreshold] = useState(25);
  const [polarity, setPolarity] = useState('negative');
  const [sampleCount, setSampleCount] = useState(40);
  const [offset, setOffset] = useState(0);
  const [activeTooth, setActiveTooth] = useState(0);

  // --- 濾波開關 ---
  const [enableIQR, setEnableIQR] = useState(true);
  const [iqrFactor, setIqrFactor] = useState(1.5);
  const [enableNeighbor, setEnableNeighbor] = useState(true);
  const [neighborK, setNeighborK] = useState(3);
  const [neighborThreshold, setNeighborThreshold] = useState(15);

  const phi = useMemo(() => {
    switch (direction) {
      case 'TopToBottom': return -Math.PI / 2;
      case 'BottomToTop': return Math.PI / 2;
      case 'LeftToRight': return 0;
      case 'RightToLeft': return Math.PI;
      default: return 0;
    }
  }, [direction]);

  // --- 圖片上傳邏輯 ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
        canvasRef.current.width = 500;
        canvasRef.current.height = 500;
        ctx.drawImage(img, 0, 0, 500, 500);
        setPixelData(ctx.getImageData(0, 0, 500, 500).data);
        setImageSource(event.target.result);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const samplePixel = (x, y) => {
    if (pixelData) {
      const ix = Math.floor(Math.max(0, Math.min(499, x)));
      const iy = Math.floor(Math.max(0, Math.min(499, y)));
      const idx = (iy * 500 + ix) * 4;
      return (pixelData[idx] * 0.299 + pixelData[idx+1] * 0.587 + pixelData[idx+2] * 0.114);
    }
    return getSimulatedPixel(x, y);
  };

  // --- RAKE 計算核心 ---
  const rakeData = useMemo(() => {
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    const teeth = [];
    const rawDetectedPoints = [];

    for (let i = 0; i < sampleCount; i++) {
      const relY = (i / (sampleCount - 1) - 0.5) * (roiL2 * 2);
      const getCoord = (relX) => ({
        x: centerX + (relX * cosP - relY * sinP),
        y: centerY + (relX * sinP + relY * cosP)
      });
      const start = getCoord(-roiL1);
      const end = getCoord(roiL1);

      const profile = [];
      const steps = Math.max(40, Math.floor(roiL1 * 2));
      for (let s = 0; s < steps; s++) {
        const t = s / (steps - 1);
        profile.push(samplePixel(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t));
      }

      const smoothed = applyGaussian(profile, sigma);
      const deriv = smoothed.map((v, idx) => idx === 0 ? 0 : v - smoothed[idx - 1]);
      
      let bestIdx = -1;
      let maxAmp = 0;
      for (let j = 0; j < deriv.length; j++) {
        const val = deriv[j];
        const isMatch = (polarity === 'positive' && val > threshold) || (polarity === 'negative' && val < -threshold);
        if (isMatch && Math.abs(val) > maxAmp) {
          maxAmp = Math.abs(val);
          bestIdx = j;
        }
      }

      let edgePt = null;
      let correctedPt = null;
      if (bestIdx !== -1) {
        const t = bestIdx / (steps - 1);
        const wx = start.x + (end.x - start.x) * t;
        const wy = start.y + (end.y - start.y) * t;
        edgePt = { x: wx, y: wy };
        correctedPt = { x: wx + offset * cosP, y: wy + offset * sinP };
        rawDetectedPoints.push(correctedPt);
      }
      teeth.push({ id: i, start, end, profile, smoothed, deriv, edgePt, correctedPt, bestIdx });
    }

    // 應用過濾層 (IQR, Neighborhood)
    let filteredPoints = [...rawDetectedPoints];
    if (enableIQR) filteredPoints = filterIQR(filteredPoints, iqrFactor);
    if (enableNeighbor) filteredPoints = filterNeighborhood(filteredPoints, neighborK, neighborThreshold);

    const fitResult = performRobustFit(filteredPoints, 6);
    return { teeth, fitResult, rawDetectedPoints, filteredPoints };
  }, [centerX, centerY, roiL1, roiL2, phi, sampleCount, sigma, threshold, polarity, offset, pixelData, enableIQR, iqrFactor, enableNeighbor, neighborK, neighborThreshold]);

  const activeData = rakeData.teeth[activeTooth] || rakeData.teeth[0];

  // --- 縮放與平移邏輯 ---
  const handleWheel = (e) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? -1 : 1;
    setViewScale(s => Math.max(1, Math.min(s + direction * 0.15, 6)));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="max-w-[1850px] mx-auto p-6 h-screen flex flex-col gap-6 overflow-hidden">
        
        {/* Header */}
        <header className="bg-white px-8 py-5 rounded-[2.5rem] shadow-sm border border-slate-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-6">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
              <TargetIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-800 flex items-center gap-3 uppercase italic">
                Jay <span className="text-indigo-600">RakeEngine</span>™
                <span className="text-[9px] bg-slate-800 text-white px-2 py-0.5 rounded-full font-black uppercase not-italic tracking-widest leading-none">{VERSION}</span>
              </h1>
              <div className="flex items-center gap-4 text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1.5">
                <span className="flex items-center gap-1.5"><Radio className="w-3 h-3 text-emerald-500 animate-pulse" /> Live Analysis Mode</span>
                <span className="w-px h-3 bg-slate-200"></span>
                <span className="text-indigo-500 underline underline-offset-4 decoration-indigo-200 font-bold">作者: {AUTHOR}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
             <div className="px-8 py-3 bg-[#0F172A] rounded-2xl text-white text-center min-w-[200px] shadow-xl shadow-slate-200">
                <span className="block text-[8px] uppercase font-black text-indigo-400 tracking-[0.3em] mb-1">Fitting Accuracy</span>
                <span className="text-2xl font-black font-mono tracking-tighter">
                  {rakeData.fitResult?.inliers?.length || 0}
                  <span className="text-slate-600 px-1 text-sm">/</span>
                  {rakeData.rawDetectedPoints.length}
                </span>
             </div>
          </div>
        </header>

        <main className="flex-1 flex gap-6 overflow-hidden min-h-0">
          
          {/* 左側：核心監視器與分析 */}
          <div className="flex-1 flex flex-col gap-6 overflow-hidden min-w-0">
            
            {/* 主監視器 */}
            <div 
              className={`flex-1 bg-white rounded-[3.5rem] border-[10px] border-white shadow-2xl relative overflow-hidden ring-1 ring-slate-200 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
              onWheel={handleWheel}
              onMouseDown={(e) => { if(e.button === 0){ setIsPanning(true); setStartPan({x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y}); } }}
              onMouseMove={(e) => { if(isPanning) setViewOffset({x: e.clientX - startPan.x, y: e.clientY - startPan.y}); }}
              onMouseUp={() => setIsPanning(false)}
              onMouseLeave={() => setIsPanning(false)}
            >
              <div className="absolute inset-0 bg-[#F1F5F9] opacity-30 pointer-events-none"></div>
              
              <svg viewBox="0 0 500 500" className="w-full h-full relative z-10">
                <g transform={`translate(${viewOffset.x}, ${viewOffset.y}) scale(${viewScale})`}>
                  {/* 底圖渲染 */}
                  {imageSource ? (
                    <image href={imageSource} x="0" y="0" width="500" height="500" preserveAspectRatio="none" className="opacity-80" />
                  ) : (
                    WORLD_LINES.map(line => (
                      <path 
                        key={line.id}
                        d={`M ${line.centerX(0)},${line.id === 'Line_C' ? 0 : 0} ${Array.from({length: 51}, (_, i) => `L ${line.centerX(i*10)},${i*10}`).join(' ')}`} 
                        fill="none" 
                        stroke={`rgba(30, 41, 59, ${1 - line.gray/255})`} 
                        strokeWidth={line.width}
                      />
                    ))
                  )}

                  {/* ROI 控制器 */}
                  <g transform={`translate(${centerX}, ${centerY}) rotate(${phi * 180 / Math.PI})`}>
                    <rect 
                      x={-roiL1} y={-roiL2} width={roiL1*2} height={roiL2*2} 
                      fill="rgba(79, 70, 229, 0.02)" stroke="#4F46E5" strokeWidth={1/viewScale} strokeDasharray={`${8/viewScale} ${4/viewScale}`}
                    />
                    <line x1={-roiL1} y1="0" x2={-roiL1-30/viewScale} y2="0" stroke="#4F46E5" strokeWidth={3/viewScale} markerEnd="url(#arrow-rake)" />
                  </g>

                  {/* 採樣齒與邊緣點 */}
                  {rakeData.teeth.map((t, i) => {
                    const isActive = activeTooth === i;
                    const isInlier = t.correctedPt && rakeData.fitResult?.inliers?.some(p => p === t.correctedPt);
                    return (
                      <g key={i} onMouseEnter={() => setActiveTooth(i)} className="cursor-pointer">
                        <line 
                          x1={t.start.x} y1={t.start.y} x2={t.end.x} y2={t.end.y} 
                          stroke={isActive ? "#F59E0B" : "#3B82F6"} 
                          strokeWidth={isActive ? 3/viewScale : 0.5/viewScale} opacity={isActive ? 1 : 0.2}
                        />
                        {/* 原始檢測點 */}
                        {t.edgeWorldPt && (
                          <g opacity={isActive ? 1 : 0.6}>
                            <line x1={t.edgeWorldPt.x-2/viewScale} y1={t.edgeWorldPt.y} x2={t.edgeWorldPt.x+2/viewScale} y2={t.edgeWorldPt.y} stroke="#10B981" strokeWidth={1/viewScale} />
                            <line x1={t.edgeWorldPt.x} y1={t.edgeWorldPt.y-2/viewScale} x2={t.edgeWorldPt.x} y2={t.edgeWorldPt.y+2/viewScale} stroke="#10B981" strokeWidth={1/viewScale} />
                          </g>
                        )}
                        {/* 擬合點與離群點 */}
                        {t.correctedPt && (
                          <circle 
                            cx={t.correctedPt.x} cy={t.correctedPt.y} 
                            r={isActive ? 5/viewScale : 2.5/viewScale} 
                            fill={isInlier ? (isActive ? "#F59E0B" : "#10B981") : "#F43F5E"}
                            className={isActive ? "animate-pulse" : ""}
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* 擬合直線 */}
                  {rakeData.fitResult && !isNaN(rakeData.fitResult.m) && (
                    rakeData.fitResult.isVertical ? (
                      <line x1={rakeData.fitResult.b} y1={0} x2={rakeData.fitResult.b} y2={500} stroke="#059669" strokeWidth={2.5/viewScale} strokeDasharray={`${12/viewScale} ${6/viewScale}`} />
                    ) : (
                      <line x1={0} y1={rakeData.fitResult.b} x2={500} y2={rakeData.fitResult.m * 500 + rakeData.fitResult.b} stroke="#059669" strokeWidth={2.5/viewScale} strokeDasharray={`${12/viewScale} ${6/viewScale}`} />
                    )
                  )}
                </g>

                <defs>
                  <marker id="arrow-rake" markerWidth="10" markerHeight="10" refX="0" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#4F46E5" />
                  </marker>
                </defs>
              </svg>

              {/* 漂浮導航 */}
              <div className="absolute top-10 left-10 flex gap-3">
                <div className="bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-200 text-[10px] font-black text-slate-800 flex items-center gap-4 shadow-xl">
                  <div className="flex items-center gap-2 text-indigo-600"><MousePointer2 className="w-3 h-3"/> Scroll to Zoom</div>
                  <div className="w-px h-3 bg-slate-200"></div>
                  <button onClick={() => {setViewScale(1); setViewOffset({x:0, y:0});}} className="text-slate-400 hover:text-indigo-600 transition-colors">Reset View</button>
                </div>
              </div>
            </div>

            {/* 1D Analysis */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl flex flex-col gap-6">
               <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                  <div className="flex items-center gap-3">
                    <BarChart2 className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-600">1D Profile Analysis (#{activeTooth})</h2>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[9px] font-black px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 uppercase tracking-tighter">
                      Pos: {activeData.bestIdx !== -1 ? activeData.bestIdx.toFixed(2) : 'Null'}
                    </span>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-10">
                  <div className="h-44 bg-slate-50 rounded-2xl border border-slate-200 p-4 relative group">
                    <span className="absolute top-2 left-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-xs">Gray Space</span>
                    <svg viewBox={`0 0 ${activeData.profile.length} 255`} className="w-full h-full" preserveAspectRatio="none">
                      <polyline fill="none" stroke="#CBD5E1" strokeWidth="1" points={activeData.profile.map((v, i) => `${i},${255 - v}`).join(' ')} />
                      <polyline fill="none" stroke="#4F46E5" strokeWidth="2.5" points={activeData.smoothed.map((v, i) => `${i},${255 - v}`).join(' ')} />
                      {activeData.bestIdx !== -1 && <line x1={activeData.bestIdx} y1="0" x2={activeData.bestIdx} y2="255" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4 4" />}
                    </svg>
                  </div>
                  <div className="h-44 bg-slate-50 rounded-2xl border border-slate-200 p-4 relative">
                    <span className="absolute top-2 left-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-xs">Gradient Derivative</span>
                    <svg viewBox={`0 0 ${activeData.deriv.length} 100`} className="w-full h-full" preserveAspectRatio="none">
                      <polyline fill="none" stroke="#F43F5E" strokeWidth="2" points={activeData.deriv.map((v, i) => `${i},${50 - v}`).join(' ')} />
                      <line x1="0" y1={50 - threshold} x2={activeData.deriv.length} y2={50 - threshold} stroke="#F59E0B" strokeWidth="1" strokeDasharray="5 5" />
                      <line x1="0" y1={50 + threshold} x2={activeData.deriv.length} y2={50 + threshold} stroke="#F59E0B" strokeWidth="1" strokeDasharray="5 5" />
                    </svg>
                  </div>
               </div>
            </div>
          </div>

          {/* 右側：精準控制台 */}
          <div className="w-[420px] flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar shrink-0">
            
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
                    { label: "Center X", val: centerX, set: setCenterX, min: 0, max: 500 },
                    { label: "Center Y", val: centerY, set: setCenterY, min: 0, max: 500 },
                    { label: "L1 Length", val: roiL1, set: setRoiL1, min: 10, max: 250 },
                    { label: "L2 Width", val: roiL2, set: setRoiL2, min: 10, max: 250 }
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase">
                        <span className="text-slate-400">{item.label}</span>
                        <span className="text-indigo-600 font-mono">{Math.round(item.val)}</span>
                      </div>
                      <input type="range" min={item.min} max={item.max} value={item.val} onChange={e=>item.set(Number(e.target.value))} className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600" />
                    </div>
                  ))}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                {['TopToBottom', 'BottomToTop', 'LeftToRight', 'RightToLeft'].map(d => (
                  <button key={d} onClick={() => setDirection(d)} className={`py-3 text-[9px] font-black rounded-xl border-2 transition-all ${direction === d ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg font-bold' : 'bg-white border-slate-100 text-slate-400 font-bold'}`}>{d}</button>
                ))}
              </div>
            </div>

            {/* Algorithm Logic */}
            <div className="bg-white p-7 rounded-[2rem] border border-slate-100 shadow-lg space-y-10 font-bold">
              <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><Settings className="w-4 h-4" /> Algorithm Control</h3>
              <div className="space-y-10">
                <div className="space-y-4 font-bold">
                  <div className="flex justify-between items-center font-bold"><label className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Sigma</label><span className="text-indigo-600 font-mono text-xs font-bold">{sigma.toFixed(1)}</span></div>
                  <input type="range" min="0.4" max="5.0" step="0.1" value={sigma} onChange={e=>setSigma(Number(e.target.value))} className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600" />
                </div>
                <div className="space-y-4 font-bold">
                  <div className="flex justify-between items-center font-bold"><label className="text-[11px] font-black text-slate-600 uppercase tracking-widest font-bold">Threshold</label><span className="text-amber-600 font-mono text-xs font-bold">{threshold}</span></div>
                  <input type="range" min="5" max="100" value={threshold} onChange={e=>setThreshold(Number(e.target.value))} className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-amber-500" />
                </div>
                <div className="grid grid-cols-2 gap-8 font-bold">
                  <div className="space-y-3 font-bold">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">齒數 (Teeth)</label>
                    <input type="number" value={sampleCount} onChange={e=>setSampleCount(Number(e.target.value))} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-black font-mono focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-3 font-bold">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">補正 (Offset)</label>
                    <input type="number" value={offset} onChange={e=>setOffset(Number(e.target.value))} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-black font-mono focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-50 flex gap-4">
                   <div className="flex-1 space-y-3 font-bold">
                     <label className="text-[9px] font-black text-slate-400 uppercase">Polarity</label>
                     <div className="flex p-1 bg-slate-100 rounded-xl font-bold">
                        <button onClick={()=>setPolarity('negative')} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${polarity === 'negative' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 font-bold'}`}>Negative</button>
                        <button onClick={()=>setPolarity('positive')} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${polarity === 'positive' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 font-bold'}`}>Positive</button>
                     </div>
                   </div>
                </div>
              </div>
            </div>

            {/* Filter Layers */}
            <div className="bg-white p-7 rounded-[2rem] border border-slate-100 shadow-lg space-y-6">
               <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2"><Filter className="w-4 h-4" /> Filter Layers (Jay's Logic)</h3>
               <div className="space-y-4">
                  <div className={`p-4 rounded-2xl border transition-all ${enableIQR ? 'bg-indigo-50/30 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black text-slate-600">IQR 統計離群剔除</span>
                      <button onClick={()=>setEnableIQR(!enableIQR)} className={`w-10 h-5 rounded-full relative transition-colors ${enableIQR ? 'bg-indigo-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${enableIQR ? 'left-6' : 'left-1'}`}></div></button>
                    </div>
                    <input type="range" min="0.5" max="3" step="0.1" value={iqrFactor} onChange={e=>setIqrFactor(Number(e.target.value))} disabled={!enableIQR} className="w-full h-1 bg-slate-200 rounded-full appearance-none accent-indigo-600" />
                  </div>
                  <div className={`p-4 rounded-2xl border transition-all ${enableNeighbor ? 'bg-indigo-50/30 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black text-slate-600">鄰域一致性 (K-Dist)</span>
                      <button onClick={()=>setEnableNeighbor(!enableNeighbor)} className={`w-10 h-5 rounded-full relative transition-colors ${enableNeighbor ? 'bg-indigo-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${enableNeighbor ? 'left-6' : 'left-1'}`}></div></button>
                    </div>
                    <input type="range" min="5" max="30" value={neighborThreshold} onChange={e=>setNeighborThreshold(Number(e.target.value))} disabled={!enableNeighbor} className="w-full h-1 bg-slate-200 rounded-full appearance-none accent-indigo-600" />
                  </div>
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
                    <p className="border-l-2 border-indigo-500 pl-4"><b>極性對齊：</b> 實體邊緣具備厚度。在 <code className="text-indigo-400">Negative</code> 極性下，Rake 鎖定進入線段的邊界；在 <code className="text-indigo-400">Positive</code> 下，鎖定離開線段的邊界。</p>
                    <p className="border-l-2 border-emerald-500 pl-4"><b>穩健擬合：</b> 畫面上 <span className="text-rose-500 font-bold font-bold">紅色點</span> 代表被過濾層或 Tukey 算法剔除的離群值。這能確保即便底圖有嚴重污漬，擬合直線依然能保持亞像素精度。</p>
                  </div>
               </div>
               <Wind className="absolute -right-10 -bottom-10 w-48 h-48 text-indigo-500 opacity-5" />
            </div>
          </div>
        </main>
      </div>

      <style>{`
        input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; background: #4F46E5; cursor: pointer; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;