import React from 'react';

const OpenPositionsTable = ({ selectedRow, setSelectedRow, onActionClick, data, renderStatusIcon, onRetry }) => {
  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      <div className="inline-block min-w-full align-middle">
        {/* Desktop Table Header */}
        <table className="hidden sm:table min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              {[
                { id: 'status', width: 'w-[80px]' },
                { id: 'market', width: 'w-[100px]' },
                { id: 'size', width: 'w-[120px]' },
                { id: 'positionValue', width: 'w-[120px]', label: 'Position Value' },
                { id: 'entryPrice', width: 'w-[120px]', label: 'Entry Price' },
                { id: 'pnl', width: 'w-[140px]', label: 'PNL (ROE %)' },
                { id: 'liquidation', width: 'w-[120px]' },
                { id: 'margin', width: 'w-[100px]' },
                { id: 'funding', width: 'w-[100px]' },
                { id: 'close', width: 'w-[160px]' }
              ].map((col) => (
                <th 
                  key={col.id} 
                  className={`px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.width}`}
                >
                  {col.label || col.id}
                </th>
              ))}
            </tr>
          </thead>
        </table>

        {/* Mobile Card Layout */}
        <div className="sm:hidden divide-y divide-gray-200">
          {data.map((row) => (
            <div 
              key={row.id}
              className={`
                p-4 space-y-3
                ${row.status === 'failed' ? 'bg-futarchyRedNo/5' : ''}
                ${selectedRow?.id === row.id ? 'bg-gray-50' : ''}
              `}
            >
              {/* Header with Status and Market */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderStatusIcon(row.status)}
                  <span className="font-medium">{row.market}</span>
                </div>
                <div className="flex items-center gap-2">
                  {row.status === 'failed' && (
                    <button
                      onClick={() => onRetry('position', row)}
                      className="px-2 py-1 text-xs rounded bg-futarchyPurple text-white"
                    >
                      Retry
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => onActionClick('limit', row)}
                      className="px-3 py-1 text-xs rounded bg-black text-white hover:bg-gray-800"
                      disabled={row.status === 'pending'}
                    >
                      Limit
                    </button>
                    <button
                      onClick={() => onActionClick('market', row)}
                      className="px-3 py-1 text-xs rounded bg-black text-white hover:bg-gray-800"
                      disabled={row.status === 'pending'}
                    >
                      Market
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-black font-medium">Size</div>
                  <div className="text-black">{row.size}</div>
                </div>
                <div>
                  <div className="text-black font-medium">Position Value</div>
                  <div className="text-black">{row.positionValue}</div>
                </div>
                <div>
                  <div className="text-black font-medium">Entry Price</div>
                  <div className="text-black">{row.entryPrice}</div>
                </div>
                <div>
                  <div className="text-black font-medium">PNL (ROE %)</div>
                  <div className={row.pnl.isPositive ? 'text-futarchyGreenYes font-medium' : 'text-futarchyRedNo font-medium'}>
                    {row.pnl.value} ({row.pnl.percentage})
                  </div>
                </div>
                <div>
                  <div className="text-black font-medium">Liquidation</div>
                  <div className="text-futarchyRedNo font-medium">{row.liquidation}</div>
                </div>
                <div>
                  <div className="text-black font-medium">Margin</div>
                  <div className="text-black">{row.margin}</div>
                </div>
              </div>

              {/* Action Buttons */}
              {(row.status === 'confirmed' || !row.status) && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => onActionClick('limit', row)}
                    className="flex-1 px-3 py-2 text-xs rounded bg-black text-white"
                  >
                    Limit
                  </button>
                  <button
                    onClick={() => onActionClick('market', row)}
                    className="flex-1 px-3 py-2 text-xs rounded bg-black text-white"
                  >
                    Market
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop Table Body */}
        <table className="hidden sm:table min-w-full divide-y divide-gray-200">
          <tbody className="divide-y divide-gray-200">
            {data.map((row) => (
              <tr
                key={row.id}
                className={`
                  hover:bg-gray-50 
                  ${row.status === 'failed' ? 'bg-futarchyRedNo/5' : ''}
                  ${selectedRow?.id === row.id ? 'bg-gray-50' : ''}
                `}
              >
                <td className="w-[80px] px-4 py-2">
                  {renderStatusIcon(row.status)}
                </td>
                {['market', 'size', 'positionValue', 'entryPrice', 'pnl', 'liquidation', 'margin', 'funding'].map((field) => (
                  <td 
                    key={field}
                    className={`px-4 py-2 text-sm text-black ${row.status === 'pending' ? 'processing-column' : ''}`}
                  >
                    {field === 'pnl' ? (
                      <span className={row.pnl.isPositive ? 'text-futarchyGreenYes' : 'text-futarchyRedNo'}>
                        {row.pnl.value} ({row.pnl.percentage})
                      </span>
                    ) : (
                      row[field]
                    )}
                  </td>
                ))}
                <td className="w-[160px] px-4 py-2">
                  <div className="flex gap-2">
                    {row.status === 'failed' ? (
                      <button
                        onClick={() => onRetry('position', row)}
                        className="px-2 py-1 text-xs rounded bg-futarchyPurple text-white"
                      >
                        Retry
                      </button>
                    ) : (!row.status || row.status === 'confirmed') && (
                      <>
                        <button
                          onClick={() => onActionClick('limit', row)}
                          className="px-3 py-1 text-xs rounded bg-black text-white hover:bg-gray-800"
                        >
                          Limit
                        </button>
                        <button
                          onClick={() => onActionClick('market', row)}
                          className="px-3 py-1 text-xs rounded bg-black text-white hover:bg-gray-800"
                        >
                          Market
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OpenPositionsTable; 