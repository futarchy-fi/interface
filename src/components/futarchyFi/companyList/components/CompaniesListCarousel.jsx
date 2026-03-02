'use client';

import React, { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import { useAccount } from 'wagmi';

import { fetchAndTransformCompanies } from '../page/CompaniesDataTransformer';
import { CompaniesCard } from '../cards/deafultCards/CompaniesCard';
import { useAggregatorCompanies } from '../../../../hooks/useAggregatorCompanies';
import { ENABLE_V2_SUBGRAPH } from '../../../../config/featureFlags';
import { DEFAULT_AGGREGATOR } from '../../../../config/subgraphEndpoints';

// Re-using NavigationButton component from EventsHighlightCarousel
const NavigationButton = ({ direction, onClick, className }) => (
  <button
    onClick={onClick}
    className={`absolute top-1/2 -translate-y-1/2 z-10 md:w-[48px] md:h-[48px] flex items-center justify-center md:rounded-xl rounded-lg bg-[#FCFCFC] border border-[#D9D9D9] shadow-sm dark:bg-[#191919] dark:border-futarchyGray112/40 hover:bg-futarchyGray2 dark:hover:bg-futarchyGray11/70 transition-colors text-[#1F1F1F] dark:text-white ${className}`}
  >
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={direction === 'next' ? 'rotate-180' : ''}
    >
      <path
        d="M15 18L9 12L15 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
);

const CompaniesListCarousel = ({ useStorybookUrl = false, aggregatorAddress = null }) => {
  const [swiper, setSwiper] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPrev, setShowPrev] = useState(false);
  const [showNext, setShowNext] = useState(false);

  // Get connected wallet
  const { address: connectedAddress } = useAccount();

  // Use default aggregator when V2 subgraph is enabled
  const effectiveAggregator = ENABLE_V2_SUBGRAPH ? DEFAULT_AGGREGATOR : aggregatorAddress;

  // Use subgraph hook if effectiveAggregator is available
  const {
    companies: subgraphCompanies,
    loading: subgraphLoading,
    error: subgraphError
  } = useAggregatorCompanies(effectiveAggregator);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setLoading(true);
        console.log(`[Carousel] ENABLE_V2_SUBGRAPH=${ENABLE_V2_SUBGRAPH}, aggregator=${effectiveAggregator || 'none'}`);

        // V2 Mode: Only use subgraph companies, skip Supabase entirely
        if (ENABLE_V2_SUBGRAPH) {
          if (!subgraphLoading) {
            console.log(`[Carousel] V2-MODE: Using ${subgraphCompanies.length} subgraph companies only (skipping Supabase)`);
            setCompanies(subgraphCompanies);
            setLoading(false);
          }
          return;
        }

        // Legacy mode: Fetch from backend (Supabase)
        const backendData = await fetchAndTransformCompanies();

        // If aggregator provided and subgraph loaded, merge them
        if (effectiveAggregator && !subgraphLoading) {
          // Subgraph companies come first, then backend companies
          // Exclude backend duplicates that might also be in subgraph
          const subgraphIds = new Set(subgraphCompanies.map(c => c.companyID?.toLowerCase()));
          const filteredBackend = backendData.filter(c =>
            !subgraphIds.has(c.companyID?.toString()?.toLowerCase())
          );
          setCompanies([...subgraphCompanies, ...filteredBackend]);
          console.log(`[Carousel] Merged: ${subgraphCompanies.length} subgraph + ${filteredBackend.length} backend = ${subgraphCompanies.length + filteredBackend.length} total`);
        } else if (!effectiveAggregator) {
          // No aggregator, just use backend
          setCompanies(backendData);
        }
        // If aggregator but still loading subgraph, wait
        if (effectiveAggregator && subgraphLoading) {
          return; // Don't set loading false yet
        }
      } catch (error) {
        console.error('Error loading companies:', error);
      } finally {
        if (ENABLE_V2_SUBGRAPH) {
          // V2 mode loading is handled above
        } else if (!effectiveAggregator || !subgraphLoading) {
          setLoading(false);
        }
      }
    };

    loadCompanies();
  }, [effectiveAggregator, subgraphCompanies, subgraphLoading]);

  useEffect(() => {
    if (swiper) {
      const updateNav = () => {
        if (swiper.isLocked) {
          setShowPrev(false);
          setShowNext(false);
        } else {
          setShowPrev(!swiper.isBeginning);
          setShowNext(!swiper.isEnd);
        }
      };

      swiper.on('slideChange', updateNav);
      swiper.on('resize', updateNav);

      updateNav(); // Initial check

      return () => {
        if (swiper && !swiper.destroyed) {
          swiper.off('slideChange', updateNav);
          swiper.off('resize', updateNav);
        }
      };
    }
  }, [swiper]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-futarchyLavender"></div>
      </div>
    );
  }

  if (!companies || companies.length === 0) {
    return (
      <div className="flex justify-center items-center h-[200px] text-futarchyGray11">
        No companies available.
      </div>
    );
  }

  return (
    <div className="relative md:px-[60px] md:-mx-[60px]">
      {showPrev && (
        <NavigationButton
          direction="prev"
          className="left-0"
          onClick={() => swiper?.slidePrev()}
        />
      )}
      <Swiper
        modules={[Navigation]}
        spaceBetween={24}
        slidesPerView={1}
        breakpoints={{
          768: {
            slidesPerView: 'auto',
          },
        }}
        onSwiper={setSwiper}
        watchOverflow={true}
        navigation={false}
        className="!overflow-hidden"
        wrapperClass="!items-stretch"
      >
        {companies.map((company) => (
          <SwiperSlide key={company.companyID} className="md:!w-auto">
            <CompaniesCard
              name={company.title}
              stats={{ proposals: company.proposals }}
              image={company.image} // ✅ Pass dynamic image from backend
              colors={company.colors} // ✅ Pass colors for background
              companyID={company.companyID} // ✅ Pass ID explicitly (contract address for subgraph)
              fromSubgraph={company.fromSubgraph} // ✅ Pass flag for badge
              owner={company.owner} // ✅ Pass owner for badge
              connectedAddress={connectedAddress} // ✅ Pass connected wallet for owner check
              organizationAddress={company.fromSubgraph ? company.companyID : null} // ✅ Pass org address for edit modal
              useStorybookUrl={useStorybookUrl}
            />
          </SwiperSlide>
        ))}
      </Swiper>
      {showNext && (
        <NavigationButton
          direction="next"
          className="right-0"
          onClick={() => swiper?.slideNext()}
        />
      )}
    </div>
  );
};

export default CompaniesListCarousel;
