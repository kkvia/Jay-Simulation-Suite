import React from 'react';
import { MousePointer2, Hand } from 'lucide-react';
import { WORLD_LINES } from '../../infrastructure/simulator';

const MonitorView = ({ 
  combResult, imageSource, viewScale, viewOffset, isPanning, 
  handlers, centerX, centerY, roiW, roiH, isDebugMode 
}) => {
  const { handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, resetView } = handlers;
  const { effectivePeakDir } = combResult;

  return (
    <div 
      className={`flex-1 bg-[#0F172A] rounded-[3.5rem] border-[10px] border-white shadow-2xl relative group overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg viewBox="0 0 500 500" className="w-full h-full">
        <g transform={`translate(${viewOffset.x}, ${viewOffset.y}) scale(${viewScale})`}>
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="0.5" opacity="0.05"/></pattern>
          </defs>
          <rect width="500" height="500" fill="url(#grid)" />