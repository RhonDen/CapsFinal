import api from '../../api.js';
import { BarChart3, Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AdminPageShell from '../../components/admin/AdminPageShell.jsx';
import {
  formatServiceLabel,
  formatStatusLabel,
  getLocalDateKey,
} from '../../utils/schedule.js';

const COLORS = ['#0C243D', '#27496A', '#5C8EB4', '#9AB7CD', '#C1D1DB', '#E8A87C', '#95D5B2', '#F4A261'];

// Distinct colors for each appointment status in the Status Distribution chart.
const STATUS_BAR_COLORS = {
  accepted: '#3B82F6',
  rejected: '#EF4444',
  completed: '#10B981',
  notCompleted: '#F59E0B',
  cancelled: '#6B7280',
  pending: '#8B5CF6',
};

// Track the viewport width so charts can adapt to phones vs desktops.
function useViewportWidth() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
}

const ANALYSIS_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'predictive', label: 'Predictive (Next Month)' },
];

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

// Custom tooltip for pie chart with percentage
const PieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const total = payload[0].payload.total || 0;
    const pct = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
        <p className="text-sm font-semibold text-maastricht">{data.name}</p>
        <p className="text-sm text-police">{data.value} appointments ({pct}%)</p>
      </div>
    );
  }
  return null;
};

// Clean legend list below the pie chart showing full service name,
// count, and percentage — prevents text overlap entirely.
const PieLegend = ({ data, colors }) => {
  if (!data || data.length === 0) return null;
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <div className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {data.map((entry, idx) => {
        const pct = total > 0 ? ((Number(entry.value || 0) / total) * 100).toFixed(1) : '0.0';
        return (
          <div
            key={`${entry.name}-${idx}`}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: colors[idx % colors.length] }}
            />
            <span
              className="min-w-0 flex-1 truncate text-xs font-medium text-maastricht dark:text-slate-200"
              title={entry.name}
            >
              {entry.name}
            </span>
            <span className="shrink-0 text-xs font-bold text-maastricht dark:text-slate-100">
              {entry.value}
            </span>
            <span className="w-12 shrink-0 text-right text-xs text-police dark:text-slate-400">
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Draw compact count labels inside donut slices (only for slices large enough
// to avoid overlap). White text with dark outline stays readable on any slice color.
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) => {
  const slicePercent = Number(percent) || 0;
  if (slicePercent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = (innerRadius + outerRadius) / 2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      stroke="#0a1830"
      strokeWidth={1.5}
      paintOrder="stroke"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={700}
    >
      {value}
    </text>
  );
};

function DataAnalysis() {
  const now = new Date();
  const today = getLocalDateKey();

  const [analysisType, setAnalysisType] = useState('monthly');
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [data, setData] = useState({
    pie: [],
    line: [],
    bar: [],
    peakHours: [],
    predictivePie: [],
    diagnostic: null,
    predictive: null,
    comparison: null,
    rejectionAnalysis: null,
    statusTimeline: [],
    serviceTrend: [],
    walkInVsOnline: null,
  });

  const [selectedPredictiveService, setSelectedPredictiveService] = useState('');
  const [loading, setLoading] = useState(false);

  const viewportWidth = useViewportWidth();
  const isMobile = viewportWidth < 640;
  const pieOuterRadius = isMobile ? 90 : 140;
  const pieInnerRadius = isMobile ? 45 : 70;
  const pieMargins = isMobile
    ? { top: 16, right: 16, bottom: 16, left: 16 }
    : { top: 40, right: 60, bottom: 40, left: 60 };
  const pieHeightClass = isMobile ? 'h-[440px]' : 'h-[560px]';

  const pieTotal = useMemo(() => {
    const arr = analysisType === 'predictive' ? data.predictivePie : data.pie;
    return Array.isArray(arr) ? arr.reduce((sum, item) => sum + Number(item.value || 0), 0) : 0;
  }, [analysisType, data.pie, data.predictivePie]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, index) => currentYear - 4 + index);
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        let params = {};

        if (analysisType === 'daily') {
          params = { type: 'daily', date: selectedDate };
        } else if (analysisType === 'weekly') {
          params = { type: 'weekly', date: selectedDate };
        } else if (analysisType === 'predictive') {
          params = { type: 'predictive', month: selectedMonth, year: selectedYear };
        } else if (analysisType === 'yearly') {
          params = { type: 'yearly', year: selectedYear };
        } else {
          params = { type: 'monthly', month: selectedMonth, year: selectedYear };
        }

        const response = await api.get('/api/admin/analytics', { params });

        const normalizePie = (arr) => {
          const safe = Array.isArray(arr) ? arr : [];
          return safe
            .map((item) => {
              const rawName = item?.name ?? item?.service ?? item?.label ?? item?.id ?? '';
              const rawValue =
                item?.value ??
                item?.count ??
                item?.appointments ??
                item?.total ??
                item?.y ??
                0;

              const valueNum = Number(rawValue);
              return {
                name: formatServiceLabel(String(rawName)),
                value: Number.isFinite(valueNum) ? valueNum : 0,
              };
            })
            .filter((x) => x.name);
        };

        const descriptive = response.data.descriptive || {};
        const diagnostic = response.data.diagnostic || null;
        const predictive = response.data.predictive || null;
        const comparison = response.data.comparison || null;

        const normalizedPredictivePie = normalizePie(
          response.data.predictivePie || descriptive.pie
        );

        const pieData = normalizePie(descriptive.pie);
        const totalPie = pieData.reduce((sum, item) => sum + item.value, 0);
        const pieWithTotal = pieData.map(item => ({ ...item, total: totalPie }));

        const predictivePieData = normalizedPredictivePie;
        const totalPredictive = predictivePieData.reduce((sum, item) => sum + item.value, 0);
        const predictivePieWithTotal = predictivePieData.map(item => ({ ...item, total: totalPredictive }));

        setData({
          pie: pieWithTotal,
          predictivePie: predictivePieWithTotal,
          line: descriptive.line || [],
          bar: (descriptive.bar || []).map((item) => ({
            ...item,
            statusLabel: formatStatusLabel(item.name),
          })),
          peakHours: Array.isArray(descriptive.peakHours) ? descriptive.peakHours : [],
          diagnostic,
          predictive,
          comparison,
          rejectionAnalysis: response.data.rejectionAnalysis || null,
          statusTimeline: response.data.statusTimeline || [],
          serviceTrend: response.data.serviceTrend || [],
          walkInVsOnline: response.data.walkInVsOnline || null,
        });

        if (analysisType === 'predictive') {
          setSelectedPredictiveService((prev) => {
            const stillExists = predictivePieWithTotal.some((x) => x.name === prev);
            if (stillExists) return prev;
            return predictivePieWithTotal[0]?.name || '';
          });
        } else {
          setSelectedPredictiveService('');
        }
      } catch (error) {
        console.error('Analytics fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [analysisType, selectedDate, selectedMonth, selectedYear]);

  const title = useMemo(() => {
    if (analysisType === 'daily') return 'Daily Analysis';
    if (analysisType === 'weekly') return 'Weekly Analysis';
    if (analysisType === 'predictive') return 'Predictive (Next Month) Analysis';
    if (analysisType === 'yearly') return 'Yearly Analysis';
    return 'Monthly Analysis';
  }, [analysisType]);

  const description = useMemo(() => {
    if (analysisType === 'daily') {
      return `Analysis for ${selectedDate}: completed services, total appointments, and status distribution.`;
    }
    if (analysisType === 'weekly') {
      return `Analysis for the week starting ${selectedDate}: daily breakdown of appointments and status distribution.`;
    }
    if (analysisType === 'predictive') {
      const monthLabel =
        MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.label || 'Selected Month';
      return `Forecast for the next month based on ${monthLabel} ${selectedYear} and recent demand.`;
    }
    if (analysisType === 'yearly') {
      return `Analysis for ${selectedYear}: monthly breakdown of completed services and status distribution.`;
    }
    const monthLabel =
      MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.label || 'Selected Month';
    return `Analysis for ${monthLabel} ${selectedYear}: daily breakdown of completed services and status distribution.`;
  }, [analysisType, selectedDate, selectedMonth, selectedYear]);

  const predictiveServiceDetails = useMemo(() => {
    if (analysisType !== 'predictive') return null;
    const list = Array.isArray(data.predictivePie) ? data.predictivePie : [];
    const selected = selectedPredictiveService
      ? list.find((x) => x.name === selectedPredictiveService) || null
      : null;

    const topN = list.slice(0, 8);
    return { selected, topN, totalServices: list.length };
  }, [analysisType, data.predictivePie, selectedPredictiveService]);

  return (
    <AdminPageShell title={title} description={description} icon={BarChart3}>
      {/* ── Controls ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="text-sm font-medium text-maastricht dark:text-slate-200">Analysis Type</label>
          <select
            value={analysisType}
            onChange={(event) => setAnalysisType(event.target.value)}
            className="rounded-xl border bg-white px-4 py-2 text-sm text-maastricht dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {ANALYSIS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          {(analysisType === 'daily' || analysisType === 'weekly') && (
            <>
              <label className="text-sm font-medium text-maastricht dark:text-slate-200">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="rounded-xl border bg-white px-4 py-2 text-sm text-maastricht dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              />
            </>
          )}

          {analysisType === 'yearly' && (
            <>
              <label className="text-sm font-medium text-maastricht dark:text-slate-200">Year</label>
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
                className="rounded-xl border bg-white px-4 py-3 text-sm text-maastricht dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </>
          )}

          {(analysisType === 'monthly' || analysisType === 'predictive') && (
            <>
              <select
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(Number(event.target.value))}
                className="rounded-xl border bg-white px-4 py-3 text-sm text-maastricht dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              >
                {MONTH_OPTIONS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
                className="rounded-xl border bg-white px-4 py-3 text-sm text-maastricht dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-slate-400">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            <span className="text-sm">Loading analytics…</span>
          </div>
        </div>
      ) : (
        <>
          {/* ── PREDICTIVE ANALYTICS (Top Priority) ── */}
          {data.predictive && data.predictive.forecast && data.predictive.forecast.length > 0 && (
            <div className="mt-8">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-xl font-bold text-maastricht dark:text-slate-100">Predictive Analytics</h2>
                <Info className="h-4 w-4 text-silver-lake" title="Forecast based on historical trends" />
              </div>
              <p className="mb-4 text-sm text-police dark:text-slate-300">
                What might happen? — Forecast based on historical trends and demand patterns.
              </p>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {data.predictive.forecast.map((item, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-police dark:text-slate-300">{item.period}</p>
                      {item.actual !== undefined && (
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-200">Actual</span>
                      )}
                      {item.projected !== undefined && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900 dark:text-amber-200">Projected</span>
                      )}
                    </div>
                    <p className="mt-4 text-3xl font-bold text-maastricht dark:text-slate-100">
                      {item.actual !== undefined ? item.actual : item.projected}
                    </p>
                    <p className="mt-1 text-sm text-police dark:text-slate-300">appointments</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PERIOD COMPARISON (Top Priority) ── */}
          {data.comparison && (
            <div className="mt-8">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-xl font-bold text-maastricht dark:text-slate-100">Period Comparison</h2>
                <Info className="h-4 w-4 text-silver-lake" title="Compare current period vs previous" />
              </div>
              <p className="mb-4 text-sm text-police dark:text-slate-300">How does this period compare to the previous one?</p>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-sm font-medium text-police dark:text-slate-300">{data.comparison.previous?.period || 'Previous'}</p>
                  <p className="mt-2 text-3xl font-bold text-maastricht dark:text-slate-100">{data.comparison.previous?.count || 0}</p>
                  <p className="mt-1 text-sm text-police dark:text-slate-300">appointments</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-sm font-medium text-police dark:text-slate-300">{data.comparison.current?.period || 'Current'}</p>
                  <p className="mt-2 text-3xl font-bold text-maastricht dark:text-slate-100">{data.comparison.current?.count || 0}</p>
                  <p className="mt-1 text-sm text-police dark:text-slate-300">appointments</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-sm font-medium text-police dark:text-slate-300">Change</p>
                  <p className={`mt-2 text-3xl font-bold ${data.comparison.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.comparison.change >= 0 ? '+' : ''}{data.comparison.change}%
                  </p>
                  <p className="mt-1 text-sm text-police dark:text-slate-300">
                    {data.comparison.change >= 0 ? 'increase' : 'decrease'} from previous
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-semibold text-maastricht dark:text-slate-100">
            {analysisType === 'predictive'
              ? 'Predicted Most Appointments Service (Next Month)'
              : 'Most Completed Services'}
          </h2>

          <div className="relative">
            <div className={pieHeightClass}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={pieMargins}>
                  <Pie
                    data={analysisType === 'predictive' ? data.predictivePie : data.pie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={pieInnerRadius}
                    outerRadius={pieOuterRadius}
                    paddingAngle={2}
                    label={renderPieLabel}
                  >
                    {(analysisType === 'predictive' ? data.predictivePie : data.pie).map(
                      (entry, index) => {
                        const isSelected =
                          analysisType === 'predictive' &&
                          selectedPredictiveService &&
                          entry?.name === selectedPredictiveService;

                        return (
                          <Cell
                            key={`${entry.name}-${index}`}
                            fill={COLORS[index % COLORS.length]}
                            opacity={
                              analysisType === 'predictive' && selectedPredictiveService
                                ? isSelected
                                  ? 1
                                  : 0.35
                                : 1
                            }
                            style={{
                              cursor: analysisType === 'predictive' ? 'pointer' : 'default',
                            }}
                            onClick={() => {
                              if (analysisType !== 'predictive') return;
                              setSelectedPredictiveService(entry?.name || '');
                            }}
                          />
                        );
                      }
                    )}
                  </Pie>
                <Tooltip
                  formatter={(value, _name, props) => {
                    const name = props?.payload?.name;
                    return [`${value}`, name];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            </div>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-police dark:text-slate-400">
                Total
              </span>
              <span className="text-2xl font-bold text-maastricht dark:text-slate-100">
                {pieTotal}
              </span>
            </div>
          </div>

          <PieLegend
            data={analysisType === 'predictive' ? data.predictivePie : data.pie}
            colors={COLORS}
          />

          {analysisType === 'predictive' && predictiveServiceDetails ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">
                Selected forecast
              </p>
              <div className="mt-2 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-maastricht dark:text-slate-100">
                    {predictiveServiceDetails.selected?.name || 'Click a pie segment'}
                  </p>
                  <p className="mt-1 text-sm text-police dark:text-slate-300">
                    Predicted next-month appointments: <span className="font-semibold">{predictiveServiceDetails.selected?.value ?? 0}</span>
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {analysisType === 'predictive' && predictiveServiceDetails ? (
          <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
            <h2 className="mb-4 text-lg font-semibold text-maastricht dark:text-slate-100">
              Predictive service picker
            </h2>
            <p className="mb-4 text-sm text-police dark:text-slate-300">
              Click to focus. This won’t change other charts (backend returns predictive totals only),
              but it makes the forecast board navigable.
            </p>

            <div className="flex flex-col gap-3">
              {predictiveServiceDetails.topN.length ? (
                predictiveServiceDetails.topN.map((entry, idx) => {
                  const isSelected = entry.name === selectedPredictiveService;
                  return (
                    <button
                      key={`${entry.name}-${idx}`}
                      type="button"
                      onClick={() => setSelectedPredictiveService(entry.name)}
                      className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-maastricht bg-maastricht/10'
                          : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="h-3.5 w-3.5 rounded-full"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <span className="min-w-0 truncate text-sm font-semibold text-police">
                          {entry.name}
                        </span>
                      </div>
                      <span className={`text-sm font-semibold ${isSelected ? 'text-maastricht' : 'text-maastricht/90'}`}>
                        {entry.value}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-police dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
                  No predictive data available for the selected range.
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-semibold text-maastricht dark:text-slate-100">
            Peak Hours
          </h2>

          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={(data.peakHours || []).map((x) => ({
                  hour: `${x.hour}:00`,
                  count: x.count,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#27496A" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-semibold text-maastricht dark:text-slate-100">Appointments by Day</h2>

          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.line || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#27496A" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-maastricht dark:text-slate-100">Status Distribution</h2>

          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.bar || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="statusLabel" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {(data.bar || []).map((entry, index) => (
                    <Cell
                      key={`status-cell-${index}`}
                      fill={STATUS_BAR_COLORS[entry.name] || '#5C8EB4'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── DIAGNOSTIC ANALYTICS ── */}
      {data.diagnostic && (
        <div className="mt-8">
          <h2 className="mb-2 text-xl font-bold text-maastricht dark:text-slate-100">Diagnostic Analytics</h2>
          <p className="mb-4 text-sm text-police dark:text-slate-300">
            Why did it happen? — Day-of-week breakdown and service correlation.
          </p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
              <h3 className="mb-4 text-lg font-semibold text-maastricht dark:text-slate-100">Appointments by Day of Week</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.diagnostic.dayOfWeekBreakdown || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#27496A" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
              <h3 className="mb-4 text-lg font-semibold text-maastricht dark:text-slate-100">Service × Day Correlation</h3>
              <div className="max-h-[280px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-police dark:border-slate-600 dark:text-slate-300">
                      <th className="pb-2 font-semibold">Service</th>
                      <th className="pb-2 font-semibold">Day</th>
                      <th className="pb-2 text-right font-semibold">Bookings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.diagnostic.serviceDowCorrelation || []).map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-700">
                        <td className="py-2 text-maastricht dark:text-slate-200">{item.service}</td>
                        <td className="py-2 text-police dark:text-slate-300">{item.day}</td>
                        <td className="py-2 text-right font-semibold text-maastricht dark:text-slate-200">{item.count}</td>
                      </tr>
                    ))}
                    {(!data.diagnostic.serviceDowCorrelation || data.diagnostic.serviceDowCorrelation.length === 0) && (
                      <tr>
                        <td colSpan="3" className="py-4 text-center text-police dark:text-slate-400">No data.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── REJECTION ANALYSIS ── */}
      {data.rejectionAnalysis && (
        <div className="mt-8">
          <h2 className="mb-2 text-xl font-bold text-maastricht dark:text-slate-100">Rejection &amp; Cancellation Analysis</h2>
          <p className="mb-4 text-sm text-police dark:text-slate-300">
            Which services have the most rejections or no-shows? — Identify problem areas.
          </p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
              <h3 className="mb-4 text-lg font-semibold text-maastricht dark:text-slate-100">Rejected by Service</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.rejectionAnalysis.rejectedByService || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="service" tick={false} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(value) => [value, "Rejected"]} />
                    <Bar dataKey="count" fill="#EF4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 max-h-[160px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-police dark:border-slate-600">
                      <th className="pb-2 font-semibold">Service</th>
                      <th className="pb-2 text-right font-semibold">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.rejectionAnalysis.rejectedByService || []).map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-700">
                        <td className="py-2 text-maastricht dark:text-slate-200">{item.service}</td>
                        <td className="py-2 text-right font-semibold text-red-600">{item.count}</td>
                      </tr>
                    ))}
                    {(!data.rejectionAnalysis.rejectedByService || data.rejectionAnalysis.rejectedByService.length === 0) && (
                      <tr>
                        <td colSpan="2" className="py-4 text-center text-police dark:text-slate-400">No rejections.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
              <h3 className="mb-4 text-lg font-semibold text-maastricht dark:text-slate-100">Not Completed by Service</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.rejectionAnalysis.notCompletedByService || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="service" tick={false} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(value) => [value, "Not Completed"]} />
                    <Bar dataKey="count" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 max-h-[160px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-police dark:border-slate-600">
                      <th className="pb-2 font-semibold">Service</th>
                      <th className="pb-2 text-right font-semibold">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.rejectionAnalysis.notCompletedByService || []).map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-700">
                        <td className="py-2 text-maastricht dark:text-slate-200">{item.service}</td>
                        <td className="py-2 text-right font-semibold text-amber-600">{item.count}</td>
                      </tr>
                    ))}
                    {(!data.rejectionAnalysis.notCompletedByService || data.rejectionAnalysis.notCompletedByService.length === 0) && (
                      <tr>
                        <td colSpan="2" className="py-4 text-center text-police dark:text-slate-400">All appointments completed.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STATUS TIMELINE ── */}
      {data.statusTimeline && data.statusTimeline.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-xl font-bold text-maastricht dark:text-slate-100">Status Timeline</h2>
          <p className="mb-4 text-sm text-police dark:text-slate-300">How appointments moved through statuses over time.</p>
          <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.statusTimeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="accepted" stackId="a" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="rejected" stackId="a" fill="#EF4444" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="completed" stackId="a" fill="#10B981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="notCompleted" stackId="a" fill="#F59E0B" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── WALK-IN VS ONLINE ── */}
      {data.walkInVsOnline && data.walkInVsOnline.total > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-xl font-bold text-maastricht dark:text-slate-100">Walk-in vs Online</h2>
          <p className="mb-4 text-sm text-police dark:text-slate-300">How patients are booking — walk-in vs online appointments.</p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
              <p className="text-sm font-medium text-police dark:text-slate-300">Walk-in</p>
              <p className="mt-2 text-3xl font-bold text-amber-600">{data.walkInVsOnline.walkIn}</p>
              <p className="mt-1 text-sm text-police dark:text-slate-300">{data.walkInVsOnline.walkInPercent}% of total</p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
              <p className="text-sm font-medium text-police dark:text-slate-300">Online</p>
              <p className="mt-2 text-3xl font-bold text-blue-600">{data.walkInVsOnline.online}</p>
              <p className="mt-1 text-sm text-police dark:text-slate-300">{data.walkInVsOnline.onlinePercent}% of total</p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
              <p className="text-sm font-medium text-police dark:text-slate-300">Total</p>
              <p className="mt-2 text-3xl font-bold text-maastricht dark:text-slate-100">{data.walkInVsOnline.total}</p>
              <p className="mt-1 text-sm text-police dark:text-slate-300">appointments in range</p>
            </div>
          </div>
        </div>
      )}

      {/* ── SERVICE POPULARITY TREND ── */}
      {data.serviceTrend && data.serviceTrend.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-xl font-bold text-maastricht dark:text-slate-100">Service Popularity Trend</h2>
          <p className="mb-4 text-sm text-police dark:text-slate-300">Month-over-month service demand changes (last 6 months).</p>
          <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
            <div className="max-h-[400px] overflow-y-auto space-y-6">
              {data.serviceTrend.slice(0, 6).map((svc, idx) => (
                <div key={idx}>
                  <h3 className="mb-2 text-sm font-semibold text-maastricht dark:text-slate-200">{svc.service}</h3>
                  <div className="h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={svc.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} domain={[0, 'auto']} width={30} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

        </>
      )}

    </AdminPageShell>
  );
}

export default DataAnalysis;
