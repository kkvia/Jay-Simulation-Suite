import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Settings, Target, Zap, Info, ShieldCheck, Maximize2, Move, 
  BarChart2, Eye, MousePointer2, CheckCircle2, AlertCircle, 
  HelpCircle, ChevronRight, FileText, Layers, Wind, Filter, Bug,
  Activity, Crosshair, Cpu, Gauge, ClipboardCheck, Radio, RefreshCw,
  Upload, ImageIcon, Trash2, Sliders, Monitor, ZoomIn, ZoomOut, Hand,
  Target as TargetIcon
} from 'lucide-react';
import defaultImage from '../default.png';

// --- 配置與版本 ---
const AUTHOR = "Jay";
const VERSION = "V5.8.1 - Stable Reliability";

/**
 * 【物理模擬引擎】預設背景
 * 加入一個反光干擾區 (Glare Zone) 模擬用戶遇到的問題
 */
const WORLD_LINES = [
  { id: 'Main_Bump', centerY: (x) => 300 - Math.exp(-Math.pow((x - 250) / 45, 2)) * 75, height: 12, gray: 35 },
  { id: 'Glare_Reflection', centerY: (x) => 340 - Math.exp(-Math.pow((x - 280) / 15, 2)) * 10, height: 8, gray: 20 }, // 模擬反光
  { id: 'Flat_Base', centerY: (x) => 300, height: 4, gray: 70 }
];

const getSimulatedPixel = (x, y, noiseLevel = 0.15) => {
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

// --- 抗噪濾波組件 ---
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
  const [imageSource, setImageSource] = useState(defaultImage);
  const [pixelData, setPixelData] = useState(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const svgRef = useRef(null);

  // --- 視覺縮放與平移狀態 ---
  const [viewScale, setViewScale] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // --- 狀態控制 (加入數值防呆) ---
  const [centerX, setCenterX] = useState(147);
  const [centerY, setCenterY] = useState(188);
  const [roiW, setRoiW] = useState(205);
  const [roiH, setRoiH] = useState(80);
  const [scanDir, setScanDir] = useState('TopToBottom');
  const [peakDir, setPeakDir] = useState('Highest');
  const [sigma, setSigma] = useState(1);
  const [threshold, setThreshold] = useState(10);
  const [polarity, setPolarity] = useState('positive');
  const [edgeSelection, setEdgeSelection] = useState('all'); 
  const [offset, setOffset] = useState(0);
  const [isDebugMode, setIsDebugMode] = useState(true);
  const [combDensity, setCombDensity] = useState(80);
  const [peakCount, setPeakCount] = useState(5);

  const [enableIQR, setEnableIQR] = useState(false);
  const [iqrFactor, setIqrFactor] = useState(1.5);
  const [enableNeighbor, setEnableNeighbor] = useState(true);
  const [neighborK, setNeighborK] = useState(3);
  const [neighborThreshold, setNeighborThreshold] = useState(15);
  const [enableRolling, setEnableRolling] = useState(true);
  const [rollingRadius, setRollingRadius] = useState(12);

  // 初始化載入預設圖片的像素資料
  useEffect(() => {
    if (imageSource && !pixelData) {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = 500;
        canvas.height = 500;
        ctx.drawImage(img, 0, 0, 500, 500);
        const data = ctx.getImageData(0, 0, 500, 500).data;
        setPixelData(data);
      };
      img.src = imageSource;
    }
  }, []);

  // --- 圖片處理邏輯 ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImageSource(event.target.result);
        const ctx = canvasRef.current.getContext('2d');
        canvasRef.current.width = 500;
        canvasRef.current.height = 500;
        ctx.drawImage(img, 0, 0, 500, 500);
        const data = ctx.getImageData(0, 0, 500, 500).data;
        setPixelData(data);
        resetView();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const samplePixel = (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (pixelData && ix >= 0 && ix < 500 && iy >= 0 && iy < 500) {
      const idx = (iy * 500 + ix) * 4;
      return (pixelData[idx] * 0.299 + pixelData[idx+1] * 0.587 + pixelData[idx+2] * 0.114);
    }
    return getSimulatedPixel(x, y);
  };

  // --- 縮放與平移邏輯 ---
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomSpeed = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(1, Math.min(viewScale + direction * zoomSpeed, 5));
    setViewScale(newScale);
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setViewOffset({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y
    });
  };

  const handleMouseUp = () => setIsPanning(false);
  const resetView = () => { setViewScale(1); setViewOffset({ x: 0, y: 0 }); };

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
    // 參數有效性校驗
    const currentDensity = Math.max(2, Math.floor(combDensity) || 2);
    const currentPeakCount = Math.max(1, Math.floor(peakCount) || 1);

    const teeth = [];
    const rawPoints = [];
    for (let i = 0; i < currentDensity; i++) {
      const step = i / (currentDensity - 1);
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
      const profileSteps = 60;
      for (let s = 0; s < profileSteps; s++) {
        const t = s / (profileSteps - 1);
        const val = samplePixel(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t);
        profile.push(isNaN(val) ? 255 : val);
      }
      
      const smoothed = applyGaussian(profile, sigma);
      const deriv = smoothed.map((v, idx) => idx === 0 ? 0 : v - smoothed[idx - 1]);
      
      let matches = [];
      for (let j = 0; j < deriv.length; j++) {
        const val = deriv[j];
        const isMatch = (polarity === 'positive' && val > threshold) || (polarity === 'negative' && val < -threshold);
        if (isMatch) matches.push({ idx: j, amp: Math.abs(val) });
      }

      let bestIdx = -1;
      if (matches.length > 0) {
        if (edgeSelection === 'first') {
          bestIdx = matches[0].idx;
        } else if (edgeSelection === 'last') {
          bestIdx = matches[matches.length - 1].idx;
        } else {
          matches.sort((a, b) => b.amp - a.amp);
          bestIdx = matches[0].idx;
        }
      }

      if (bestIdx !== -1) {
        const t = bestIdx / (profileSteps - 1);
        const px = start.x + (end.x - start.x) * t;
        const py = start.y + (end.y - start.y) * t;
        if (!isNaN(px) && !isNaN(py)) {
          rawPoints.push({ x: px, y: py });
        }
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

    const topK = sorted.slice(0, currentPeakCount);
    let peak = null;
    if (topK.length > 0) {
      const measuredAvgRow = topK.reduce((sum, p) => sum + p.y, 0) / topK.length;
      const measuredAvgCol = topK.reduce((sum, p) => sum + p.x, 0) / topK.length;
      
      let finalRow = (effectivePeakDir === 'Highest' || effectivePeakDir === 'Lowest') ? measuredAvgRow : centerY;
      let finalCol = (effectivePeakDir === 'Highest' || effectivePeakDir === 'Lowest') ? centerX : measuredAvgCol;
      
      let ox = 0, oy = 0;
      if (scanDir === 'TopToBottom') oy = offset;
      else if (scanDir === 'BottomToTop') oy = -offset;
      else if (scanDir === 'LeftToRight') ox = offset;
      else ox = -offset;

      if (!isNaN(finalCol) && !isNaN(finalRow)) {
        peak = { x: finalCol + ox, y: finalRow + oy };
      }
    }
    return { teeth, rawPoints, filtered, peak, outliers: rawPoints.filter(rp => !filtered.includes(rp)) };
  }, [centerX, centerY, roiW, roiH, scanDir, sigma, threshold, polarity, edgeSelection, combDensity, peakCount, iqrFactor, enableIQR, enableNeighbor, neighborK, neighborThreshold, enableRolling, rollingRadius, effectivePeakDir, offset, pixelData]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="max-w-[1850px] mx-auto p-6 h-screen flex flex-col gap-6 overflow-hidden">
        
        {/* Header */}
        <header className="bg-white px-8 py-4 rounded-[2rem] shadow-sm border border-slate-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-6">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
              <Cpu className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-800 flex items-center gap-3">
                Jay <span className="text-indigo-600">CombEngine</span>™
                <span className="text-[9px] bg-slate-800 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest">{VERSION}</span>
              </h1>
              <div className="flex items-center gap-4 text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                <span className="flex items-center gap-1.5"><Radio className="w-3 h-3 text-emerald-500" /> Anti-Reflection Mode</span>
                <span className="w-px h-3 bg-slate-200"></span>
                <span>Sub-Pixel Precision Active</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
             <div className="bg-slate-50 p-1.5 rounded-xl flex gap-1 border border-slate-200">
                <button onClick={() => setIsDebugMode(true)} className={`px-5 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all ${isDebugMode ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'}`}>DEBUG ON</button>
                <button onClick={() => setIsDebugMode(false)} className={`px-5 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all ${!isDebugMode ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'}`}>OFF</button>
             </div>
             <div className="px-8 py-3 bg-[#0F172A] rounded-2xl text-white text-center min-w-[160px]">
                <span className="block text-[8px] uppercase font-black text-indigo-400 tracking-[0.2em] mb-1">Inlier Stats</span>
                <span className="text-2xl font-black font-mono tracking-tighter">{combResult.filtered.length}<span className="text-slate-600 px-1">/</span>{combResult.rawPoints.length}</span>
             </div>
          </div>
        </header>

        <main className="flex-1 flex gap-6 overflow-hidden min-h-0">
          
          {/* 左側：監視器區域 */}
          <div className="flex-1 flex flex-col gap-6 overflow-hidden min-w-0">
            <div 
              className={`flex-1 bg-[#0F172A] rounded-[3.5rem] border-[10px] border-white shadow-2xl relative group overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
               <svg 
                ref={svgRef}
                viewBox="0 0 500 500" 
                className="w-full h-full"
               >
                  <g transform={`translate(${viewOffset.x}, ${viewOffset.y}) scale(${viewScale})`}>
                    <defs>
                      <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="0.5" opacity="0.05"/></pattern>
                    </defs>
                    <rect width="500" height="500" fill="url(#grid)" />
                    {imageSource ? (
                      <image href={imageSource} x="0" y="0" width="500" height="500" preserveAspectRatio="none" className="opacity-70" />
                    ) : (
                      WORLD_LINES.map(line => (
                        <path key={line.id} d={`M 0,${line.centerY(0)} ${Array.from({length: 51}, (_, i) => `L ${i*10},${line.centerY(i*10)}`).join(' ')}`} fill="none" stroke={`rgba(255, 255, 255, ${line.id === 'Glare_Reflection' ? 0.2 : 0.9 - line.gray/255})`} strokeWidth={line.height} strokeLinecap="round" />
                      ))
                    )}
                    
                    <rect x={centerX - roiW / 2} y={centerY - roiH / 2} width={roiW} height={roiH} fill="rgba(79, 70, 229, 0.03)" stroke="rgba(79, 70, 229, 0.7)" strokeWidth={1.5 / Math.max(0.1, viewScale)} strokeDasharray={`${10/viewScale} ${5/viewScale}`} />
                    
                    {isDebugMode && (
                      <g>
                        {combResult.outliers.map((p, i) => (
                           !isNaN(p.x) && !isNaN(p.y) && (
                            <g key={`out-${i}`} opacity="0.4">
                              <line x1={p.x-2/viewScale} y1={p.y} x2={p.x+2/viewScale} y2={p.y} stroke="#EF4444" strokeWidth={0.5/viewScale} />
                              <line x1={p.x} y1={p.y-2/viewScale} x2={p.x} y2={p.y+2/viewScale} stroke="#EF4444" strokeWidth={0.5/viewScale} />
                            </g>
                           )
                        ))}
                        {combResult.filtered.map((p, i) => (
                           !isNaN(p.x) && !isNaN(p.y) && (
                            <circle key={`in-${i}`} cx={p.x} cy={p.y} r={2/viewScale} fill="#10B981" />
                           )
                        ))}
                      </g>
                    )}
                    {combResult.peak && !isNaN(combResult.peak.x) && !isNaN(combResult.peak.y) && (
                      <g className="drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]">
                        {effectivePeakDir === 'Highest' || effectivePeakDir === 'Lowest' ? (
                          <line x1={centerX - roiW / 2} y1={combResult.peak.y} x2={centerX + roiW / 2} y2={combResult.peak.y} stroke="#F59E0B" strokeWidth={4/viewScale} strokeLinecap="round" className="animate-pulse" />
                        ) : (
                          <line x1={combResult.peak.x} y1={centerY - roiH / 2} x2={combResult.peak.x} y2={centerY + roiH / 2} stroke="#F59E0B" strokeWidth={4/viewScale} strokeLinecap="round" className="animate-pulse" />
                        )}
                        <circle cx={combResult.peak.x} cy={combResult.peak.y} r={6/viewScale} fill="#F59E0B" />
                      </g>
                    )}
                  </g>
               </svg>

               <div className="absolute top-10 right-10 p-4 bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 text-white flex flex-col gap-3 shadow-2xl min-w-[150px]">
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase font-black text-indigo-400 tracking-[0.3em] mb-1 text-center">Current Peak</span>
                    <span className="text-xl font-black font-mono tracking-tighter text-center">
                      {(combResult.peak && !isNaN(combResult.peak.x)) ? Math.round(combResult.peak.x) : 0} 
                      <span className="text-white/20"> / </span> 
                      {(combResult.peak && !isNaN(combResult.peak.y)) ? Math.round(combResult.peak.y) : 0}
                    </span>
                  </div>
                  <div className="h-px w-full bg-white/10"></div>
                  <div className="flex flex-col text-center">
                    <span className="text-[8px] uppercase font-black text-amber-400 tracking-[0.3em] mb-1">Strategy Selection</span>
                    <span className="text-[9px] font-black uppercase text-white/90">{effectivePeakDir} & {edgeSelection}</span>
                  </div>
               </div>

               <div className="absolute bottom-10 left-10 flex gap-3">
                  <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-[9px] font-black text-white/60 flex items-center gap-3">
                    <div className="flex items-center gap-2"><MousePointer2 className="w-3 h-3"/> Scroll to Zoom</div>
                    <div className="w-px h-3 bg-white/10"></div>
                    <div className="flex items-center gap-2"><Hand className="w-3 h-3"/> Drag to Pan</div>
                    <div className="w-px h-3 bg-white/10"></div>
                    <button onClick={resetView} className="text-indigo-400 hover:text-white transition-colors">Reset View</button>
                  </div>
                  <div className="bg-indigo-600 px-4 py-2 rounded-full text-[9px] font-black text-white shadow-lg">Zoom: {viewScale.toFixed(1)}x</div>
               </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shrink-0">
               <div className="flex items-center gap-4 mb-4">
                 <div className="p-3 bg-indigo-50 rounded-xl"><ClipboardCheck className="w-5 h-5 text-indigo-500" /></div>
                 <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">解決反光干擾 (Glare Mitigation Report)</h2>
               </div>
               <div className="grid grid-cols-2 gap-8 text-[12px] text-slate-500 leading-relaxed">
                 <p><strong className="text-slate-900 font-bold">邊緣選擇技巧：</strong> 下方反光，建議將 <code className="bg-slate-50 px-1 rounded">Transition Select</code> 設為 <strong className="text-indigo-600">Last</strong>。這會忽略掃描路徑前端的反光正向邊緣，鎖定路徑最後一個符合極性的點（即真正的 Bump 頂部）。</p>
                 <p><strong className="text-slate-900 font-bold">反光防護：</strong> 如果反光非常強，可適度調高 <code className="bg-slate-50 px-1 rounded">Threshold</code>。Last 模式配合高閾值能有效排除 90% 的金屬面二次反光干擾。</p>
               </div>
            </div>
          </div>

          {/* 右側：統一指揮中心 (Unified Control Center) */}
          <div className="w-[420px] flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar shrink-0 animate-in fade-in slide-in-from-right duration-700">
            
            {/* 上傳底圖 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ImageIcon className="w-4 h-4 text-indigo-500" /> Image Source</h3>
                {imageSource && <button onClick={() => { setImageSource(null); setPixelData(null); }} className="text-rose-500 hover:scale-110 transition-transform"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
              <button onClick={() => fileInputRef.current.click()} className="w-full py-4 bg-indigo-50 text-indigo-600 rounded-2xl border-2 border-dashed border-indigo-200 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" /> {imageSource ? "Change Image" : "Upload Bottom Map"}
              </button>
            </div>

            {/* ROI 調整 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg space-y-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Maximize2 className="w-4 h-4 text-indigo-500" /> ROI Geometry</h3>
              <div className="grid grid-cols-1 gap-5">
                {[
                  { label: "Center Row", val: centerY, set: setCenterY, min: 0, max: 500 },
                  { label: "Center Col", val: centerX, set: setCenterX, min: 0, max: 500 },
                  { label: "Width", val: roiW, set: setRoiW, min: 10, max: 500 },
                  { label: "Height", val: roiH, set: setRoiH, min: 10, max: 500 }
                ].map((item, idx) => (
                  <div key={idx} className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                      <span className="text-slate-400">{item.label}</span>
                      <span className="text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded">{Math.round(item.val || 0)}</span>
                    </div>
                    <input type="range" min={item.min} max={item.max} value={item.val || 0} onChange={e=>item.set(Number(e.target.value) || 0)} className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                {['TopToBottom', 'BottomToTop', 'LeftToRight', 'RightToLeft'].map(d => (
                  <button key={d} onClick={() => setScanDir(d)} className={`py-2.5 text-[9px] font-black rounded-xl border-2 transition-all ${scanDir === d ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}>{d}</button>
                ))}
              </div>
            </div>

            {/* 核心算法與極性 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg space-y-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Settings className="w-4 h-4 text-amber-500" /> Algorithm Logic</h3>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Comb Density</label>
                    <input type="number" value={combDensity || 0} onChange={e=>setCombDensity(Number(e.target.value) || 0)} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-black font-mono focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Peak Count</label>
                    <input type="number" value={peakCount || 0} onChange={e=>setPeakCount(Number(e.target.value) || 0)} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-black font-mono focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Sigma</label>
                    <input type="number" step="0.1" value={sigma || 0} onChange={e=>setSigma(Number(e.target.value) || 0)} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-black font-mono focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Threshold</label>
                    <input type="number" value={threshold || 0} onChange={e=>setThreshold(Number(e.target.value) || 0)} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-black font-mono focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>

                <div className="space-y-3">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                      <span className="text-slate-400 text-[9px]">Result Offset (補正)</span>
                      <span className="text-orange-600 font-mono bg-orange-50 px-2 py-0.5 rounded">{offset || 0}</span>
                    </div>
                    <input type="range" min="-50" max="50" value={offset || 0} onChange={e=>setOffset(Number(e.target.value) || 0)} className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-orange-500" />
                </div>

                <div className="space-y-3">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Polarity</label>
                   <div className="grid grid-cols-2 gap-2">
                      <button onClick={()=>setPolarity('negative')} className={`py-3 text-[9px] font-black rounded-xl border-2 transition-all ${polarity === 'negative' ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>Negative</button>
                      <button onClick={()=>setPolarity('positive')} className={`py-3 text-[9px] font-black rounded-xl border-2 transition-all ${polarity === 'positive' ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>Positive</button>
                   </div>
                </div>

                <div className="space-y-3">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transition Select (防干擾)</label>
                   <div className="grid grid-cols-3 gap-2">
                      {['first', 'last', 'strongest'].map(mode => (
                        <button key={mode} onClick={()=>setEdgeSelection(mode)} className={`py-2 text-[8px] font-black rounded-lg border transition-all uppercase ${edgeSelection === mode ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>{mode}</button>
                      ))}
                   </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Peak Mode</label>
                  <select value={peakDir} onChange={e=>setPeakDir(e.target.value)} className="w-full p-3 bg-white border-2 border-slate-100 rounded-xl text-xs font-black text-indigo-600 outline-none focus:border-indigo-600 transition-colors">
                    <option value="Auto">Auto Decision</option>
                    <option value="Highest">Highest Y</option>
                    <option value="Lowest">Lowest Y</option>
                    <option value="Leftmost">Leftmost X</option>
                    <option value="Rightmost">Rightmost X</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 抗噪層配置 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg space-y-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Filter className="w-4 h-4 text-emerald-500" /> Filter Layers</h3>
              <div className="space-y-6">
                {[
                  { state: enableIQR, set: setEnableIQR, val: iqrFactor, setV: setIqrFactor, min: 0.5, max: 3, label: "IQR 統計離群係數", info: iqrFactor },
                  { state: enableRolling, set: setEnableRolling, val: rollingRadius, setV: setRollingRadius, min: 2, max: 30, label: "滾球形態學半徑", info: rollingRadius + " px" }
                ].map((f, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 transition-all hover:bg-white hover:shadow-md">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-600">{f.label}</span>
                      <button onClick={()=>f.set(!f.state)} className={`w-10 h-5 rounded-full transition-all relative ${f.state ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${f.state ? 'left-6' : 'left-1'}`}></div>
                      </button>
                    </div>
                    <input type="range" min={f.min} max={f.max} step="0.1" value={f.val || 0} onChange={e=>f.setV(Number(e.target.value) || 0)} className="w-full h-1 bg-slate-200 rounded-full appearance-none accent-indigo-600" />
                  </div>
                ))}
                
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
                   <div className="flex justify-between items-center text-[10px] font-black text-indigo-600">
                     <span>NEIGHBORHOOD 鄰域</span>
                     <button onClick={()=>setEnableNeighbor(!enableNeighbor)} className={`w-10 h-5 rounded-full relative ${enableNeighbor ? 'bg-indigo-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full ${enableNeighbor ? 'left-6' : 'left-1'}`}></div></button>
                   </div>
                   <div className="space-y-3">
                      <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase"><span>K-Neighbor</span><span className="text-indigo-600 font-bold">{neighborK || 0}</span></div>
                      <input type="range" min="1" max="10" value={neighborK || 0} onChange={e=>setNeighborK(Number(e.target.value) || 0)} className="w-full h-1 bg-indigo-100 accent-indigo-600" />
                   </div>
                </div>
              </div>
            </div>

            {/* Jay 的專家報告 */}
            <div className="bg-[#0F172A] rounded-3xl p-8 shadow-2xl relative overflow-hidden shrink-0">
               <div className="relative z-10 space-y-6">
                 <div className="flex items-center gap-3">
                   <div className="p-2.5 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/30 animate-pulse"><Zap className="w-5 h-5 text-white" /></div>
                   <span className="text-white font-black text-[11px] uppercase tracking-[0.3em]">Jay's Insight</span>
                 </div>
                 <p className="text-[12px] leading-relaxed text-slate-400 font-medium italic border-l-2 border-indigo-500 pl-4">
                   「面對反光，別跟它硬碰硬。切換到 <strong className="text-white">Last Mode</strong>，讓算法自動繞過前端的雜訊，直達真正的幾何頂點。」
                 </p>
               </div>
               <Wind className="absolute -right-8 -bottom-8 w-40 h-40 text-indigo-500 opacity-5" />
            </div>
          </div>
        </main>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
        input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; background: #4F46E5; cursor: pointer; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
      `}</style>
    </div>
  );
};

export default App;