import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { computeTrailSpeeds } from '../utils/geo';
import type { TrailPoint } from '../types';

export default function SpeedSparkline({ trail }: { trail: TrailPoint[] }) {
  if (trail.length < 3) return null;

  const speeds = computeTrailSpeeds(trail);
  const data = speeds.map((speed, i) => ({ i, speed: Math.round(speed * 10) / 10 }));

  return (
    <div className="h-10">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Area
            type="monotone"
            dataKey="speed"
            stroke="#22d3ee"
            fill="#22d3ee"
            fillOpacity={0.15}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
