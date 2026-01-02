import { useMemo } from 'react';
import { applyGaussian, filterIQR, filterNeighborhood, filterRollingBall } from './visionLogic';
import { getCombPixel as getSimulatedPixel } from './simulator';

export const useCombEngine = (pixelData, config) => {
  const {
    centerX, centerY, roiW, roiH, scanDir, peakDir,
    sigma, threshold, polarity, edgeSelection,
    combDensity, peakCount, offset,
    enableIQR, iqrFactor,
    enableNeighbor, neighborK, neighborThreshold,
    enableRolling, rollingRadius
  } = config;

  const samplePixel = (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (pixelData && ix >= 0 && ix < 500 && iy >= 0 && iy < 500) {
      const idx = (iy * 500 + ix) * 4;
      return (pixelData[idx] * 0.299 + pixelData[idx+1] * 0.587 + pixelData[idx+2] * 0.114);
    }
    return getSimulatedPixel(x, y);
  };

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
        if (edgeSelection === 'first') bestIdx = matches[0].idx;
        else if (edgeSelection === 'last') bestIdx = matches[matches.length - 1].idx;
        else { matches.sort((a, b) => b.amp - a.amp); bestIdx = matches[0].idx; }
      }

      if (bestIdx !== -1) {
        const t = bestIdx / (profileSteps - 1);
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

      peak = { x: finalCol + ox, y: finalRow + oy };
    }
    return { teeth, rawPoints, filtered, peak, outliers: rawPoints.filter(rp => !filtered.includes(rp)), effectivePeakDir };
  }, [centerX, centerY, roiW, roiH, scanDir, sigma, threshold, polarity, edgeSelection, combDensity, peakCount, iqrFactor, enableIQR, enableNeighbor, neighborK, neighborThreshold, enableRolling, rollingRadius, effectivePeakDir, offset, pixelData]);

  return combResult;
};