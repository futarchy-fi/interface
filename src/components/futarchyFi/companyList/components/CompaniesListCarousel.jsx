'use client';

import React, { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

import { fetchAndTransformCompanies } from '../page/CompaniesDataTransformer';
import { CompaniesCard } from '../cards/deafultCards/CompaniesCard';

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

const CompaniesListCarousel = ({ useStorybookUrl = false }) => {
  const [swiper, setSwiper] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPrev, setShowPrev] = useState(false);
  const [showNext, setShowNext] = useState(false);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setLoading(true);
        const data = await fetchAndTransformCompanies();
        setCompanies(data);
      } catch (error) {
        console.error('Error loading companies:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCompanies();
  }, []);

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
              companyID={company.companyID} // ✅ Pass company ID for correct links
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
