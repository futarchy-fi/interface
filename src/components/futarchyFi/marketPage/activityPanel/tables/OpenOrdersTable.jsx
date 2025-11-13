import React from 'react';

const OpenOrdersTable = ({ data, renderStatusIcon, onRetry, ...props }) => {
  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden">
          {/* Mobile Card Layout */}
          <div className="sm:hidden divide-y divide-gray-200">
            {data.map((row) => (
              <div 
                key={row.id}
                className={`
                  p-4 space-y-3
                  ${row.status === 'failed' ? 'bg-futarchyRedNo/5' : ''}
                `}
              >
                {/* Header with Status and Pair */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {renderStatusIcon(row.status)}
                    <span className="font-medium">{row.pair}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.status === 'failed' && (
                      <button
                        onClick={() => onRetry('order', row)}
                        className="px-2 py-1 text-xs rounded bg-futarchyPurple text-white"
                      >
                        Retry
                      </button>
                    )}
                    <button
                      onClick={() => props.onActionClick('cancel', row)}
                      className="px-3 py-1 text-xs rounded bg-black text-white"
                      disabled={row.status === 'pending'}
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {/* Main Info Grid - without Cancel button */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-black font-medium">Date</div>
                    <div className="text-black">{row.date}</div>
                  </div>
                  <div>
                    <div className="text-black font-medium">Type</div>
                    <div className="text-black">{row.type}</div>
                  </div>
                  <div>
                    <div className="text-black font-medium">Side</div>
                    <div className={`${row.side === 'Sell' ? 'text-futarchyRedNo' : 'text-futarchyGreenYes'} font-medium`}>
                      {row.side}
                    </div>
                  </div>
                  <div>
                    <div className="text-black font-medium">Price</div>
                    <div className="text-black">{row.price}</div>
                  </div>
                  <div>
                    <div className="text-black font-medium">Amount</div>
                    <div className="text-black">{row.amount}</div>
                  </div>
                  <div>
                    <div className="text-black font-medium">Filled</div>
                    <div className="text-black">{row.filled}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <table className="hidden sm:table min-w-full divide-y divide-gray-200">
            <thead className="hidden sm:table-header-group">
              <tr>
                {[
                  'Status',
                  'Date',
                  'Pair',
                  'Type',
                  'Side',
                  'Price',
                  'Amount',
                  'Filled',
                  'Total',
                  'Cancel'
                ].map((header) => (
                  <th key={header} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((row) => (
                <tr
                  key={row.id}
                  className={`
                    flex flex-col sm:table-row
                    hover:bg-gray-50 
                    ${row.status === 'pending' ? 'bg-gray-50/50' : ''}
                    ${row.status === 'failed' ? 'bg-futarchyRedNo/5' : ''}
                    ${props.selectedRow?.id === row.id ? 'bg-gray-50' : ''}
                  `}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center">
                      {renderStatusIcon(row.status)}
                    </div>
                  </td>
                  {['date', 'pair', 'type', 'side', 'price', 'amount', 'filled', 'total'].map((field) => (
                    <td 
                      key={field}
                      className={`hidden sm:table-cell px-4 py-2 text-sm text-black ${row.status === 'pending' ? 'processing-column' : ''}`}
                    >
                      {field === 'side' ? (
                        <span className={row[field] === 'Sell' ? 'text-futarchyRedNo' : 'text-futarchyGreenYes'}>
                          {row[field]}
                        </span>
                      ) : (
                        row[field]
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      {row.status === 'failed' && (
                        <button
                          onClick={() => onRetry('order', row)}
                          className="px-2 py-1 text-xs rounded bg-futarchyPurple text-white"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        onClick={() => props.onActionClick('cancel', row)}
                        className="px-3 py-1 text-xs rounded bg-black text-white"
                        disabled={row.status === 'pending'}
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OpenOrdersTable; 