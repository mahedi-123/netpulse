import { useMemo } from "react";

interface PulseTraceProps {
  values: number[];
  height?: number;
  color?: string;
  showGrid?: boolean;
  maxPoints?: number;
}

/**
 * Renders a series of numeric samples (typically ping RTTs) as a continuous line trace,
 * styled after an oscilloscope readout - the visual anchor for "pulse" throughout the app.
 * This is always real data, never decorative animation.
 */
export function PulseTrace({ values, height = 70, color = "var(--accent)", showGrid = true, maxPoints = 60 }: PulseTraceProps) {
  const width = 640;
  const trimmed = values.slice(-maxPoints);

  const path = useMemo(() => {
    if (trimmed.length < 2) return "";
    const max = Math.max(...trimmed, 1);
    const min = Math.min(...trimmed, 0);
    const range = Math.max(max - min, 1);
    const stepX = width / (maxPoints - 1);
    const startIndex = maxPoints - trimmed.length;

    const points = trimmed.map((v, i) => {
      const x = (startIndex + i) * stepX;
      const norm = (v - min) / range;
      const y = height - 8 - norm * (height - 16);
      return [x, y];
    });

    return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  }, [trimmed, maxPoints, height]);

  const lastPoint = useMemo(() => {
    if (trimmed.length === 0) return null;
    const max = Math.max(...trimmed, 1);
    const min = Math.min(...trimmed, 0);
    const range = Math.max(max - min, 1);
    const stepX = width / (maxPoints - 1);
    const startIndex = maxPoints - trimmed.length;
    const i = trimmed.length - 1;
    const x = (startIndex + i) * stepX;
    const norm = (trimmed[i] - min) / range;
    const y = height - 8 - norm * (height - 16);
    return [x, y];
  }, [trimmed, maxPoints, height]);

  return (
    <svg className="trace-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {showGrid && (
        <g opacity={0.5}>
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={`v${i}`} x1={(i * width) / 8} y1={0} x2={(i * width) / 8} y2={height} stroke="var(--grid-line)" strokeWidth={1} />
          ))}
          {Array.from({ length: 4 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={(i * height) / 3} x2={width} y2={(i * height) / 3} stroke="var(--grid-line)" strokeWidth={1} />
          ))}
        </g>
      )}
      {path && <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
      {lastPoint && <circle cx={lastPoint[0]} cy={lastPoint[1]} r={4} fill={color} />}
      {lastPoint && <circle cx={lastPoint[0]} cy={lastPoint[1]} r={8} fill={color} opacity={0.25} />}
    </svg>
  );
}
