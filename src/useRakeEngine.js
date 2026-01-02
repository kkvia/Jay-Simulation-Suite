import { useMemo } from 'react';
import { applyGaussian, filterIQR, filterNeighborhood, performRobustFit } from './visionLogic';
import { getRakePixel as getSimulatedPixel } from './simulator';

export const useRakeEngine = (pixelData, config) => {
  const {
    centerX, centerY, roiL1, roiL2, direction,
    sigma, threshold, polarity, sampleCount, offset,
    enableIQR, iqrFactor, enableNeighbor, neighborK, neighborThreshold
  } = config;

  const phi = useMemo(() => {
    switch (direction) {
      case 'TopToBottom': return -Math.PI / 2;
      case 'BottomToTop': return Math.PI / 2;
      case 'LeftToRight': return 0;
      case 'RightToLeft': return Math.PI;
      default: return 0;
    }
  }, [direction]);

  const samplePixel = (x, y) => {
    if (pixelData) {
      const ix = Math.floor(Math.max(0, Math.min(499, x)));
      const iy = Math.floor(Math.max(0, Math.min(499, y)));
      const idx = (iy * 500 + ix) * 4;
      return (pixelData[idx] * 0.299 + pixelData[idx+1] * 0.587 + pixelData[idx+2] * 0.114);
    }
    return getSimulatedPixel(x, y);
  };

  const rakeData = useMemo(() => {
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    const teeth = [];
    const rawDetectedPoints = [];

    for (let i = 0; i < sampleCount; i++) {
      const relY = (i / (sampleCount - 1) - 0.5) * (roiL2 * 2);
      const getCoord = (relX) => ({ x: centerX + (relX * cosP - relY * sinP), y: centerY + (relX * sinP + relY * cosP) });
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
      let bestIdx = -1, maxAmp = 0;
      for (let j = 0; j < deriv.length; j++) {
        const val = deriv[j];
        const isMatch = (polarity === 'positive' && val > threshold) || (polarity === 'negative' && val < -threshold);
        if (isMatch && Math.abs(val) > maxAmp) { maxAmp = Math.abs(val); bestIdx = j; }
      }
      let edgePt = null, correctedPt = null;
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
    let filteredPoints = [...rawDetectedPoints];
    if (enableIQR) filteredPoints = filterIQR(filteredPoints, 'Leftmost', iqrFactor); // Rake 簡化假設
    if (enableNeighbor) filteredPoints = filterNeighborhood(filteredPoints, neighborK, neighborThreshold);
    const fitResult = performRobustFit(filteredPoints, 6);
    return { teeth, fitResult, rawDetectedPoints, filteredPoints, phi };
  }, [centerX, centerY, roiL1, roiL2, phi, sampleCount, sigma, threshold, polarity, offset, pixelData, enableIQR, iqrFactor, enableNeighbor, neighborK, neighborThreshold]);

  return rakeData;
};