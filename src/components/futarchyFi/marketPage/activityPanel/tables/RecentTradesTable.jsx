import React from 'react';

const RecentTradesTable = ({ data }) => {
  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      <div className="inline-block min-w-full align-middle">
        {/* Desktop Table */}
        <table className="hidden sm:table min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              {[
                'Time',
                'Pair',
                'Side',
                'Price',
                'Amount',
                'Total'
              ].map((header) => (
                <th key={header} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm text-black">{row.time}</td>
                <td className="px-4 py-2 text-sm text-black">{row.pair}</td>
                <td className="px-4 py-2 text-sm">
                  <span className={row.side === 'Sell' ? 'text-futarchyRedNo' : 'text-futarchyGreenYes'}>
                    {row.side}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-black">{row.price}</td>
                <td className="px-4 py-2 text-sm text-black">{row.amount}</td>
                <td className="px-4 py-2 text-sm text-black">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile Card Layout */}
        <div className="sm:hidden divide-y divide-gray-200">
          {data.map((row) => (
            <div key={row.id} className="p-4 space-y-3">
              {/* Header with Time and Pair */}
              <div className="flex items-center justify-between">
                <span className="font-medium text-black">{row.pair}</span>
                <span className="text-sm text-black">{row.time}</span>
              </div>

              {/* Main Info Grid */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-black font-medium">Side</div>
                  <div className={row.side === 'Sell' ? 'text-futarchyRedNo' : 'text-futarchyGreenYes'}>
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
                  <div className="text-black font-medium">Total</div>
                  <div className="text-black">{row.total}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecentTradesTable; 