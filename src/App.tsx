import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ReferenceLine,
  Label
} from 'recharts';
import { Fuel, Gauge, Clock, AlertCircle, Zap, Car } from 'lucide-react';

// Data transcribed from the user's uploaded image
const rawData = [
  { id: 'Trip 2', dist: 5.008, idle: 0.14, speed: 34.1, fuelTotal: 0.573, consumption: 11.435, duration: 528 },
  { id: 'Trip 18', dist: 7.895, idle: 0.375, speed: 39.7, fuelTotal: 0.877, consumption: 11.106, duration: 720 },
  { id: 'Trip 20', dist: 9.742, idle: 0.016, speed: 46.3, fuelTotal: 0.735, consumption: 7.55, duration: 760 },
  { id: 'Trip 24', dist: 18.285, idle: 0.174, speed: 36.9, fuelTotal: 1.974, consumption: 10.796, duration: 1786 },
  { id: 'Trip 26', dist: 21.953, idle: 0.135, speed: 35.5, fuelTotal: 1.748, consumption: 7.961, duration: 2226 },
  { id: 'Trip 32', dist: 5.215, idle: 0.132, speed: 21.4, fuelTotal: 0.55, consumption: 10.55, duration: 870 },
  { id: 'Trip 34', dist: 10.586, idle: 0.663, speed: 16.7, fuelTotal: 1.4, consumption: 13.222, duration: 2293 },
  { id: 'Trip 36', dist: 17.825, idle: 0.017, speed: 51.2, fuelTotal: 1.52, consumption: 8.526, duration: 1258 },
  { id: 'Trip 38', dist: 21.949, idle: 0.091, speed: 33.1, fuelTotal: 1.841, consumption: 8.389, duration: 2384 },
  { id: 'Trip 41', dist: 8.254, idle: 0.011, speed: 42.4, fuelTotal: 0.831, consumption: 10.066, duration: 702 },
  { id: 'Trip 45', dist: 6.754, idle: 0.066, speed: 32.1, fuelTotal: 0.532, consumption: 7.872, duration: 756 },
  { id: 'Trip 51', dist: 7.711, idle: 0.052, speed: 50.2, fuelTotal: 0.823, consumption: 10.669, duration: 554 },
  { id: 'Trip 52', dist: 8.258, idle: 0.336, speed: 33.1, fuelTotal: 0.747, consumption: 9.049, duration: 901 },
  { id: 'Trip 54', dist: 11.015, idle: 0.093, speed: 34.3, fuelTotal: 1.061, consumption: 9.631, duration: 1154 },
  { id: 'Trip 55', dist: 9.457, idle: 0.064, speed: 56.5, fuelTotal: 0.745, consumption: 7.877, duration: 605 },
  { id: 'Trip 70', dist: 10.132, idle: 0.023, speed: 52.8, fuelTotal: 0.839, consumption: 8.281, duration: 692 },
  { id: 'Trip 71', dist: 9.676, idle: 0.059, speed: 42, fuelTotal: 0.736, consumption: 7.603, duration: 829 }
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl">
        <p className="text-slate-200 font-bold mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-mono font-bold">{Number(entry.value).toFixed(2)}</span> {entry.unit}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function MetricCard({ title, value, unit, icon, trend, trendColor }: any) {
  return (
    <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg hover:border-slate-700 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div className="bg-slate-800 p-2 rounded-lg">{icon}</div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full bg-slate-800 ${trendColor}`}>
          {trend}
        </span>
      </div>
      <div>
        <h4 className="text-slate-400 text-sm font-medium">{title}</h4>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-2xl font-bold text-white">{value}</span>
          <span className="text-sm text-slate-500">{unit}</span>
        </div>
      </div>
    </div>
  );
}

function InsightItem({ title, desc, severity }: any) {
  const colors: Record<string, string> = {
    high: 'border-l-rose-500 bg-rose-900/10',
    medium: 'border-l-amber-500 bg-amber-900/10',
    good: 'border-l-emerald-500 bg-emerald-900/10'
  };

  return (
    <div className={`p-4 rounded-r-lg border-l-4 ${colors[severity as keyof typeof colors] || colors.medium}`}>
      <h4 className="text-slate-200 font-medium text-sm mb-1">{title}</h4>
      <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'correlations'>('overview');

  const { totalDistance, totalFuel, avgConsumption, avgSpeed, totalIdle } = useMemo(() => {
    const totalDistanceVal = rawData.reduce((acc, curr) => acc + curr.dist, 0);
    const totalFuelVal = rawData.reduce((acc, curr) => acc + curr.fuelTotal, 0);
    const totalIdleVal = rawData.reduce((acc, curr) => acc + curr.idle, 0);
    const avgConsumptionVal = rawData.reduce((acc, curr) => acc + curr.consumption, 0) / rawData.length;
    const avgSpeedVal = rawData.reduce((acc, curr) => acc + curr.speed, 0) / rawData.length;

    return {
      totalDistance: totalDistanceVal,
      totalFuel: totalFuelVal,
      totalIdle: totalIdleVal,
      avgConsumption: avgConsumptionVal,
      avgSpeed: avgSpeedVal
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <header className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              Fleet Efficiency Report
            </h1>
            <p className="text-slate-400 mt-1">Detailed analysis of trip performance and fuel consumption</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg transition-all ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('correlations')}
              className={`px-4 py-2 rounded-lg transition-all ${
                activeTab === 'correlations'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Deep Analysis
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Avg Consumption"
          value={avgConsumption.toFixed(2)}
          unit="L/100km"
          icon={<Fuel className="w-6 h-6 text-rose-500" />}
          trend="Target: < 8.0"
          trendColor="text-rose-400"
        />
        <MetricCard
          title="Total Distance"
          value={totalDistance.toFixed(1)}
          unit="km"
          icon={<Car className="w-6 h-6 text-blue-500" />}
          trend={`${rawData.length} Trips`}
          trendColor="text-blue-400"
        />
        <MetricCard
          title="Total Idle Time"
          value={totalIdle.toFixed(2)}
          unit="hrs"
          icon={<Clock className="w-6 h-6 text-amber-500" />}
          trend="High Impact"
          trendColor="text-amber-400"
        />
        <MetricCard
          title="Avg Trip Speed"
          value={avgSpeed.toFixed(1)}
          unit="km/h"
          icon={<Gauge className="w-6 h-6 text-emerald-500" />}
          trend="Optimal: 45"
          trendColor="text-emerald-400"
        />
      </div>

      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Consumption by Trip
              </h3>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="w-3 h-3 rounded-full bg-rose-500"></span> High
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Efficient
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rawData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis
                    dataKey="id"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickFormatter={(val) => (typeof val === 'string' ? val.split(' ')[1] : val)}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={12}
                    label={{ value: 'L/100km', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="3 3">
                    <Label value="Target Threshold" position="right" fill="#ef4444" fontSize={10} />
                  </ReferenceLine>
                  <Bar dataKey="consumption" name="Fuel Rate" radius={[4, 4, 0, 0]}>
                    {rawData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.consumption > 10 ? '#f43f5e' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg flex flex-col">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-400" />
              Manager Insights
            </h3>
            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
              <InsightItem
                title="Idle Time Critical"
                desc="Trip 34 had the highest idle time (0.66h) and the worst efficiency (13.2 L/100km). Reducing idle time is the easiest win."
                severity="high"
              />
              <InsightItem
                title="Short Trips Inefficiency"
                desc="Trips under 6km (Trip 2, 32) average >10.5 L/100km. Engine warm-up phase is costing fuel."
                severity="medium"
              />
              <InsightItem
                title="Efficient Cruising"
                desc="Best efficiency (Trip 20: 7.55 L/100km) occurred at 46.3 km/h avg speed with almost zero idle."
                severity="good"
              />
              <InsightItem
                title="Fuel Burn"
                desc={`Total fuel consumed across all trips: ${totalFuel.toFixed(2)} L.`}
                severity="medium"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <h3 className="text-lg font-semibold mb-2 text-slate-200">Impact of Idling on Efficiency</h3>
            <p className="text-xs text-slate-500 mb-6">Does sitting still cost money? (Higher Y is worse)</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" dataKey="idle" name="Idle Time" unit="h" stroke="#94a3b8" />
                  <YAxis type="number" dataKey="consumption" name="Consumption" unit=" L" stroke="#94a3b8" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                  <Scatter name="Trips" data={rawData} fill="#f59e0b" shape="circle" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <h3 className="text-lg font-semibold mb-2 text-slate-200">Economy of Scale (Distance)</h3>
            <p className="text-xs text-slate-500 mb-6">Are longer trips more efficient? (Lower Y is better)</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" dataKey="dist" name="Distance" unit="km" stroke="#94a3b8" />
                  <YAxis type="number" dataKey="consumption" name="Consumption" unit=" L" stroke="#94a3b8" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                  <Scatter name="Trips" data={rawData} fill="#3b82f6" shape="circle" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="col-span-1 md:col-span-2 bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <h3 className="text-lg font-semibold mb-2 text-slate-200">Speed vs. Efficiency Curve</h3>
            <p className="text-xs text-slate-500 mb-6">Finding the optimal driving speed</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" dataKey="speed" name="Avg Speed" unit="km/h" stroke="#94a3b8" domain={[0, 'auto']} />
                  <YAxis type="number" dataKey="consumption" name="Consumption" unit=" L" stroke="#94a3b8" domain={[0, 20]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                  <Scatter name="Trips" data={rawData} fill="#10b981" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
