import React, { useEffect, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
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
import gsap from 'gsap';

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

// Using the same seeded random as SwapPage
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }

  random() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }
}

// Move MetricBox component definition before MarketCharts
const MetricBox = ({ label, value, color, prefix = "$", icon }) => {
  const boxRef = useRef();

  useEffect(() => {
    const box = boxRef.current;
    
    const handleHover = () => {
      gsap.to(box, {
        scale: 1.02,
        duration: 0.3,
        ease: "power2.out",
      });
    };

    const handleHoverExit = () => {
      gsap.to(box, {
        scale: 1,
        duration: 0.3,
        ease: "power2.out",
      });
    };

    box.addEventListener("mouseenter", handleHover);
    box.addEventListener("mouseleave", handleHoverExit);

    return () => {
      box.removeEventListener("mouseenter", handleHover);
      box.removeEventListener("mouseleave", handleHoverExit);
    };
  }, []);

  return (
    <div 
      ref={boxRef}
      className="bg-white/5 backdrop-blur-sm rounded-lg p-4 transition-all duration-300 hover:bg-white/10"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <h3 className="text-sm text-gray-400">{label}</h3>
      </div>
      <p className={`text-2xl font-semibold ${color}`}>
        {prefix}{typeof value === 'number' ? value.toFixed(2) : value}
      </p>
    </div>
  );
};

const MarketCharts = ({ marketSeed = 12345 }) => {
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
        label: 'Index Token',
        data: generateChartData(100, 0.02, 0.001).data,
        borderColor: '#7EDCE4',
        backgroundColor: 'rgba(126, 220, 228, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Pass Token',
        data: generateChartData(110, 0.015, 0.002).data,
        borderColor: '#C3FF55',
        backgroundColor: 'rgba(195, 255, 85, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Fail Token',
        data: generateChartData(90, 0.025, -0.001).data,
        borderColor: '#F65A0E',
        backgroundColor: 'rgba(246, 90, 14, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  // Get latest prices from the chart data
  const indexPrice = parseFloat(chartData.datasets[0].data.slice(-1)[0]);
  const passPrice = parseFloat(chartData.datasets[1].data.slice(-1)[0]);
  const failPrice = parseFloat(chartData.datasets[2].data.slice(-1)[0]);

  // Calculate impact
  const impact = ((passPrice - failPrice) / indexPrice * 100).toFixed(2);
  const impactColor = impact > 0 ? 'text-futarchyGreen' : 'text-futarchyOrangeLight';

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
      tooltip: {
        enabled: false,
        mode: 'index',
        intersect: false,
        external: ({ chart, tooltip }) => {
          if (!tooltip?.opacity) {
            setHoverData(null);
            return;
          }

          const dataIndex = tooltip.dataPoints[0].dataIndex;
          const passPrice = chartData.datasets[1].data[dataIndex];
          const failPrice = chartData.datasets[2].data[dataIndex];
          const indexPrice = chartData.datasets[0].data[dataIndex];
          const impact = ((passPrice - failPrice) / indexPrice * 100).toFixed(2);

          // Add vertical line
          const ctx = chart.ctx;
          const x = tooltip.caretX;
          const topY = chart.scales.y.top;
          const bottomY = chart.scales.y.bottom;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x, topY);
          ctx.lineTo(x, bottomY);
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.stroke();
          ctx.restore();

          setHoverData({
            date: chartData.labels[dataIndex],
            index: indexPrice,
            pass: passPrice,
            fail: failPrice,
            impact,
            x, // Store x position for impact indicator
            passY: chart.scales.y.getPixelForValue(passPrice),
            failY: chart.scales.y.getPixelForValue(failPrice),
          });
        }
      },
      legend: {
        display: false
      }
    }
  };

  // Format date helper
  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const currentDate = formatDate(new Date());

  // Impact indicator component
  const ImpactIndicator = ({ data }) => {
    if (!data) return null;
    const impact = parseFloat(data.impact);
    const color = impact > 0 ? 'text-futarchyGreen' : 'text-futarchyOrangeLight';
    
    return (
      <div 
        className="absolute pointer-events-none transition-all duration-150"
        style={{ 
          left: data.x,
          top: Math.min(data.passY, data.failY),
          height: Math.abs(data.passY - data.failY)
        }}
      >
        <div className={`${color} font-semibold px-2 py-1 rounded-md bg-white/10 backdrop-blur-sm`}>
          {impact > 0 ? '+' : ''}{impact}%
        </div>
        <div className={`w-0.5 h-full ${impact > 0 ? 'bg-futarchyGreen/20' : 'bg-futarchyOrangeLight/20'}`} />
      </div>
    );
  };

  // Remove the lucide-react import and add these custom icons
  const Icons = {
    TrendingUp: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 6l-9.5 9.5-5-5L1 18" />
        <path d="M17 6h6v6" />
      </svg>
    ),
    Check: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    X: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    Impact: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  };

  return (
    <div className="space-y-6">
      {/* Metrics Display */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricBox 
          label="Index Price" 
          value={hoverData?.index || indexPrice}
          color="text-[#7EDCE4]"
          icon={<Icons.TrendingUp />}
        />
        <MetricBox 
          label="Pass Price" 
          value={hoverData?.pass || passPrice}
          color="text-[#C3FF55]"
          icon={<Icons.Check />}
        />
        <MetricBox 
          label="Fail Price" 
          value={hoverData?.fail || failPrice}
          color="text-[#F65A0E]"
          icon={<Icons.X />}
        />
        <MetricBox 
          label="Market Impact" 
          value={hoverData?.impact || impact}
          color={impact > 0 ? 'text-[#C3FF55]' : 'text-[#F65A0E]'}
          icon={<Icons.Impact />}
          prefix=""
        />
      </div>

      {/* Date display with fixed height */}
      <div className="h-6 flex justify-center items-center">
        <div className={`
          text-sm text-gray-400 transition-all duration-300 ease-in-out
          ${hoverData ? 'opacity-100' : 'opacity-0 absolute'}
        `}>
          {hoverData?.date || ''}
        </div>
        <div className={`
          text-sm text-gray-400 transition-all duration-300 ease-in-out
          ${!hoverData ? 'opacity-100' : 'opacity-0 absolute'}
        `}>
          {currentDate}
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative p-6 rounded-xl backdrop-blur-sm bg-white/5">
        <div className="absolute inset-0 background-gradient opacity-5" />
        <div className="relative z-10">
          <Line ref={chartRef} data={chartData} options={options} />
          <ImpactIndicator data={hoverData} />
        </div>
      </div>
    </div>
  );
};

export default MarketCharts; 