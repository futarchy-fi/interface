import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';

const ProbabilityChart = ({ marketSeed = 12345 }) => {
  const [hoverData, setHoverData] = useState(null);

  // Generate mock probability data
  const generateProbabilityData = () => {
    const labels = [];
    const yesData = [];
    
    let yes = 0.5; // Start at 50%
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString());
      
      // Random walk for probability
      yes += (Math.random() - 0.5) * 0.05;
      yes = Math.min(Math.max(yes, 0.1), 0.9);
      
      yesData.push(yes);
    }
    
    return { labels, yesData };
  };

  const { labels, yesData } = generateProbabilityData();

  const data = {
    labels,
    datasets: [
      {
        label: 'Yes Probability',
        data: yesData,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ],
  };

  const options = {
    responsive: true,
    scales: {
      y: {
        min: 0,
        max: 1,
        ticks: {
          callback: (value) => `${(value * 100).toFixed(0)}%`,
        },
        grid: {
          display: false,
        }
      },
      x: {
        grid: {
          display: false,
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => `Probability: ${(context.raw * 100).toFixed(1)}%`,
        },
      },
      legend: {
        display: false,
      }
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Market Probability</h3>
        <div className="text-sm text-gray-500">
          Current: {(yesData[yesData.length - 1] * 100).toFixed(1)}%
        </div>
      </div>
      <Line data={data} options={options} />
    </div>
  );
};

export default ProbabilityChart; 