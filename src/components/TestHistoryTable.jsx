import StatusBadge from './StatusBadge';

const MOCK = [
  { date: '21/05/26', athlete: 'Ramiro S.',  test: 'CMJ',        value: '38.2 cm',      status: 'warning' },
  { date: '21/05/26', athlete: 'Leandro M.', test: 'CMJ',        value: '44.1 cm',      status: 'safe'    },
  { date: '15/05/26', athlete: 'Tomás R.',   test: 'Sprint 10m', value: '1.68 s',       status: 'safe'    },
  { date: '15/05/26', athlete: 'Facundo B.', test: 'Yo-Yo IR1',  value: 'VO₂ 48.2',    status: 'warning' },
  { date: '10/05/26', athlete: 'Ramiro S.',  test: 'Drop Jump',  value: 'RSI 1.82',     status: 'warning' },
  { date: '10/05/26', athlete: 'Tomás R.',   test: 'Cooper',     value: 'VO₂ 52.1',    status: 'safe'    },
];

const HEADERS = ['Fecha', 'Atleta', 'Test', 'Resultado', 'Estado'];

export default function TestHistoryTable({ results }) {
  const rows = results ?? MOCK;
  if (!rows.length) return (
    <p className="text-sm text-slate-500 text-center py-6">Sin historial registrado.</p>
  );
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs min-w-[400px]">
        <thead>
          <tr className="border-b border-white/5">
            {HEADERS.map(h => (
              <th key={h} className={`pb-2 text-slate-500 font-semibold uppercase tracking-wider ${h === 'Estado' ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0">
              <td className="py-2 text-slate-500 font-data pr-3">{r.date}</td>
              <td className="py-2 text-slate-200 pr-3">{r.athlete}</td>
              <td className="py-2 text-slate-400 pr-3">{r.test}</td>
              <td className="py-2 text-slate-100 font-data font-bold pr-3">{r.value}</td>
              <td className="py-2 text-right"><StatusBadge status={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
