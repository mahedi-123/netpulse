import { useMemo } from "react";

interface Props {
  values: number[];
  color?: string;
  maxPoints?: number;
}

/** Oscilloscope-style trace of real RTT samples - same signature mark as desktop. */
export function PulseTrace({ values, color = "var(--accent)", maxPoints = 44 }: Props) {
  const width = 400;
  const height = 56;
  const trimmed = values.slice(-maxPoints);

  const { path, last } = useMemo(() => {
    if (trimmed.length < 2) return { path: "", last: null as [number, number] | null };
    const max = Math.max(...trimmed);
    const min = Math.min(...trimmed);
    const range = Math.max(max - min, 1);
    const stepX = width / (maxPoints - 1);
    const startIndex = maxPoints - trimmed.length;

    const pts: [number, number][] = trimmed.map((v, i) => {
      const x = (startIndex + i) * stepX;
      const y = height - 7 - ((v - min) / range) * (height - 14);
      return [x, y];
    });

    return {
      path: pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" "),
      last: pts[pts.length - 1],
    };
  }, [trimmed, maxPoints]);

  return (
    <svg className="trace-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <g opacity={0.5}>
        {Array.from({ length: 7 }).map((_, i) => (
          <line key={`v${i}`} x1={(i * width) / 6} y1={0} x2={(i * width) / 6} y2={height} stroke="var(--grid-line)" strokeWidth={1} />
        ))}
        {Array.from({ length: 3 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={(i * height) / 2} x2={width} y2={(i * height) / 2} stroke="var(--grid-line)" strokeWidth={1} />
        ))}
      </g>
      {path && <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
      {last && <circle cx={last[0]} cy={last[1]} r={3.5} fill={color} />}
      {last && <circle cx={last[0]} cy={last[1]} r={7} fill={color} opacity={0.25} />}
    </svg>
  );
}
