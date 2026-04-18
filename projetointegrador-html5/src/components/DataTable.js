import './DataTable.css';

export default function DataTable({ headers, rows, emptyText, small, children }) {
  return (
    <table className={`data-table ${small ? 'data-table-small' : ''}`}>
      <thead>
        <tr>
          {headers.map((h, i) => <th key={i}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {children}
        {rows !== undefined && rows.length === 0 && (
          <tr><td colSpan={headers.length} className="data-table-empty">{emptyText || 'Nenhum registro'}</td></tr>
        )}
      </tbody>
    </table>
  );
}
