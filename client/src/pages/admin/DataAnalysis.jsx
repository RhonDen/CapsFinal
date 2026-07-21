import api from '../../api.js';
import { BarChart3 } from 'lucide-react';
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

const COLORS = ['#0C243D', '#27496A', '#5C8EB4', '#9AB7CD', '#C1D1DB'];

const ANALYSIS_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
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
  });

  const [selectedPredictiveService, setSelectedPredictiveService] = useState('');

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, index) => currentYear - 4 + index);
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        let params = {};

        if (analysisType === 'daily') {
          params = { type: 'daily', date: selectedDate };
        } else if (analysisType === 'weekly') {
          params = { type: 'weekly', date: selectedDate };
        } else if (analysisType === 'predictive') {
          params = { type: 'predictive', month: selectedMonth, year: selectedYear };
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
                // Keep only what Recharts needs; avoid leaking unexpected keys
                name: formatServiceLabel(String(rawName)),
                value: Number.isFinite(valueNum) ? valueNum : 0,
              };
            })
            .filter((x) => x.name);
        };

        const normalizedPredictivePie = normalizePie(
          response.data.predictivePie || response.data.pie
        );

        setData({
          pie: normalizePie(response.data.pie),
          predictivePie: normalizedPredictivePie,
          line: response.data.line || [],
          bar: (response.data.bar || []).map((item) => ({
            ...item,
            statusLabel: formatStatusLabel(item.status),
          })),
          peakHours: Array.isArray(response.data.peakHours) ? response.data.peakHours : [],
        });

        // Reset predictive selection when range changes
        if (analysisType === 'predictive') {
          setSelectedPredictiveService((prev) => {
            const stillExists = normalizedPredictivePie.some((x) => x.name === prev);
            if (stillExists) return prev;
            return normalizedPredictivePie[0]?.name || '';
          });
        } else {
          setSelectedPredictiveService('');
        }
      } catch (error) {
        console.error('Analytics fetch error:', error);
      }
    };

    fetchAnalytics();
  }, [analysisType, selectedDate, selectedMonth, selectedYear]);

  const title = useMemo(() => {
    if (analysisType === 'daily') return 'Daily Analysis';
    if (analysisType === 'weekly') return 'Weekly Analysis';
    if (analysisType === 'predictive') return 'Predictive (Next Month) Analysis';
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-6">
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-semibold text-maastricht dark:text-slate-100">
            {analysisType === 'predictive'
              ? 'Predicted Most Appointments Service (Next Month)'
              : 'Most Completed Services'}
          </h2>

          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analysisType === 'predictive' ? data.predictivePie : data.pie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={88}
                  // Prevent chart/text overlap; we’ll rely on tooltip instead.
                  label={false}
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
                {analysisType !== 'predictive' ? <Legend /> : null}
              </PieChart>
            </ResponsiveContainer>
          </div>

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
                <XAxis dataKey="day" />
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
                <Bar dataKey="count" fill="#5C8EB4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}

export default DataAnalysis;
