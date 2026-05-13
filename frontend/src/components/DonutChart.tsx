'use client';

interface DonutChartProps {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
}

export default function DonutChart({ segments, size = 120, strokeWidth = 16 }: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {total > 0 && segments.map((segment, i) => {
          const segmentValue = Math.max(0, segment.value);
          const segmentLength = (segmentValue / total) * circumference;
          const dashArray = `${segmentLength} ${circumference - segmentLength}`;
          const dashOffset = -offset;
          offset += segmentLength;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          );
        })}
      </svg>
    </div>
  );
}
