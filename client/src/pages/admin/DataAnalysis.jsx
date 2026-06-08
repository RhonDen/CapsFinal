import axios from 'axios';
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
import { formatServiceLabel, formatStatusLabel, getLocalDateKey } from '../../utils/schedule.js';

const COLORS = ['#0C243D', '#27496A', '#5C8EB4', '#9AB7CD', '#C1D1DB'];
const ANALYSIS_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
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
  const [data, setData] = useState({ pie: [], line: [], bar: [] });

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
        } else {
          params = { type: 'monthly', month: selectedMonth, year: selectedYear };
        }

        const response = await axios.get('/api/admin/analytics', { params });

        setData({
          pie: (response.data.pie || []).map((item) => ({
            ...item,
            name: formatServiceLabel(item.name),
          })),
          line: response.data.line || [],
          bar: (response.data.bar || []).map((item) => ({
            ...item,
            statusLabel: formatStatusLabel(item.status),
          })),
        });
      } catch (error) {
        console.error('Analytics fetch error:', error);
      }
    };

    fetchAnalytics();
  }, [analysisType, selectedDate, selectedMonth, selectedYear]);

  return (
    <AdminPageShell
      title={`${analysisType === 'daily' ? 'Daily' : analysisType === 'weekly' ? 'Weekly' : 'Monthly'} Analysis`}
      description={
        analysisType === 'daily'
          ? `Analysis for ${selectedDate}: completed services, total appointments, and status distribution.`
          : analysisType === 'weekly'
          ? `Analysis for the week starting ${selectedDate}: daily breakdown of appointments and status distribution.`
          : `Analysis for ${MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.label} ${selectedYear}: daily breakdown of completed services and status distribution.`
      }
      icon={BarChart3}
    >
      <div className="mb-6 flex flex-wrap gap-3 rounded-[24px] bg-white p-5 shadow-sm dark:bg-slate-800">
        <div className="flex flex-wrap gap-3">
          {ANALYSIS_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setAnalysisType(type.value)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                analysisType === type.value
                  ? 'bg-maastricht text-white dark:bg-slate-600'
                  : 'bg-pearl text-maastricht dark:bg-slate-700 dark:text-slate-200 hover:dark:bg-slate-600'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {analysisType === 'daily' && (
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            max={today}
            className="rounded-xl border bg-white px-4 py-2 text-sm text-maastricht dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          />
        )}

        {analysisType === 'weekly' && (
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            max={today}
            className="rounded-xl border bg-white px-4 py-2 text-sm text-maastricht dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          />
        )}

        {analysisType === 'monthly' && (
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-semibold text-maastricht dark:text-slate-100">Most Completed Services</h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.pie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={88}
                  label
                >
                  {data.pie.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-semibold text-maastricht dark:text-slate-100">Appointments by Day</h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.line}>
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
              <BarChart data={data.bar}>
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
