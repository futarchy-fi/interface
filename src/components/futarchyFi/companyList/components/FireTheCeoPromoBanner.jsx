import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Placeholder for company logos
const placeholderCompanyLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='%23cccccc'/%3E%3C/svg%3E";

// Updated Mock data with price and date info
export const mockPreviewData = [
  {
    title: "Fire Brian Armstrong from Coinbase?",
    impact: "+12.4%",
    seed: "brian-armstrong",
    companyLogo: "/assets/ceos/brian-armstrong.jpg",
    companyLogoSmall: "/assets/ceos/ceos-companies-logo/coinbase.jpg",
    yesPrice: "$142.10",
    noPrice: "$130.75",
    endDate: "2025-12-15"
  },
  {
    title: "Should Elon Musk be replaced at Tesla?",
    impact: "-7.2%",
    seed: "elon-musk",
    companyLogo: "/assets/ceos/elon-musk.jpg",
    companyLogoSmall: "/assets/ceos/ceos-companies-logo/tesla.png",
    yesPrice: "$210.80",
    noPrice: "$225.40",
    endDate: "2025-11-30"
  },
  {
    title: "Remove Jensen Huang as NVIDIA CEO?",
    impact: "+5.6%",
    seed: "jensen-huang",
    companyLogo: "/assets/ceos/jensen-huang.jpg",
    companyLogoSmall: "/assets/ceos/ceos-companies-logo/nvidia.png",
    yesPrice: "$950.00",
    noPrice: "$900.50",
    endDate: "2025-10-20"
  },
  {
    title: "Should Ryan Cohen step down at GameStop?",
    impact: "-3.9%",
    seed: "ryan-cohen",
    companyLogo: "/assets/ceos/ryan-cohen.jpg",
    companyLogoSmall: "/assets/ceos/ceos-companies-logo/gamestop.jpg",
    yesPrice: "$17.80",
    noPrice: "$19.10",
    endDate: "2025-09-10"
  },
  {
    title: "Fire Sundar Pichai from Alphabet?",
    impact: "+2.3%",
    seed: "sundar-pichai",
    companyLogo: "/assets/ceos/sundar-pichai.jpg",
    companyLogoSmall: "/assets/ceos/ceos-companies-logo/alphabet-inc.png",
    yesPrice: "$180.00",
    noPrice: "$175.50",
    endDate: "2025-12-01"
  },
  {
    title: "Should Satya Nadella leave Microsoft?",
    impact: "+1.5%",
    seed: "satya-nadella",
    companyLogo: "/assets/ceos/satya-nadella.webp",
    companyLogoSmall: "/assets/ceos/ceos-companies-logo/microsoft.jpg",
    yesPrice: "$420.70",
    noPrice: "$415.20",
    endDate: "2026-01-15"
  },
  {
    title: "Remove Michael J. Saylor as MicroStrategy CEO?",
    impact: "-4.4%",
    seed: "michael-j-saylor",
    companyLogo: "/assets/ceos/michael-j-saylor.jpg",
    companyLogoSmall: "/assets/ceos/ceos-companies-logo/microstrategy.jpg",
    yesPrice: "$1450.00",
    noPrice: "$1500.00",
    endDate: "2025-08-25"
  },
  {
    title: "Should Yan Li be fired from Niu Technologies?",
    impact: "+6.2%",
    seed: "yan-li",
    companyLogo: "/assets/ceos/yan-li.jpg",
    companyLogoSmall: "/assets/ceos/ceos-companies-logo/niu-technology.jpg",
    yesPrice: "$3.80",
    noPrice: "$3.55",
    endDate: "2025-09-30"
  },
];

// Function to format date
const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return "Invalid Date";
  }
};

// Function to get a random image URL from Picsum Photos
const getRandomImageUrl = (seed, width = 400, height = 533) => {
  return `https://picsum.photos/seed/${seed}/${width}/${height}?random=${Date.now()}`;
};

// Simple Placeholder Chart SVG Component (with animation)
const PlaceholderChart = ({ positive = true }) => {
  const color = positive ? '#22c55e' : '#ef4444'; // green-500 or red-500
  return (
    <svg className="w-12 h-6 md:w-16 md:h-8 transition-transform duration-300" viewBox="0 0 50 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d={positive ? "M 0 15 Q 5 5, 10 8 T 20 5 T 30 8 T 40 5 T 50 2" : "M 0 5 Q 5 15, 10 12 T 20 15 T 30 12 T 40 15 T 50 18"}
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 100,
          strokeDashoffset: 100,
          animation: 'dash 0.5s ease-out forwards 0.1s'
        }}
      />
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </svg>
  );
};

const FireTheCeoPromoBanner = () => {
  const [imageUrls, setImageUrls] = useState([]);

  useEffect(() => {
    const urls = mockPreviewData.map((data) =>
      getRandomImageUrl(data.seed)
    );
    setImageUrls(urls);
  }, []);

  // Generate random hue rotates once using useMemo
  const hueRotates = useMemo(() =>
    mockPreviewData.map(() => Math.floor(Math.random() * 360)),
    [] // Empty dependency array means this runs only once
  );

  // Futarchy brand colors
  const futarchyYellow = 'bg-[#ffe066] text-[#7c5c00]'; // Impact badge (Good CEO/negative impact)
  const futarchyBlue = 'bg-[#4f8cff] text-white';      // Impact badge (Bad CEO/positive impact)
  const futarchyGreen = 'bg-[#4fe39b] text-[#164c36]'; // GOOD CEO label
  const futarchyCrimson = 'bg-[#e34f6f] text-white';   // BAD CEO label

  return (
    <div className="hidden mt-24 mb-8 py-4 bg-transparent rounded-xl border dark:border-futarchyDarkGray4 shadow-sm">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-6 px-2">
        <div className="text-center md:text-left mb-4 md:mb-0">
          <h2 className="text-2xl md:text-3xl font-bold text-futarchyGray12 dark:text-white mb-1 uppercase tracking-wide">
            Fire the CEO?
          </h2>
          <p className="text-md text-futarchyGray11 dark:text-futarchyGray112 max-w-xl">
            Explore markets on the potential impact of leadership changes.
          </p>
        </div>
        <Link href="/fire-the-ceo" legacyBehavior>
          <a className="hidden bg-black text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/90 transition-colors duration-200 whitespace-nowrap">
            Explore CEO Impact Markets
          </a>
        </Link>
      </div>

      {/* Preview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 auto-rows-[minmax(150px,_auto)]"> {/* Increased min row height */}
        {mockPreviewData.map((data, index) => {
          const isPositive = data.impact.startsWith('+');
          const itemClasses = index === 0 ? "md:col-span-2 md:row-span-2" : "md:col-span-1";
          const hueRotateValue = hueRotates[index]; // Get pre-generated hue-rotate value

          return (
            <Link key={index} href={{ pathname: '/market', query: { proposal: data.seed } }} legacyBehavior>
              {/* Outer link container */}
              <a className={`relative group block h-full shadow-inner transition-transform hover:scale-[1.02] ${itemClasses}`}>
                {/* Background Image with Filter */}
                <div className="absolute inset-0">
                  <Image
                    src={data.companyLogo}
                    alt={data.title}
                    layout="fill"
                    objectFit="cover"
                    className="transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Content Area (Always Visible) */}
                <div className="relative z-10 flex flex-col justify-end h-full p-2 text-white">
                  {/* Minimalist label */}
                  <div className="absolute top-2 left-2 z-20 transition-opacity duration-300 group-hover:opacity-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold shadow gap-1 ${isPositive ? futarchyBlue : futarchyYellow} border border-white/30 animate-none`}
                      title={isPositive ? 'Firing this CEO is predicted to help the company' : 'Firing this CEO is predicted to hurt the company'}
                    >
                      {isPositive ? 'Fire CEO' : 'Keep CEO'}
                    </span>
                  </div>

                  {/* Hover Effect Elements (Chart + Logo) - Appear on hover */}
                  <div className="absolute top-2 right-2 transition-opacity duration-300 opacity-0 group-hover:opacity-100">
                    <div className="transition-transform duration-300 ease-out transform scale-0 group-hover:scale-100 delay-100">
                      <PlaceholderChart positive={isPositive} />
                    </div>
                  </div>
                  <div className="absolute top-2 left-2 w-6 h-6 md:w-7 md:h-7 rounded-full overflow-hidden border border-white/20 transition-opacity delay-200 duration-300 opacity-0 group-hover:opacity-100">
                    <Image
                      src={data.companyLogoSmall}
                      alt={data.title + ' company logo'}
                      layout="fill"
                      objectFit="contain"
                      unoptimized={true}
                    />
                  </div>

                  {/* Bottom Section - Title, Stats, Date */}
                  <div className="bg-gradient-to-t from-black/80 via-black/50 to-transparent -m-2 pt-10 p-2">
                    <h3 className="text-xs font-semibold mb-1.5 leading-tight break-words">
                      {data.title}
                    </h3>
                    {/* Stats Row */}
                    <div className="flex justify-between items-center text-[10px] opacity-90 mb-1">
                      <span>YES: <span className="font-medium">{data.yesPrice}</span></span>
                      <span>NO: <span className="font-medium">{data.noPrice}</span></span>
                      <span className={`font-medium px-1 rounded-full ${isPositive ? 'bg-[#4fe39b] text-[#164c36]' : 'bg-[#e34f6f] text-white'}`}>{data.impact}</span>
                    </div>
                    {/* End Date */}
                    <div className="text-[10px] text-white/70">
                      Ends: {formatDate(data.endDate)}
                    </div>
                  </div>
                </div>
              </a>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default FireTheCeoPromoBanner; 