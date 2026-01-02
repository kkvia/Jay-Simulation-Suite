// --- Comb Simulator World (橫向波浪與反光) ---
export const COMB_LINES = [
  { id: 'Main_Bump', centerY: (x) => 300 - Math.exp(-Math.pow((x - 250) / 45, 2)) * 75, height: 12, gray: 35 },
  { id: 'Glare_Reflection', centerY: (x) => 340 - Math.exp(-Math.pow((x - 280) / 15, 2)) * 10, height: 8, gray: 20 },
  { id: 'Flat_Base', centerY: (x) => 300, height: 4, gray: 70 }
];

export const getCombPixel = (x, y, noiseLevel = 0.15) => {
  let grayBase = 245; 
  for (const line of COMB_LINES) {
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

// --- Rake Simulator World (縱向線條) ---
export const RAKE_LINES = [
  { id: 'Line_A', centerX: (y) => 180 + Math.sin(y / 45) * 15, width: 14, gray: 40 },
  { id: 'Line_B', centerX: (y) => 280 + Math.cos(y / 55) * 10, width: 10, gray: 30 },
  { id: 'Line_C', centerX: (y) => 380 - (y / 10), width: 8, gray: 20 },
];

export const getRakePixel = (x, y, noiseLevel = 0.2) => {
  let grayBase = 245; 
  for (const line of RAKE_LINES) {
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