'use client';

import React from 'react';
import headToHead from '../data/head_to_head.json';
import teamPoints from '../data/team_points.json';
import teamStatistics from '../data/team_statistics.json';

// --- Types ---
type HeadToHeadRecord = {
  category: string;
  records: {
    record: string;
    recordHolders: string[] | string;
    value: number;
    season?: number;
  }[];
};

type TeamPointsRecord = {
  category: string;
  records: Array<{
    record: string;
    recordHolder: string | string[];
    points: number;
    average?: number;
    value?: number;
  }>;
};

type TeamStatisticsRecord = {
  category: string;
  records: {
    value: any;
    record: string;
    recordHolders: string[] | string;
    touchdowns?: number;
    yards?: number;
    fieldGoals?: number;
    average?: number;
  }[];
};

function renderRecordHolders(holder: string | string[]) {
  if (Array.isArray(holder)) {
    return (
      <div className="flex flex-col gap-0.5">
        {holder.map((h, i) => (
          <div key={i} className="truncate">{h}</div>
        ))}
      </div>
    );
  }
  return <span className="truncate">{holder}</span>;
}

const TABS = [
  { key: 'head', label: 'Head-to-Head' },
  { key: 'points', label: 'Team Points' },
  { key: 'stats', label: 'Team Statistics' },
];

// Table headers and colgroup for each tab
const TABLE_HEADERS = {
  head: [
    { label: 'Record', className: 'w-[34%] min-w-[120px] max-w-[180px]' },
    { label: 'Holder(s)', className: 'w-[42%] min-w-[200px] max-w-[420px]' },
    { label: 'Value', className: 'w-[12%] min-w-[70px] max-w-[100px]' },
    { label: 'Average/Season', className: 'w-[12%] min-w-[70px] max-w-[100px]' },
  ],
  points: [
    { label: 'Record', className: 'w-[38%] min-w-[120px] max-w-[180px]' },
    { label: 'Holder(s)', className: 'w-[50%] min-w-[200px] max-w-[420px]' },
    { label: 'Value/Points', className: 'w-[12%] min-w-[70px] max-w-[100px]' },
    { label: 'Average', className: 'hidden' }, // for alignment, not rendered
  ],
  stats: [
    { label: 'Record', className: 'w-[38%] min-w-[120px] max-w-[180px]' },
    { label: 'Holder(s)', className: 'w-[50%] min-w-[200px] max-w-[420px]' },
    { label: 'Value', className: 'w-[12%] min-w-[70px] max-w-[100px]' },
    { label: 'Average', className: 'hidden' }, // for alignment, not rendered
  ],
};

function TableColGroup({ tab }: { tab: 'head' | 'points' | 'stats' }) {
  if (tab === 'head') {
    return (
      <colgroup>
        <col style={{ width: '34%', minWidth: 120, maxWidth: 180 }} />
        <col style={{ width: '42%', minWidth: 200, maxWidth: 420 }} />
        <col style={{ width: '12%', minWidth: 70, maxWidth: 100 }} />
        <col style={{ width: '12%', minWidth: 70, maxWidth: 100 }} />
      </colgroup>
    );
  }
  // points and stats
  return (
    <colgroup>
      <col style={{ width: '38%', minWidth: 120, maxWidth: 180 }} />
      <col style={{ width: '50%', minWidth: 200, maxWidth: 420 }} />
      <col style={{ width: '12%', minWidth: 70, maxWidth: 100 }} />
    </colgroup>
  );
}

export default function RecordBookPage() {
  const [tab, setTab] = React.useState<'head' | 'points' | 'stats'>('head');

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 bg-[#0f0f0f] min-h-screen">
      <h1 className="text-4xl sm:text-5xl font-extrabold text-center text-emerald-200 mb-10 drop-shadow">
        📖 Bok Choy League Record Book
      </h1>

      {/* Tabs */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex rounded-lg shadow bg-[#232323] border border-emerald-900 overflow-hidden">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              className={`px-6 py-2 font-semibold transition-colors text-base sm:text-lg ${
                tab === key
                  ? 'bg-emerald-700 text-white'
                  : 'bg-[#232323] text-emerald-200 hover:bg-emerald-900'
              }`}
              onClick={() => setTab(key as any)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-16">
        {/* Head-to-Head Records */}
        {tab === 'head' && (
          <section>
            <h2 className="text-2xl font-bold text-emerald-300 mb-6">Head-to-Head Records</h2>
            {headToHead.map((cat: HeadToHeadRecord) => {
              if (!cat.records || cat.records.length === 0) return null;
              return (
                <div key={cat.category} className="mb-12">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-2">{cat.category}</h3>
                  <div className="overflow-x-auto rounded-lg shadow">
                    <table className="min-w-full bg-[#181f1b] border border-emerald-900 table-fixed">
                      <TableColGroup tab="head" />
                      <thead className="bg-emerald-900">
                        <tr>
                          {TABLE_HEADERS.head.map((h) => (
                            <th
                              key={h.label}
                              className={`px-4 py-2 text-left text-emerald-200 font-semibold ${h.className}`}
                            >
                              {h.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cat.records.map((rec, idx) => (
                          <tr key={idx} className="border-t border-emerald-900 hover:bg-emerald-950">
                            <td className="px-4 py-2 font-medium text-emerald-100 truncate">{rec.record}</td>
                            <td className="px-4 py-2 text-emerald-200 truncate">{renderRecordHolders(rec.recordHolders)}</td>
                            <td className="px-4 py-2 text-emerald-100 text-center truncate">{rec.value ?? '-'}</td>
                            <td className="px-4 py-2 text-emerald-400 text-center truncate">{rec.season ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Team Points Records */}
        {tab === 'points' && (
          <section>
            <h2 className="text-2xl font-bold text-emerald-300 mb-6">Team Points Records</h2>
            {teamPoints.map((cat: TeamPointsRecord) => {
              if (!cat.records || cat.records.length === 0) return null;
              return (
                <div key={cat.category} className="mb-12">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-2">{cat.category}</h3>
                  <div className="overflow-x-auto rounded-lg shadow">
                    <table className="min-w-full bg-[#181f1b] border border-emerald-900 table-fixed">
                      <TableColGroup tab="points" />
                      <thead className="bg-emerald-900">
                        <tr>
                          {TABLE_HEADERS.points.slice(0, 3).map((h) => (
                            <th
                              key={h.label}
                              className={`px-4 py-2 text-left text-emerald-200 font-semibold ${h.className}`}
                            >
                              {h.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cat.records.map((rec, idx) => (
                          <tr key={idx} className="border-t border-emerald-900 hover:bg-emerald-950">
                            <td className="px-4 py-2 font-medium text-emerald-100 truncate">{rec.record}</td>
                            <td className="px-4 py-2 text-emerald-200 truncate">{renderRecordHolders(rec.recordHolder)}</td>
                            <td className="px-4 py-2 text-emerald-100 text-center truncate">
                              {rec.points ?? rec.value ?? '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Team Statistics Records */}
        {tab === 'stats' && (
          <section>
            <h2 className="text-2xl font-bold text-emerald-300 mb-6">Team Statistics Records</h2>
            {teamStatistics.map((cat) => {
                          if (!cat.records || cat.records.length === 0) return null;
                          return (
                            <div key={cat.category} className="mb-12">
                              <h3 className="text-lg font-semibold text-emerald-400 mb-2">{cat.category}</h3>
                              <div className="overflow-x-auto rounded-lg shadow">
                                <table className="min-w-full bg-[#181f1b] border border-emerald-900 table-fixed">
                                  <TableColGroup tab="stats" />
                                  <thead className="bg-emerald-900">
                                    <tr>
                                      {TABLE_HEADERS.stats.slice(0, 3).map((h) => (
                                        <th
                                          key={h.label}
                                          className={`px-4 py-2 text-left text-emerald-200 font-semibold ${h.className}`}
                                        >
                                          {h.label}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {cat.records.map((rec, idx) => {
                                      const value =
                                        (rec as any).touchdowns ??
                                        (rec as any).yards ??
                                        (rec as any).fieldGoals ??
                                        (rec as any).value ??
                                        '-';
                                      return (
                                        <tr key={idx} className="border-t border-emerald-900 hover:bg-emerald-950">
                                          <td className="px-4 py-2 font-medium text-emerald-100 truncate">{rec.record}</td>
                                          <td className="px-4 py-2 text-emerald-200 truncate">{renderRecordHolders((rec as any).recordHolders)}</td>
                                          <td className="px-4 py-2 text-emerald-100 text-center truncate">{value}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
          </section>
        )}
      </div>
    </div>
  );
}
