/**
 * 物理模擬引擎 (Infrastructure)
 */

export const WORLD_LINES = [
  { id: 'Main_Bump', centerY: (x) => 300 - Math.exp(-Math.pow((x - 250) / 45, 2)) * 75, height: 12, gray: 35 },
  { id: 'Glare_Reflection', centerY: (x) => 340 - Math.exp(-Math.pow((x - 280) / 15, 2)) * 10, height: 8, gray: 20 },
  { id: 'Flat_Base', centerY: (x) => 300, height: 4, gray: 70 }
];

export const getSimulatedPixel = (x, y, noiseLevel = 0.15) => {
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