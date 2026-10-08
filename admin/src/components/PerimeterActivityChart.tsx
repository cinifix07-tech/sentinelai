import React, { useEffect, useState } from 'react';
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
import { apiGet } from '../api.js';

interface PerimeterActivityChartProps {
  onNavigateToMonitor?: () => void;
}

type ChartPoint = { time: string; triggers: number; verified: number; filtered: number };
type MotionEvent = {
  id: string;
  title: string;
  detail: string;
  time: string;
  created_at?: string;
  location?: string;
};

function emptyTodayData(): ChartPoint[] {
  return Array.from({ length: 12 }, (_, index) => {
    const hour = index * 2;
    return { time: `${String(hour).padStart(2, '0')}:00`, triggers: 0, verified: 0, filtered: 0 };
  });
}

function emptyWeekData(): ChartPoint[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return { time: date.toLocaleDateString([], { weekday: 'short' }), triggers: 0, verified: 0, filtered: 0 };
  });
}

function buildLiveData(events: Array<{ created_at?: string }>) {
  const today = emptyTodayData();
  const week = emptyWeekData();
  const now = new Date();
  events.forEach((event) => {
    if (!event.created_at) return;
    const timestamp = new Date(event.created_at);
    if (Number.isNaN(timestamp.getTime())) return;
    if (timestamp.toDateString() === now.toDateString()) {
      const bucket = Math.min(11, Math.floor(timestamp.getHours() / 2));
      today[bucket].triggers += 1;
    }
    const age = Math.floor((now.getTime() - timestamp.getTime()) / 86400000);
    if (age >= 0 && age < 7) {
      const bucket = week.length - 1 - age;
      week[bucket].triggers += 1;
    }
  });
  return { today, week };
}

export const PerimeterActivityChart: React.FC<PerimeterActivityChartProps> = ({
  onNavigateToMonitor,
}) => {
  const [timeRange, setTimeRange] = useState<'today' | 'week'>('today');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveData, setLiveData] = useState(() => ({ today: emptyTodayData(), week: emptyWeekData() }));
  const [recentEvents, setRecentEvents] = useState<MotionEvent[]>([]);

  const data = timeRange === 'today' ? liveData.today : liveData.week;

  useEffect(() => {
    let active = true;
    const loadActivity = () => {
      apiGet('/iot/activity?limit=5000').then((response) => {
        if (!active) return;
        const events = Array.isArray(response?.events) ? response.events : [];
        setLiveData(buildLiveData(events));
        setRecentEvents(events.slice(0, 5));
      }).catch(() => undefined);
    };
    loadActivity();
    const timer = window.setInterval(loadActivity, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const totalTriggers = data.reduce((acc, curr) => acc + curr.triggers, 0);
  const totalVerified = data.reduce((acc, curr) => acc + curr.verified, 0);
  const totalFiltered = data.reduce((acc, curr) => acc + curr.filtered, 0);

  useEffect(() => {
    if (!isFullscreen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isFullscreen]);

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
    <section
      role={isFullscreen ? 'dialog' : undefined}
      aria-modal={isFullscreen || undefined}
      aria-label={isFullscreen ? 'Expanded perimeter activity and motion log' : undefined}
      className={`bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm flex flex-col gap-4 border border-surface-container/60 ${
        isFullscreen
          ? 'fixed inset-3 sm:inset-6 z-50 overflow-y-auto bg-white shadow-2xl'
          : ''
      }`}
    >
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary-fixed text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">monitoring</span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display font-semibold text-base text-on-surface">
                Perimeter Activity &amp; Motion Log
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-bold text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                HC-SR501
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Live PostgreSQL motion events from the HC-SR501 sensor
            </p>
          </div>
        </div>

        {/* Controls: Time range & View toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            aria-label={isFullscreen ? 'Close expanded chart' : 'Expand chart'}
            onClick={() => setIsFullscreen((fullscreen) => !fullscreen)}
            className="hidden sm:inline-flex h-8 items-center gap-1 rounded-lg border border-surface-container bg-surface-container-low px-2.5 text-[11px] font-semibold text-primary transition-colors hover:bg-surface-container"
          >
            <span>{isFullscreen ? 'Close' : 'Expand'}</span>
            <span className="material-symbols-outlined text-[16px]">
              {isFullscreen ? 'close_fullscreen' : 'open_in_full'}
            </span>
          </button>
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls="perimeter-chart-details"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className="sm:hidden inline-flex h-8 items-center gap-1 rounded-lg border border-surface-container bg-surface-container-low px-2 text-[11px] font-semibold text-primary transition-colors hover:bg-surface-container"
          >
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
            <span className="material-symbols-outlined text-[16px]">
              {isExpanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>
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

      <div
        id="perimeter-chart-details"
        className={`${isExpanded || isFullscreen ? 'flex' : 'hidden'} sm:flex flex-col gap-4`}
      >
      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 sm:gap-3 py-1">
        <div className="p-2.5 sm:p-3 rounded-xl bg-surface-container-low flex flex-col">
          <span className="text-[11px] text-on-surface-variant font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            Total Triggers
          </span>
          <span className="text-base sm:text-lg font-mono font-bold text-on-surface mt-0.5">
            {totalTriggers}
          </span>
          <span className="text-[10px] text-outline mt-0.5">3.3V GPIO 27</span>
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
      <div className="w-full h-52 sm:h-64 pt-2">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={208}>
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

      <div className="rounded-xl bg-surface-container-low px-3 py-2.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
            Recently saved motion
          </span>
          <span className="text-[10px] text-primary font-semibold">PostgreSQL</span>
        </div>
        {recentEvents.length ? (
          <div className="divide-y divide-surface-container">
            {recentEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 py-1.5 text-[11px]">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span className="truncate text-on-surface">{event.title}</span>
                  <span className="hidden sm:inline truncate text-on-surface-variant">{event.location || 'Front entrance'}</span>
                </div>
                <span className="font-mono text-on-surface-variant shrink-0">
                  {event.created_at ? new Date(event.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : event.time}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-on-surface-variant">No motion records saved yet.</p>
        )}
      </div>

      {/* Chart Footer Legend & Quick Link */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1 border-t border-surface-container text-[11px] text-on-surface-variant">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
      </div>
    </section>
  );
};
