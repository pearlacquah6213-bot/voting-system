import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../ui/card';
import { SafeImage } from '../ui/SafeImage';
import type { AdminOverviewData } from '../../types';
import { formatDateTime } from '../../lib/utils';

interface AdminOverviewProps {
  data: AdminOverviewData;
}

export function AdminOverview({ data }: AdminOverviewProps) {
  const {
    kpis,
    votingActivity,
    votesPerCategory,
    regionalTurnout,
    topNominees,
    recentVotes,
    recentAudits,
  } = data;

  const kpiCards = [
    { label: 'Total Awards', value: String(kpis.totalAwards) },
    { label: 'Active Awards', value: String(kpis.activeAwards) },
    { label: 'Total Categories', value: String(kpis.totalCategories) },
    { label: 'Total Nominees', value: String(kpis.totalNominees) },
    { label: 'Pending Nominations', value: String(kpis.pendingNominationsCount ?? 0) },
    { label: 'Total Votes', value: String(kpis.totalVotes), accent: true },
    { label: 'Total Voters', value: String(kpis.totalVoters) },
    { label: 'MoMo Revenue', value: `GHS ${(kpis.momoRevenueGhs ?? 0).toLocaleString()}`, accent: true },
    { label: 'Active Categories', value: String(kpis.activeVotingCategories) },
    { label: 'Published Results', value: String(kpis.publishedResults) },
  ];

  return (
    <div className="space-y-8">
      {/* Live KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {kpiCards.map((item) => (
          <Card key={item.label} className="p-5 bg-white">
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p
              className={`font-mono text-2xl font-semibold tabular-nums mt-2 ${
                item.accent ? 'text-[#9F7915]' : 'text-[#0B192C]'
              }`}
            >
              {item.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 bg-white">
          <h2 className="font-serif text-lg font-semibold text-[#0B192C] mb-1">
            Voting Activity Trend
          </h2>
          <p className="text-xs text-slate-500 mb-5">Daily verified ballots & MoMo votes</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={votingActivity} margin={{ top: 5, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="votes"
                  stroke="#0B192C"
                  fill="#C59B27"
                  fillOpacity={0.22}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 bg-white">
          <h2 className="font-serif text-lg font-semibold text-[#0B192C] mb-1">
            Votes per Category
          </h2>
          <p className="text-xs text-slate-500 mb-5">Distribution across award disciplines</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={votesPerCategory} margin={{ top: 5, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Bar dataKey="votes" fill="#0B192C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 bg-white">
          <h2 className="font-serif text-lg font-semibold text-[#0B192C] mb-1">
            Regional Turnout Across Ghana
          </h2>
          <p className="text-xs text-slate-500 mb-5">Verified votes by Ghanaian region</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={regionalTurnout || []}
                layout="vertical"
                margin={{ top: 5, right: 16, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis
                  type="category"
                  dataKey="region"
                  width={95}
                  tick={{ fontSize: 10, fill: '#0B192C' }}
                />
                <Tooltip />
                <Bar dataKey="votes" fill="#C59B27" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top Nominees & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5 p-6 bg-white">
          <h2 className="font-serif text-lg font-semibold text-[#0B192C] mb-4">
            Top-Performing Nominees
          </h2>
          <div className="divide-y divide-slate-100">
            {topNominees.map((nom) => (
              <div key={nom.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-md overflow-hidden bg-slate-100 shrink-0">
                    <SafeImage
                      src={nom.photoUrl}
                      alt={nom.fullName}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0B192C] truncate">{nom.fullName}</p>
                    <p className="text-xs text-slate-500 truncate">{nom.categoryName}</p>
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-[#9F7915] tabular-nums shrink-0">
                  {nom.votes} votes
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-7 p-6 bg-white">
          <h2 className="font-serif text-lg font-semibold text-[#0B192C] mb-4">
            Recent Verified Ballots
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2 font-semibold">Receipt</th>
                  <th className="pb-2 font-semibold">Nominee</th>
                  <th className="pb-2 font-semibold">Category</th>
                  <th className="pb-2 font-semibold">Voter ID</th>
                  <th className="pb-2 font-semibold text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentVotes.map((v) => (
                  <tr key={v.id} className="h-10">
                    <td className="font-mono text-[#0B192C] pr-3">{v.receiptCode}</td>
                    <td className="font-medium text-slate-800 pr-3">{v.nomineeName}</td>
                    <td className="text-slate-600 pr-3 max-w-[160px] truncate">{v.categoryName}</td>
                    <td className="font-mono text-slate-500 pr-3">{v.voterCode}</td>
                    <td className="text-slate-500 text-right tabular-nums whitespace-nowrap">
                      {formatDateTime(v.castAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Recent Admin Audit Activities */}
      <Card className="p-6 bg-white">
        <h2 className="font-serif text-lg font-semibold text-[#0B192C] mb-4">
          Recent Administrator Activities
        </h2>
        <div className="divide-y divide-slate-100 text-xs">
          {recentAudits.slice(0, 8).map((log) => (
            <div key={log.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-[#0B192C]">{log.action}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">{log.entityType}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-700 font-medium">{log.adminEmail}</span>
              </div>
              <span className="text-slate-400 tabular-nums">{formatDateTime(log.createdAt)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
