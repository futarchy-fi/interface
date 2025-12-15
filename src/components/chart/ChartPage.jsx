import { useState, useEffect } from 'react';
import TripleChart from './TripleChart';

// Make candle URLs optional and env-driven; if missing, skip fetching
const API_BASE = process.env.NEXT_PUBLIC_POOL_API_URL || null;
const makeCandleUrl = (poolId) => API_BASE ? `${API_BASE}/v4/candles?pool_id=${poolId}&interval=3600000` : null;
const YES_POOL_URL = makeCandleUrl('0x9a14d28909f42823Ee29847F87A15Fb3b6E8AEd3');
const NO_POOL_URL = makeCandleUrl('0x6E33153115Ab58dab0e0F1E3a2ccda6e67FA5cD7');
const BASE_POOL_URL = makeCandleUrl('0x88A8ABD96A2e7ceF3B15cB42c11BE862312BA5Da');

const ChartPage = () => {
  const [yesData, setYesData] = useState([]);
  const [noData, setNoData] = useState([]);
  const [baseData, setBaseData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!YES_POOL_URL || !NO_POOL_URL || !BASE_POOL_URL) {
          throw new Error('Candle API base URL not configured');
        }

        const [yesResponse, noResponse, baseResponse] = await Promise.all([
          fetch(YES_POOL_URL),
          fetch(NO_POOL_URL),
          fetch(BASE_POOL_URL)
        ]);

        const [yesJson, noJson, baseJson] = await Promise.all([
          yesResponse.json(),
          noResponse.json(),
          baseResponse.json()
        ]);

        setYesData(yesJson.candles.map(candle => ({
          time: candle.timestamp,
          value: candle.average_price
        })));

        setNoData(noJson.candles.map(candle => ({
          time: candle.timestamp,
          value: candle.average_price
        })));

        setBaseData(baseJson.candles.map(candle => ({
          time: candle.timestamp,
          value: candle.average_price
        })));

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up polling every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white">Loading chart data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-red-500">Error loading chart data: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">Pool Price Charts</h1>
        <div className="bg-gray-800 rounded-lg p-6">
          <TripleChart
            yesData={yesData}
            noData={noData}
            baseData={baseData}
            width={1000}
            height={420}
          />
        </div>
      </div>
    </div>
  );
};

export default ChartPage; 