import React from 'react';

interface Column<T> {
  header: string;
  accessor: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  title: string;
  data: T[];
  columns: Column<T>[];
}

const DataTable = <T,>({ title, data, columns }: DataTableProps<T>) => {
  return (
    <div className="w-full bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden shadow-sm dark:shadow-none">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700/50">
        <h3 className="text-slate-700 dark:text-slate-300 font-medium text-sm">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/80">
            <tr>
              {columns.map((col, idx) => (
                <th 
                  key={idx} 
                  className={`px-4 py-3 text-slate-500 dark:text-slate-400 font-medium text-${col.align || 'left'}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
            {data.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                {columns.map((col, cIdx) => (
                  <td 
                    key={cIdx} 
                    className={`px-4 py-3 text-slate-700 dark:text-slate-200 text-${col.align || 'left'}`}
                  >
                    {col.accessor(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;