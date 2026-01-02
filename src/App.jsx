import React, { useState, useRef, useEffect } from 'react';
import { 
  Cpu, ClipboardCheck, Radio, MousePointer2, Hand
} from 'lucide-react';
import defaultImage from '../default.png';
import { useCombEngine } from './useCombEngine';
import CombControls from './CombControls';
import { COMB_LINES as WORLD_LINES } from './simulator';

// --- 配置與版本 ---
const VERSION = "V5.8.1 - Stable Reliability";

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

  // --- 整合配置狀態 ---
  const [config, setConfig] = useState({
    centerX: 147, centerY: 188, roiW: 205, roiH: 80,
    scanDir: 'BottomToTop', peakDir: 'Highest',
    sigma: 1, threshold: 10, polarity: 'positive',
    edgeSelection: 'all', offset: 0,
    combDensity: 80, peakCount: 5,
    enableIQR: false, iqrFactor: 1.5,
    enableNeighbor: true, neighborK: 3, neighborThreshold: 15,
    enableRolling: true, rollingRadius: 12
  });

  const [isDebugMode, setIsDebugMode] = useState(true);

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

  // --- 使用 Hook 進行計算 ---
  const combResult = useCombEngine(pixelData, config);
  const { effectivePeakDir } = combResult;

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

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-auto">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="max-w-[1850px] mx-auto p-4 lg:p-6 min-h-screen flex flex-col gap-6">
        
        {/* Header */}
        <header className="bg-white px-6 py-4 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col lg:flex-row justify-between items-center shrink-0 gap-4">
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

        <main className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          
          {/* 左側：監視器區域 */}
          <div className="flex-1 flex flex-col gap-6 min-w-0">
            <div 
              className={`h-[400px] lg:h-auto lg:flex-1 bg-[#0F172A] rounded-[2rem] lg:rounded-[3.5rem] border-[6px] lg:border-[10px] border-white shadow-2xl relative group overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
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
                    
                    <rect x={config.centerX - config.roiW / 2} y={config.centerY - config.roiH / 2} width={config.roiW} height={config.roiH} fill="rgba(79, 70, 229, 0.03)" stroke="rgba(79, 70, 229, 0.7)" strokeWidth={1.5 / Math.max(0.1, viewScale)} strokeDasharray={`${10/viewScale} ${5/viewScale}`} />
                    
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
                          <line x1={config.centerX - config.roiW / 2} y1={combResult.peak.y} x2={config.centerX + config.roiW / 2} y2={combResult.peak.y} stroke="#F59E0B" strokeWidth={4/viewScale} strokeLinecap="round" className="animate-pulse" />
                        ) : (
                          <line x1={combResult.peak.x} y1={config.centerY - config.roiH / 2} x2={combResult.peak.x} y2={config.centerY + config.roiH / 2} stroke="#F59E0B" strokeWidth={4/viewScale} strokeLinecap="round" className="animate-pulse" />
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
                    <span className="text-[9px] font-black uppercase text-white/90">{effectivePeakDir} & {config.edgeSelection}</span>
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
          <CombControls 
            config={config} 
            setConfig={setConfig} 
            imageSource={imageSource} 
            setImageSource={setImageSource} 
            setPixelData={setPixelData} 
            fileInputRef={fileInputRef} 
            handleImageUpload={handleImageUpload} 
          />
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