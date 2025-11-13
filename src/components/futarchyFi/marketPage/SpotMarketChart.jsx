import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

import React, { useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { SeededRandom } from '../../../utils/seededRandom';

const SpotMarketChart = ({ marketSeed = 12345 }) => {
  const [hoverData, setHoverData] = useState(null);
  const chartRef = useRef(null);
  const rng = new SeededRandom(marketSeed);

  const generateChartData = (basePrice, volatility, trend) => {
    const data = [];
    const dates = [];
    let price = basePrice;
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toLocaleDateString());
      
      const random = rng.random() * 2 - 1;
      price = price * (1 + (random * volatility) + trend);
      data.push(price.toFixed(2));
    }
    
    return { dates, data };
  };

  const chartData = {
    labels: generateChartData(100, 0.02, 0.001).dates,
    datasets: [
      {
        label: 'FAO',
        data: generateChartData(100, 0.02, 0.001).data,
        borderColor: '#7EDCE4',
        backgroundColor: 'rgba(126, 220, 228, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'FAO_YES',
        data: generateChartData(110, 0.015, 0.002).data,
        borderColor: '#C3FF55',
        backgroundColor: 'rgba(195, 255, 85, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'FAO_NO',
        data: generateChartData(90, 0.025, -0.001).data,
        borderColor: '#F65A0E',
        backgroundColor: 'rgba(246, 90, 14, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  const options = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        grid: {
          display: false
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top'
      }
    }
  };

  return (
    <div className="relative">
      <Line data={chartData} options={options} ref={chartRef} />
    </div>
  );
};

export default SpotMarketChart; 