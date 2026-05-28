export interface HistoricalStat {
  timestamp: number;
  total: number;
  enabled: number;
}

const STORAGE_KEY = 'nexsys_sentry_historical_stats';
const RECORD_INTERVAL_MS = 60 * 60 * 1000; // 1 hour minimum between records

function generateMockData(currentTotal: number, currentEnabled: number): HistoricalStat[] {
  const mock: HistoricalStat[] = [];
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  
  // Generate 7 days of mock data trending slightly upwards towards the current
  let mockTotal = Math.max(0, currentTotal - 140);
  let mockEnabled = Math.max(0, currentEnabled - 120);
  
  for (let i = 7; i > 0; i--) {
    mockTotal += Math.floor(Math.random() * 25);
    mockEnabled += Math.floor(Math.random() * 20);
    mock.push({
      timestamp: now - (i * ONE_DAY),
      total: mockTotal,
      enabled: mockEnabled
    });
  }
  return mock;
}

export function getHistoricalStats(): HistoricalStat[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as HistoricalStat[];
  } catch (err) {
    console.error('Failed to parse historical stats', err);
    return [];
  }
}

export function recordSentryStats(total: number, enabled: number): HistoricalStat[] {
  let stats = getHistoricalStats();
  const now = Date.now();

  // MOCK DATA INJECTION FOR DEMONSTRATION
  if (stats.length === 0 || (stats.length === 1 && now - stats[0].timestamp < 10000)) {
    stats = generateMockData(total, enabled);
  }

  if (stats.length > 0) {
    const lastStat = stats[stats.length - 1];
    if (now - lastStat.timestamp < RECORD_INTERVAL_MS) {
      return stats; // Too soon to record again
    }
  }

  const newStat: HistoricalStat = { timestamp: now, total, enabled };
  const updatedStats = [...stats, newStat];

  // Keep only the last 90 days of stats (assuming ~24 records per day = 2160)
  if (updatedStats.length > 2160) {
    updatedStats.shift();
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStats));
  } catch (err) {
    console.error('Failed to save historical stats', err);
  }

  return updatedStats;
}
