import { useEffect, useRef, useState } from 'react';
import { createChart, LineSeries } from 'lightweight-charts';

/**
 * A utility function to format data for the chart. It handles timezone conversion,
 * optional value adjustments, and removes duplicate timestamps.
 *
 * @param {Array<Object>} data - The raw data array, e.g., [{ time, value }].
 * @param {Function} adjustValue - A function to adjust the value (e.g., for currency conversion).
 * @returns {Array<Object>} The formatted and sorted data ready for the chart.
 */
const formatChartData = (data) => {
  if (!Array.isArray(data)) return [];

  const sortedData = data
    .map(d => ({
      time: d.timestamp, // Directly use the unix timestamp (in seconds)
      value: d.price,
    }))
    .sort((a, b) => a.time - b.time);

  // Filter out duplicate timestamps, keeping the first entry
  return sortedData.filter((item, index, arr) => {
    return index === 0 || item.time > arr[index - 1].time;
  });
};

/**
 * Crops spot data to only include timestamps where YES/NO data exists.
 *
 * @param {Array<Object>} spotData - The spot price data array.
 * @param {Array<Object>} yesData - The YES token data array.
 * @param {Array<Object>} noData - The NO token data array.
 * @param {boolean} shouldCrop - Whether to apply cropping.
 * @returns {Array<Object>} The filtered spot data.
 */
const cropSpotData = (spotData, yesData, noData, shouldCrop) => {
  if (!shouldCrop || !spotData?.length || (!yesData?.length && !noData?.length)) {
    return spotData;
  }

  // Create a Set of timestamps from YES and NO data
  const conditionalTimestamps = new Set();
  yesData.forEach(d => conditionalTimestamps.add(d.time));
  noData.forEach(d => conditionalTimestamps.add(d.time));

  // Filter spot data to only include timestamps that exist in conditional data
  const croppedSpot = spotData.filter(d => conditionalTimestamps.has(d.time));

  console.log(`[Spot Cropping] Original spot points: ${spotData.length}, Cropped to: ${croppedSpot.length} (matched with YES/NO timestamps)`);

  return croppedSpot;
};

/**
 * A reusable, presentation-focused chart component that displays YES, NO, and SPOT price lines.
 * It receives all data via props and is responsible only for rendering the chart.
 *
 * @param {object} props - The component props.
 * @param {Array<object>} props.yesData - Data for the 'YES' line.
 * @param {Array<object>} props.noData - Data for the 'NO' line.
 * @param {Array<object>} props.baseData - Data for the 'SPOT' line.
 * @param {number} [props.height=380] - The height of the chart.
 * @param {string} [props.selectedCurrency='SDAI'] - The currency for the price display.
 * @param {number|null} [props.sdaiRate=null] - The conversion rate for sDAI to xDAI.
 * @param {boolean} [props.isLoadingRate=false] - Flag indicating if the conversion rate is loading.
 * @param {object|null} [props.rateError=null] - Error object if rate fetching fails.
 * @param {number} [props.precision=4] - The precision for price formatting.
 * @param {string} [props.interval='3600'] - The interval for the chart.
 * @param {function} [props.onIntervalChange] - Function to handle interval change.
 * @param {boolean} [props.cropSpot=true] - Only show spot data points that have corresponding YES/NO data at the same timestamp.
 */
const TripleChart = ({
  yesData = [],
  noData = [],
  baseData = [],
  selectedCurrency = 'SDAI',
  precision = 4,
  interval = '3600',
  onIntervalChange,
  cropSpot = true,
}) => {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isDarkMode, setIsDarkMode] = useState(
    () => typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const INTERVAL_OPTIONS = [
    { label: '1 Minute', value: '60' },
    { label: '1 Hour', value: '3600' }
  ];

  // Effect to handle clicks outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Effect to detect and respond to dark mode changes on the HTML element
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  
  // Effect to handle responsive chart size
  useEffect(() => {
    const chartContainer = chartContainerRef.current;
    if (!chartContainer) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length > 0) {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });

    resizeObserver.observe(chartContainer);
    return () => resizeObserver.unobserve(chartContainer);
  }, []);

  // Main effect for creating and updating the chart
  useEffect(() => {
    const chartContainer = chartContainerRef.current;
    if (containerSize.width === 0 || containerSize.height === 0 || !chartContainer || !yesData || !noData || !baseData) {
      return;
    }

    // Define colors and styles based on the user's request
    const backgroundColor = isDarkMode ? '#191919' : '#F9F9F9';
    const textColor = isDarkMode ? 'rgb(220, 220, 220)' : '#333333';
    const gridColor = isDarkMode ? 'rgba(179, 179, 179, 0.4)' : '#D9D9D9';

    const chartOptions = {
      width: containerSize.width,
      height: containerSize.height,
      layout: { background: { type: 'solid', color: backgroundColor }, textColor },
      grid: { vertLines: { visible: false }, horzLines: { color: gridColor, style: 2 } }, // Dotted horizontal lines
      crosshair: { mode: 0 },
      timeScale: {
        borderColor: backgroundColor,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        tickMarkFormatter: (timestamp) => {
          const date = new Date(timestamp * 1000);
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${day}/${month} ${hours}:${minutes}`;
        },
      },
      rightPriceScale: { 
        borderVisible: false,
        autoScale: true,
      },
      leftPriceScale: { visible: false },
    };

    // Create or update chart
    const chart = chartInstanceRef.current 
        ? chartInstanceRef.current 
        : createChart(chartContainer, chartOptions);

    if (!chartInstanceRef.current) {
        chartInstanceRef.current = chart;
    } else {
        chart.applyOptions(chartOptions);
    }

    const spotLineColor = isDarkMode ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)';
    const minMove = 1 / Math.pow(10, precision);
    const priceFormat = { type: 'price', precision: precision, minMove: minMove };

    // Format all data
    const formattedYesData = formatChartData(yesData);
    const formattedNoData = formatChartData(noData);
    let formattedBaseData = formatChartData(baseData);

    // Apply cropSpot filtering to base data
    formattedBaseData = cropSpotData(formattedBaseData, formattedYesData, formattedNoData, cropSpot);

    const series = [
      { name: 'yesLine', data: formattedYesData, color: 'rgb(0, 144, 255)', title: 'YES' },
      { name: 'noLine', data: formattedNoData, color: 'rgb(245, 196, 0)', title: 'NO' },
      { name: 'baseLine', data: formattedBaseData, color: spotLineColor, title: 'SPOT' },
    ];
    
    series.forEach(s => {
        const seriesOptions = {
            color: s.color,
            lineWidth: 2,
            title: s.title,
            priceFormat: priceFormat,
            lastValueVisible: true, // Show price label
            priceLineVisible: true, // Show dashed line to price
        };
        if (!chart[s.name]) {
            chart[s.name] = chart.addSeries(LineSeries, seriesOptions);
        } else {
            chart[s.name].applyOptions(seriesOptions);
        }
        chart[s.name].setData(s.data);
    });

    chart.timeScale().fitContent();

    // Cleanup effect
    return () => {
        if (chartInstanceRef.current) {
            chartInstanceRef.current.remove();
            chartInstanceRef.current = null;
        }
    };
  }, [
    containerSize,
    isDarkMode,
    yesData,
    noData,
    baseData,
    precision,
    cropSpot,
  ]);

  const hasData = yesData?.length > 0 && noData?.length > 0 && baseData?.length > 0;
  const currentIntervalLabel = INTERVAL_OPTIONS.find(opt => opt.value === interval)?.label;

  return (
    <div className="relative w-full h-full rounded-xl border-2 border-[#D9D9D9] dark:border-[#B3B3B3]/40 overflow-hidden flex flex-col" style={{ zIndex: 0 }}>
        <div ref={dropdownRef} className="absolute top-2 left-2 z-20">
          <div
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="cursor-pointer border-2 border-futarchyGray62 dark:border-futarchyGray112/40 z-10 px-2 py-1 rounded-md text-xs bg-futarchyGray3 dark:bg-futarchyDarkGray3 text-futarchyDarkGray3 dark:text-futarchyGray112 font-medium flex items-center justify-between"
            style={{ minWidth: '120px' }}
          >
            <span>Interval: {currentIntervalLabel}</span>
            <span className={`ml-2 transform transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
          </div>
          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-full bg-futarchyGray3 dark:bg-futarchyDarkGray3 border-2 border-futarchyGray62 dark:border-futarchyGray112/40 rounded-md overflow-hidden shadow-lg">
              {INTERVAL_OPTIONS.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => {
                    onIntervalChange(opt.value);
                    setIsDropdownOpen(false);
                  }}
                  className="px-2 py-1.5 text-xs text-futarchyDarkGray3 dark:text-futarchyGray112 hover:bg-futarchyGray4 dark:hover:bg-futarchyDarkGray4 cursor-pointer"
                >
                  {opt.label}
                </div>
              ))}
            </div>
          )}
        </div>
        <div 
          className="absolute top-2 right-[70px] border-2 border-futarchyGray62 dark:border-futarchyGray112/40 z-10 px-1.5 py-1 rounded-md text-xs bg-futarchyGray3 dark:bg-futarchyDarkGray3 text-futarchyDarkGray3 dark:text-futarchyGray112 font-medium"
        >
          Prices in {selectedCurrency}
        </div>
        <div ref={chartContainerRef} className="w-full h-full flex-grow" />
        {!hasData && (
             <div className={`absolute inset-0 flex items-center justify-center h-full ${isDarkMode ? 'bg-[#191919]' : 'bg-[#F0F0F0]'}`}>
                <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Waiting for chart data...
                </div>
            </div>
        )}
    </div>
  );
};

export default TripleChart;
