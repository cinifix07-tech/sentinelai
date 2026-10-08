import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface PerimeterActivityChartProps {
  onNavigateToMonitor?: () => void;
}

const TODAY_DATA = [
  { time: '00:00', triggers: 1, verified: 0, filtered: 1 },
  { time: '02:00', triggers: 0, verified: 0, filtered: 0 },
  { time: '04:00', triggers: 0, verified: 0, filtered: 0 },
  { time: '06:00', triggers: 3, verified: 1, filtered: 2 },
  { time: '08:00', triggers: 7, verified: 3, filtered: 4 },
  { time: '10:00', triggers: 11, verified: 5, filtered: 6 },
  { time: '12:00', triggers: 14, verified: 7, filtered: 7 },
  { time: '14:00', triggers: 18, verified: 11, filtered: 7 }, // Peak courier window
  { time: '16:00', triggers: 12, verified: 6, filtered: 6 },
  { time: '18:00', triggers: 15, verified: 9, filtered: 6 },
  { time: '20:00', triggers: 6, verified: 2, filtered: 4 },
  { time: '22:00', triggers: 2, verified: 0, filtered: 2 },
];

const WEEK_DATA = [
  { time: 'Mon', triggers: 54, verified: 28, filtered: 26 },
  { time: 'Tue', triggers: 62, verified: 34, filtered: 28 },
  { time: 'Wed', triggers: 49, verified: 23, filtered: 26 },
  { time: 'Thu', triggers: 71, verified: 41, filtered: 30 },
  { time: 'Fri', triggers: 88, verified: 48, filtered: 40 },
  { time: 'Sat', triggers: 96, verified: 55, filtered: 41 },
  { time: 'Sun', triggers: 64, verified: 32, filtered: 32 },
];

export const PerimeterActivityChart: React.FC<PerimeterActivityChartProps> = ({
  onNavigateToMonitor,
}) => {
  const [timeRange, setTimeRange] = useState<'today' | 'week'>('today');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  const data = timeRange === 'today' ? TODAY_DATA : WEEK_DATA;

  const totalTriggers = data.reduce((acc, curr) => acc + curr.triggers, 0);
  const totalVerified = data.reduce((acc, curr) => acc + curr.verified, 0);
  const totalFiltered = data.reduce((acc, curr) => acc + curr.filtered, 0);

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-container-lowest/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-surface-container text-xs space-y-1.5 min-w-[170px]">
          <div className="flex items-center justify-between border-b border-surface-container pb-1">
            <span className="font-mono font-bold text-on-surface">{label}</span>
            <span className="text-[10px] text-on-surface-variant uppercase font-medium">Telemetry</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-primary">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span>Motion Triggers:</span>
            </span>
            <span className="font-mono font-bold">{payload[0]?.value}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-secondary">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              <span>AI Verified:</span>
            </span>
            <span className="font-mono font-bold">{payload[1]?.value}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-outline text-[11px] pt-0.5 border-t border-surface-container">
            <span>Filtered Noise:</span>
            <span className="font-mono">
              {(payload[0]?.value || 0) - (payload[1]?.value || 0)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm flex flex-col gap-4 border border-surface-container/60">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary-fixed text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">monitoring</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-semibold text-base text-on-surface">
                Perimeter Activity &amp; Motion Log
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-bold text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                HC-SR501
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Hourly infrared sensor events vs. conversational AI verified visits
            </p>
          </div>
        </div>

        {/* Controls: Time range & View toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Chart Type Toggle */}
          <div className="flex bg-surface-container-low p-0.5 rounded-lg border border-surface-container">
            <button
              onClick={() => setChartType('area')}
              title="Smooth Area Curve"
              className={`p-1.5 rounded-md text-xs transition-all ${
                chartType === 'area'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] block">area_chart</span>
            </button>
            <button
              onClick={() => setChartType('bar')}
              title="Bar Volume View"
              className={`p-1.5 rounded-md text-xs transition-all ${
                chartType === 'bar'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] block">bar_chart</span>
            </button>
          </div>

          {/* Time Range Pills */}
          <div className="flex bg-surface-container-low p-0.5 rounded-lg border border-surface-container">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                timeRange === 'today'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange('week')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                timeRange === 'week'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              7 Days
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 py-1">
        <div className="p-2.5 sm:p-3 rounded-xl bg-surface-container-low flex flex-col">
          <span className="text-[11px] text-on-surface-variant font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            Total Triggers
          </span>
          <span className="text-base sm:text-lg font-mono font-bold text-on-surface mt-0.5">
            {totalTriggers}
          </span>
          <span className="text-[10px] text-outline mt-0.5">3.3V GPIO 14</span>
        </div>

        <div className="p-2.5 sm:p-3 rounded-xl bg-surface-container-low flex flex-col">
          <span className="text-[11px] text-on-surface-variant font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            AI Verified
          </span>
          <span className="text-base sm:text-lg font-mono font-bold text-secondary mt-0.5">
            {totalVerified}
          </span>
          <span className="text-[10px] text-outline mt-0.5">Cadence confirmed</span>
        </div>

        <div className="p-2.5 sm:p-3 rounded-xl bg-surface-container-low flex flex-col">
          <span className="text-[11px] text-on-surface-variant font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-outline" />
            Filtered Noise
          </span>
          <span className="text-base sm:text-lg font-mono font-bold text-on-surface mt-0.5">
            {totalFiltered}
          </span>
          <span className="text-[10px] text-outline mt-0.5">Thermal rejected</span>
        </div>
      </div>

      {/* Recharts Canvas */}
      <div className="w-full h-56 sm:h-64 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTriggers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#005c55" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#005c55" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorVerified" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#006398" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#006398" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5eeff" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#6e7977"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#6e7977"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="triggers"
                name="PIR Triggers"
                stroke="#005c55"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorTriggers)"
                activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="verified"
                name="AI Verified Visits"
                stroke="#006398"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorVerified)"
                activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5eeff" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#6e7977"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#6e7977"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="triggers" name="PIR Triggers" fill="#005c55" radius={[4, 4, 0, 0]} />
              <Bar dataKey="verified" name="AI Verified Visits" fill="#006398" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Chart Footer Legend & Quick Link */}
      <div className="flex items-center justify-between pt-1 border-t border-surface-container text-[11px] text-on-surface-variant">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#005c55]" />
            <span>PIR Motion Triggers</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#006398]" />
            <span>AI Verified Visits</span>
          </span>
        </div>
        {onNavigateToMonitor && (
          <button
            onClick={onNavigateToMonitor}
            className="flex items-center gap-1 text-primary font-bold hover:underline transition-all"
          >
            <span>Live Radar</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        )}
      </div>
    </section>
  );
};
