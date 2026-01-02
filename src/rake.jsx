import React, { useState, useRef } from 'react';
import { 
  BarChart2, MousePointer2, Radio, Target as TargetIcon
} from 'lucide-react';
import { useRakeEngine } from './useRakeEngine';
import RakeControls from './RakeControls';
import { RAKE_LINES as WORLD_LINES } from './simulator';

// --- 配置與版本 ---
const AUTHOR = "Jay";
const VERSION = "V4.2.0 - Rake Precision Engine";

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

  // --- Rake 配置狀態 ---
  const [config, setConfig] = useState({
    centerX: 250, centerY: 250, roiL1: 120, roiL2: 140,
    direction: 'LeftToRight', sigma: 1.2, threshold: 25,
    polarity: 'negative', sampleCount: 40, offset: 0,
    enableIQR: true, iqrFactor: 1.5,
    enableNeighbor: true, neighborK: 3, neighborThreshold: 15
  });

  const [activeTooth, setActiveTooth] = useState(0);

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

  // --- RAKE 計算核心 ---
  const rakeData = useRakeEngine(pixelData, config);

  const activeData = rakeData.teeth[activeTooth] || rakeData.teeth[0];

  // --- 縮放與平移邏輯 ---
  const handleWheel = (e) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? -1 : 1;
    setViewScale(s => Math.max(1, Math.min(s + direction * 0.15, 6)));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100 overflow-auto">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="max-w-[1850px] mx-auto p-4 lg:p-6 min-h-screen flex flex-col gap-6">
        
        {/* Header */}
        <header className="bg-white px-6 py-5 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col lg:flex-row justify-between items-center shrink-0 gap-4">
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

        <main className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          
          {/* 左側：核心監視器與分析 */}
          <div className="flex-1 flex flex-col gap-6 min-w-0">
            
            {/* 主監視器 */}
            <div 
              className={`h-[400px] lg:h-auto lg:flex-1 bg-white rounded-[2rem] lg:rounded-[3.5rem] border-[6px] lg:border-[10px] border-white shadow-2xl relative overflow-hidden ring-1 ring-slate-200 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
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
                  <g transform={`translate(${config.centerX}, ${config.centerY}) rotate(${rakeData.phi * 180 / Math.PI})`}>
                    <rect 
                      x={-config.roiL1} y={-config.roiL2} width={config.roiL1*2} height={config.roiL2*2} 
                      fill="rgba(79, 70, 229, 0.02)" stroke="#4F46E5" strokeWidth={1/viewScale} strokeDasharray={`${8/viewScale} ${4/viewScale}`}
                    />
                    <line x1={-config.roiL1} y1="0" x2={-config.roiL1-30/viewScale} y2="0" stroke="#4F46E5" strokeWidth={3/viewScale} markerEnd="url(#arrow-rake)" />
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
                      <line x1="0" y1={50 - config.threshold} x2={activeData.deriv.length} y2={50 - config.threshold} stroke="#F59E0B" strokeWidth="1" strokeDasharray="5 5" />
                      <line x1="0" y1={50 + config.threshold} x2={activeData.deriv.length} y2={50 + config.threshold} stroke="#F59E0B" strokeWidth="1" strokeDasharray="5 5" />
                    </svg>
                  </div>
               </div>
            </div>
          </div>

          {/* 右側：精準控制台 */}
          <RakeControls 
            config={config} 
            setConfig={setConfig} 
            imageSource={imageSource} 
            fileInputRef={fileInputRef} 
            handleImageUpload={handleImageUpload} 
          />
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