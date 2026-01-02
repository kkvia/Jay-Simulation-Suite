/**
 * 核心影像處理與濾波算法 (Domain Service)
 */

export const applyGaussian = (data, sigma) => {
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

export const filterIQR = (points, direction, factor) => {
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

export const filterNeighborhood = (points, k, threshold) => {
  if (points.length <= k) return points;
  return points.filter(p1 => {
    const dists = points.filter(p2 => p1 !== p2)
      .map(p2 => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)))
      .sort((a, b) => a - b);
    const avgDist = dists.slice(0, k).reduce((sum, d) => sum + d, 0) / k;
    return avgDist <= threshold;
  });
};

export const filterRollingBall = (points, direction, radius) => {
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