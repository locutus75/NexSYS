import { useMemo } from "react";
import type { RawMasternodeList } from "../../services/syscoinRpcClient";

interface UptimeHistogramProps {
  mnList: RawMasternodeList;
}

export function UptimeHistogram({ mnList }: UptimeHistogramProps) {
  const buckets = useMemo(() => {
    let underWeek = 0;
    let underMonth = 0;
    let underSixMonths = 0;
    let overSixMonths = 0;

    const WEEK = 7 * 24 * 60 * 60;
    const MONTH = 30 * 24 * 60 * 60;
    const SIX_MONTHS = 180 * 24 * 60 * 60;

    Object.values(mnList).forEach(mn => {
      // Only count nodes that have been active and have activeseconds
      if (mn.status !== "ENABLED" || !mn.activeseconds) return;
      
      const secs = mn.activeseconds;
      if (secs < WEEK) underWeek++;
      else if (secs < MONTH) underMonth++;
      else if (secs < SIX_MONTHS) underSixMonths++;
      else overSixMonths++;
    });

    return [
      { label: "< 1w", count: underWeek, color: "#34d399" },
      { label: "1w - 1m", count: underMonth, color: "#10b981" },
      { label: "1m - 6m", count: underSixMonths, color: "#059669" },
      { label: "> 6m", count: overSixMonths, color: "#047857" },
    ];
  }, [mnList]);

  const maxCount = Math.max(...buckets.map(b => b.count), 1); // prevent div by zero

  return (
    <div className="w-full h-full flex flex-col justify-end animate-fade-in py-2">
      <div className="flex justify-between items-end mb-4">
        <span className="text-xs text-muted font-semibold uppercase tracking-wider">Node Uptime Distribution</span>
      </div>
      <div className="flex items-end justify-between w-full h-24 gap-2">
        {buckets.map((bucket, i) => {
          const heightPct = Math.max(5, (bucket.count / maxCount) * 100);
          return (
            <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group">
              <div 
                className="w-full rounded-t-sm transition-all duration-500 ease-out flex items-start justify-center pt-1"
                style={{ 
                  height: `${heightPct}%`, 
                  background: bucket.color,
                  opacity: 0.8
                }}
              >
                <span className="text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  {bucket.count}
                </span>
              </div>
              <div className="text-[10px] text-muted mt-2 text-center whitespace-nowrap">
                {bucket.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
