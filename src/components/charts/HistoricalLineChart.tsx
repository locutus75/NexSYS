import { useMemo } from "react";
import type { HistoricalStat } from "../../services/sentryStatsService";

interface HistoricalLineChartProps {
  stats: HistoricalStat[];
}

export function HistoricalLineChart({ stats }: HistoricalLineChartProps) {
  // We need at least 2 points to draw a meaningful line, otherwise we mock a flat line or show a message
  const hasEnoughData = stats.length > 1;

  const points = useMemo(() => {
    if (!hasEnoughData) return "";
    
    // SVG viewBox is 0 0 100 40
    const width = 100;
    const height = 40;
    const padding = 5;
    
    const minTime = stats[0].timestamp;
    const maxTime = stats[stats.length - 1].timestamp;
    const timeRange = maxTime - minTime || 1; // Prevent div by 0

    // Find min and max enabled counts to scale Y axis nicely
    // Add some padding to min/max so line doesn't touch edges
    const enabledCounts = stats.map(s => s.enabled);
    const minCount = Math.min(...enabledCounts);
    const maxCount = Math.max(...enabledCounts);
    
    const countRange = Math.max(maxCount - minCount, 10); // Minimum scale of 10 to avoid flatline looking extreme

    return stats.map(stat => {
      // Scale X from padding to width - padding
      const x = padding + ((stat.timestamp - minTime) / timeRange) * (width - 2 * padding);
      
      // Scale Y from height - padding (bottom) to padding (top)
      const normalizedY = (stat.enabled - minCount) / countRange; // 0 to 1
      const y = (height - padding) - (normalizedY * (height - 2 * padding));
      
      return `${x},${y}`;
    }).join(" ");
  }, [stats, hasEnoughData]);

  if (!hasEnoughData) {
    return (
      <div className="w-full h-full flex flex-col justify-center animate-fade-in py-2">
         <div className="text-xs text-muted font-semibold uppercase tracking-wider mb-2">Network Trend (Enabled)</div>
         <div className="flex flex-1 items-center justify-center border border-dashed border-[var(--color-border)] rounded-md">
           <span className="text-xs text-muted px-4 text-center">Collecting data... Check back tomorrow for the trend line.</span>
         </div>
      </div>
    );
  }

  const currentCount = stats[stats.length - 1].enabled;
  const previousCount = stats[0].enabled;
  const diff = currentCount - previousCount;
  const diffSign = diff >= 0 ? "+" : "";
  const diffColor = diff > 0 ? "var(--color-success)" : diff < 0 ? "var(--color-error)" : "var(--color-text-muted)";

  return (
    <div className="w-full h-full flex flex-col justify-center animate-fade-in py-2">
      <div className="flex justify-between items-end mb-2">
        <span className="text-xs text-muted font-semibold uppercase tracking-wider">Network Trend (Enabled)</span>
        <span className="text-xs font-bold" style={{ color: diffColor }}>
          {diffSign}{diff} nodes
        </span>
      </div>
      
      <div className="w-full h-20 relative">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full overflow-visible">
          {/* Gradient for area under the line */}
          <defs>
            <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          
          {/* Area fill */}
          <polygon 
            points={`5,40 ${points} 95,40`} 
            fill="url(#glow)" 
          />
          
          {/* Line stroke */}
          <polyline
            points={points}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Final point dot */}
          {points && (
            <circle 
              cx={points.split(" ").pop()?.split(",")[0]} 
              cy={points.split(" ").pop()?.split(",")[1]} 
              r="2" 
              fill="var(--color-accent)" 
            />
          )}
        </svg>
      </div>
    </div>
  );
}
