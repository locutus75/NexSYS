

export interface PieChartData {
  label: string;
  value: number;
  color: string;
  gradientStart?: string;
  gradientEnd?: string;
}

interface StatusPieChartProps {
  data: PieChartData[];
}

export function StatusPieChart({ data }: StatusPieChartProps) {
  const total = data.reduce((acc, d) => acc + d.value, 0);

  if (total === 0) {
    return (
      <div className="text-muted text-sm flex items-center justify-center h-full">
        No data available
      </div>
    );
  }

  // Filter out zero values and sort so largest is first (optional, looks better)
  const sortedData = [...data].filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  let cumulativePercent = 0;

  function getCoordinatesForPercent(percent: number) {
    // - Math.PI / 2 to start at the top (12 o'clock)
    const angle = 2 * Math.PI * percent - Math.PI / 2;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    return [x, y];
  }

  const fullCirclePath = "M 1 0 A 1 1 0 1 1 -1 0 A 1 1 0 1 1 1 0 Z";

  return (
    <div className="flex h-full w-full items-center justify-center animate-fade-in py-2">
      <div className="relative aspect-square h-[120px] flex-shrink-0">
        <svg viewBox="-1 -1 2 2" className="w-full h-full drop-shadow-md overflow-visible">
          <defs>
            {sortedData.map((slice, i) => (
              <linearGradient id={`grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%" key={i}>
                <stop offset="0%" stopColor={slice.gradientStart || slice.color} />
                <stop offset="100%" stopColor={slice.gradientEnd || slice.color} />
              </linearGradient>
            ))}
          </defs>
          {sortedData.map((slice, i) => {
            const destPercent = slice.value / total;
            
            // Full circle if 100%
            if (destPercent >= 0.999) {
              return (
                <g key={i}>
                  <path d={fullCirclePath} fill={`url(#grad-${i})`} />
                </g>
              );
            }

            const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
            
            const midPercent = cumulativePercent + (destPercent / 2);
            const [midX, midY] = getCoordinatesForPercent(midPercent);
            
            cumulativePercent += destPercent;
            const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
            
            const largeArcFlag = destPercent > 0.5 ? 1 : 0;
            const pathData = [
              `M ${startX} ${startY}`,
              `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
              `L 0 0`,
            ].join(' ');

            // Text positioned in the middle of the donut ring (radius 0.8)
            const textRadius = 0.8;
            const textX = midX * textRadius;
            const textY = midY * textRadius;

            // Only show text inside if the slice is large enough (e.g. > 5%)
            return (
              <g key={i}>
                <path
                  d={pathData}
                  fill={`url(#grad-${i})`}
                  className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                  stroke="var(--color-bg-base)"
                  strokeWidth="0.04"
                  strokeLinejoin="round"
                />
                {destPercent > 0.05 && (
                  <text 
                    x={textX} 
                    y={textY} 
                    textAnchor="middle" 
                    dominantBaseline="central" 
                    fill="white" 
                    fontSize="0.14" 
                    fontWeight="bold"
                    className="pointer-events-none drop-shadow-sm"
                  >
                    {slice.value}
                  </text>
                )}
              </g>
            );
          })}
          {/* Inner circle for Donut effect */}
          <circle cx="0" cy="0" r="0.6" fill="var(--color-bg-base)" />
          
          {/* If 100%, render text inside donut manually */}
          {sortedData.length > 0 && sortedData[0].value / total >= 0.999 && (
            <text x="0" y="-0.8" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="0.14" fontWeight="bold">
              {sortedData[0].value}
            </text>
          )}
        </svg>
      </div>
      <div className="ml-8 flex flex-col justify-center gap-3 flex-grow max-w-[200px]">
        {sortedData.map((slice, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shadow-sm" style={{ background: `linear-gradient(135deg, ${slice.gradientStart || slice.color}, ${slice.gradientEnd || slice.color})` }}></span>
              <span 
                className="font-semibold truncate max-w-[120px]" 
                style={{ color: slice.color }}
                title={slice.label}
              >
                {slice.label}
              </span>
            </div>
            {/* The raw number is removed from the legend per user request, since it is shown inside the chart */}
          </div>
        ))}
      </div>
    </div>
  );
}
