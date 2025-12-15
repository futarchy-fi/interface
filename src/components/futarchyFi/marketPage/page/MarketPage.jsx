import React from 'react';
import RootLayout from '../../../layout/RootLayout';
import PageLayout from '../../../layout/PageLayout';
import MarketBadgeList from '../components/MarketBadgeList';
import TabsComponent from '../tabs/TabsComponent';
import MarketSwapComponent from '../swapComponent/MarketSwapComponent';
import MarketBalancePanel from '../balancePanel/MarketBalancePanel';
import ChartParameters from '../tripleChart/chartParameters/ChartParameters';
import TripleChart from '../tripleChart/TripleChart';
import ArrowDownIcon from '../../../common/icons/ArrowDownIcon';

const generateMockData = (startValue, numPoints, volatility, intervalSeconds) => {
  const data = [];
  let currentValue = startValue;
  const startTime = Math.floor(new Date().getTime() / 1000) - numPoints * intervalSeconds; // Unix timestamp in seconds

  for (let i = 0; i < numPoints; i++) {
      const change = (Math.random() - 0.5) * 2 * volatility;
      currentValue += change;
      if (currentValue < 0) currentValue = 0;

      data.push({
          timestamp: startTime + i * intervalSeconds,
          price: currentValue,
      });
  }
  return data;
};

const DEFAULT_BADGES = [
  { text: 'Active', colorScheme: 'emerald' },
  { text: 'Remaining Time: 108d 5h 5m', colorScheme: 'gold' },
  { text: 'Track Progress', colorScheme: 'default', link: 'https://example.com/track' },
  { text: 'Prediction Market', colorScheme: 'default', link: 'https://example.com/market' },
  { text: 'Question', colorScheme: 'violet', link: 'https://example.com/question' },
];

const TABS = [
  { id: 'chart', label: 'Chart' },
  { id: 'swap', label: 'Swap' },
  { id: 'balance', label: 'Balance' },
  { id: 'activity', label: 'Activity' },
];

const PriceHeader = ({ yesPrice, noPrice }) => {
  return (
    <div className="fixed top-20 left-0 right-0 z-40 lg:hidden">
      {/* A solid background container */}
      <div className="bg-futarchyDarkGray3/95 backdrop-blur-sm">
        <div className="container mx-auto px-5 py-2 flex justify-between items-center">
          <h2 className="text-sm text-white font-semibold pr-4">
            Market Prices
          </h2>
          <div className="flex gap-3 text-sm flex-shrink-0">
            <span className="text-futarchyBlue9">YES: {yesPrice}</span>
            <span className="text-futarchyGold8">NO: {noPrice}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const MarketPage = ({ marketBadges = DEFAULT_BADGES }) => {
  const [interval, setInterval] = React.useState('3600'); // Default to 1 Hour (in seconds)
  const [marketStatus, setMarketStatus] = React.useState('open'); // 'open', 'closed', 'pending', 'settled'
  const [activeTab, setActiveTab] = React.useState('chart');
  const heroRef = React.useRef(null);

  const resolutionDetails = {
    label: 'Outcome',
    value: 'Pending',
    link: 'https://seer.co'
  };

  const parametersData = {
    tradingPair: 'PNK/SDAI',
    spotPrice: 0.0096,
    yesPrice: 0.0137,
    noPrice: 0.0125,
    eventProbability: 60,
    currency: 'SDAI',
    precision: 4,
  };

  const chartData = React.useMemo(() => {
    const intervalSeconds = parseInt(interval, 10);
    return {
      yesData: generateMockData(parametersData.yesPrice, 100, 0.0005, intervalSeconds),
      noData: generateMockData(parametersData.noPrice, 100, 0.0005, intervalSeconds),
      baseData: generateMockData(parametersData.spotPrice, 100, 0.0005, intervalSeconds),
    };
  }, [interval, parametersData.yesPrice, parametersData.noPrice, parametersData.spotPrice]);

  const tabPanels = [
    {
      id: 'chart',
      content: (
        <div className="h-full bg-futarchyGray3 dark:bg-futarchyDarkGray3 rounded-3xl border-2 border-futarchyGray62 dark:border-futarchyGray11/70 overflow-hidden flex flex-col">
          <div className="h-16 bg-futarchyGray2 dark:bg-futarchyDarkGray2 border-b-2 border-futarchyGray62 dark:border-futarchyGray11/70">
            <ChartParameters {...parametersData} resolutionDetails={resolutionDetails} />
          </div>
          <div className="py-4 bg-futarchyGray3 dark:bg-futarchyDarkGray3 flex-grow overflow-hidden">
            <TripleChart
              {...chartData}
              selectedCurrency={parametersData.currency}
              precision={parametersData.precision}
              interval={interval}
              onIntervalChange={setInterval}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'swap',
      content: (
        <div className="h-full relative overflow-hidden rounded-3xl">
          <MarketSwapComponent marketStatus={marketStatus} />
          {marketStatus === 'settled' && (
            <div className="absolute inset-0 flex items-center justify-center border-2 border-futarchyGray62 dark:border-futarchyGray11/70 bg-futarchyGray2/50 dark:bg-futarchyDarkGray2/10 backdrop-blur-xs rounded-3xl">
              <h2 className="text-2xl font-bold dark:text-futarchyGray3 text-futarchyDarkGray3 text-center">Market Settled</h2>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'balance',
      content: (
        <div className="h-full flex items-center justify-center">
          <MarketBalancePanel
            positions={{ wxdai: "1250.75" }}
            address={"0x1234...abcd"}
            isLoadingPositions={false}
          />
        </div>
      ),
    },
    {
      id: 'activity',
      content: (
        <div className="h-full flex items-center justify-center">
          <TabsComponent />
        </div>
      ),
    },
  ];

  const marketHero = (
    <div ref={heroRef} className="relative bg-futarchyDarkGray2/90 dark:bg-futarchyDarkGray2/70 backdrop-blur-sm font-oxanium h-full flex flex-col border-b-2 border-futarchyDarkGray42">
      <div className="container mx-auto px-5 flex-grow flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-3">
          {/* Left Column: Vital Info */}
          <div className="lg:col-span-2 space-y-3 py-4 lg:space-y-4 lg:py-6 border-b-2 border-futarchyDarkGray42 lg:border-b-0 lg:border-r lg:pr-6">
            <h1 className="text-base lg:text-2xl font-semibold text-white leading-tight">
              Will GnosisDAO adopt futarchy advisory markets for ≥ $5M treasury or strategic decisions by Dec 31 2025?
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-sm lg:text-lg text-white">Impact:</span>
              <span className="text-sm lg:text-lg font-semibold text-futarchyTeal7">N/A</span>
            </div>
            <MarketBadgeList badges={marketBadges} />
          </div>

          {/* Right Column: Description */}
          <div className="lg:col-span-1 py-4 lg:py-6 lg:pl-6">
            <p className="text-xs lg:text-sm text-white/70 leading-relaxed">
              Will GnosisDAO formally adopt a governance norm requiring futarchy advisory markets—defaulting to futarchy market outcomes unless explicitly overridden—for all ≥ $5 M treasury allocations or other high-impact strategic decisions by December 31 2025?
            </p>
          </div>
        </div>
      </div>
      {/* Scroll Down Arrow for mobile */}
      <div className="absolute bottom-4 lg:hidden animate-bounce w-full ">
        <div className="flex flex-col items-center text-white justify-center">
          <ArrowDownIcon className="h-6 w-6" />
          <span className="text-xs mt-1">Scroll Down</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <PriceHeader
        yesPrice={parametersData.yesPrice}
        noPrice={parametersData.noPrice}
      />
      <RootLayout 
        headerConfig="app" 
        footerConfig="main" 
        useSnapScroll={true} 
        heroContent={marketHero}
      >
        <PageLayout>
          {/* Mobile: Tabbed Layout */}
          <div className="pt-16 lg:hidden flex-grow flex flex-col justify-center">
            {/* Centered Content Block */}
            <div>
              <div className="flex items-center border-b-2 dark:border-white/20 border-futarchyGray4 mb-2">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-4 text-sm font-semibold transition-colors duration-200 ${
                      activeTab === tab.id
                        ? 'dark:text-futarchyViolet9 text-futarchyViolet11 border-b-2 border-futarchyViolet11 dark:border-futarchyViolet9 hover:dark:text-futarchyViolet7 hover:dark:border-futarchyViolet7 -mb-0.5'
                        : 'dark:text-white text-black/60 hover:text-black/40 hover:dark:text-white/60 hover:text-black/60 border-b-2 border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="relative h-[424px]">
                {tabPanels.map(panel => (
                  <div
                    key={panel.id}
                    className={`absolute inset-0 transition-opacity duration-300 ease-in-out ${
                      activeTab === panel.id
                        ? 'opacity-100'
                        : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    {panel.content}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Desktop: Grid Layout */}
          <div className="pt-6 hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 lg:h-[424px] bg-futarchyGray3 dark:bg-futarchyDarkGray3 rounded-3xl border-2 border-futarchyGray62 dark:border-futarchyGray11/70 overflow-hidden flex flex-col">
              <div className="h-16 bg-futarchyGray2 dark:bg-futarchyDarkGray2 border-b-2 border-futarchyGray62 dark:border-futarchyGray11/70">
                <ChartParameters {...parametersData} resolutionDetails={resolutionDetails} />
              </div>
              <div className="p-4 bg-futarchyGray3 dark:bg-futarchyDarkGray3 flex-grow">
                <TripleChart 
                  {...chartData}
                  selectedCurrency={parametersData.currency} 
                  precision={parametersData.precision}
                  interval={interval}
                  onIntervalChange={setInterval}
                />
              </div>
            </div>
            <div className="lg:col-span-1 lg:h-[424px] relative overflow-hidden rounded-3xl">
              <MarketSwapComponent marketStatus={marketStatus} />
              {marketStatus === 'settled' && (
                <div className="absolute inset-0 flex items-center justify-center border-2 border-futarchyGray62 dark:border-futarchyGray11/70 bg-futarchyGray2/50 dark:bg-futarchyDarkGray2/10 backdrop-blur-xs rounded-3xl">
                  <h2 className="text-2xl font-bold dark:text-futarchyGray3 text-futarchyDarkGray3 text-center">Market Settled</h2>
                </div>
              )}
            </div>
            <div className="lg:col-span-2">
              <TabsComponent />
            </div>
            <div className="lg:col-span-1">
              <MarketBalancePanel 
                positions={{ wxdai: "1250.75" }} // Mock positions for demonstration
                address={"0x1234...abcd"}
                isLoadingPositions={false}
              />
            </div>
          </div>
        </PageLayout>
      </RootLayout>
    </>
  );
};

export default MarketPage;
