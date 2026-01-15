import React from "react";
import Image from "next/image";
import { Timestamp } from "../../proposalsList/cards/ProposalsCard";
// Reuse the same icons and resources

export const EventsCard = ({
  eventID,
  eventTitle,
  eventStatus,
  countdownFinish,
  timestamp,
  endTime,
  tags,
  prices,
  image,
  useStorybookUrl = false,
  eventsDocMarket = [{}],
}) => {
  const gradientStyles = {
    approved: {
      gradient: "from-futarchyBlue4 to-transparent",
      hoverGradient: "from-futarchyBlue7 to-transparent",
    },
    refused: {
      gradient: "from-futarchyGold4 to-transparent",
      hoverGradient: "from-futarchyGold7 to-transparent",
    },
    ongoing: {
      gradient: "from-futarchyGreen4 to-transparent",
      hoverGradient: "from-futarchyGreen7 to-transparent",
    },
  };

  const currentGradient = gradientStyles[eventStatus] || gradientStyles.ongoing;

  return (
    <a href={`/markets/${eventID}`} className="block hover:opacity-90 transition-opacity">
      <div className="flex flex-col bg-futarchyGray2 dark:bg-transparent border-2 border-futarchyGray3 dark:border-futarchyGray112/40 rounded-2xl group relative cursor-pointer w-[392px] h-full shadow-sm hover:shadow-xl transition-all duration-300">
        {/* Top section with image */}
        <div className="bg-lightGray dark:bg-transparent flex flex-col justify-center relative rounded-t-xl w-[388px] h-[180px]">
          <div className={`absolute inset-0 opacity-100 transition-opacity duration-300 bg-gradient-to-r ${currentGradient.gradient} rounded-t-xl`} />
          <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r ${currentGradient.hoverGradient} rounded-t-xl`} />
          {image && (
            <div className="absolute inset-0 rounded-t-xl overflow-hidden" style={{ backgroundColor: "#151411" }}>
              <div className="w-full h-full scale-90">
                <Image
                  src={image}
                  alt="Event Image"
                  layout="fill"
                  objectFit="cover"
                  className="opacity-100"
                />
              </div>
            </div>
          )}
        </div>

        {/* Bottom section */}
        <div className="p-5 bg-futarchyGray2 dark:bg-futarchyDarkGray2 relative z-20 transform transition-all duration-300 hover:-translate-y-2 rounded-b-xl w-[388px]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col border-2 border-futarchyGray4 dark:border-futarchyGray112/40 rounded-xl">
              {/* Timestamp and Status */}
              <div className="flex flex-row justify-between items-center p-3 bg-futarchyGray3 dark:bg-futarchyGray112/10 rounded-t-xl">
                <Timestamp 
                  countdownFinish={countdownFinish} 
                  timestamp={timestamp} 
                  endTime={endTime} 
                />
                <div className="text-xs font-medium text-futarchyGray11 dark:text-futarchyGray">
                  {eventStatus?.toUpperCase() || 'ONGOING'}
                </div>
              </div>
              <div className="flex flex-col p-3 gap-3">
                {/* Title */}
                <h3 className="text-sm font-bold font-oxanium text-futarchyGray11 dark:text-futarchyGray3 leading-6">
                  {eventTitle || "Untitled Event"}
                </h3>
                {/* Tags */}
                {tags && (
                  <div className="text-xs text-futarchyGray11 dark:text-futarchyGray">
                    {tags}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
};

export const MobileEventsCard = ({
  eventID,
  eventTitle,
  eventStatus,
  countdownFinish,
  timestamp,
  endTime,
  tags,
  prices,
  image,
  useStorybookUrl = false,
  eventsDocMarket = [{}],
}) => {
  const gradientStyles = {
    approved: {
      gradient: "from-futarchyBlue4 to-transparent",
      hoverGradient: "from-futarchyBlue7 to-transparent",
    },
    refused: {
      gradient: "from-futarchyGold4 to-transparent",
      hoverGradient: "from-futarchyGold7 to-transparent",
    },
    ongoing: {
      gradient: "from-futarchyGreen4 to-transparent",
      hoverGradient: "from-futarchyGreen7 to-transparent",
    },
  };

  const currentGradient = gradientStyles[eventStatus] || gradientStyles.ongoing;

  return (
    <a href={`/markets/${eventID}`} className="block w-full hover:opacity-90 transition-opacity">
      <div className="flex flex-col bg-futarchyGray2 dark:bg-transparent border-2 border-futarchyGray3 dark:border-futarchyGray112/40 rounded-2xl group relative w-full shadow-sm hover:shadow-xl transition-all duration-300">
        {/* Top section with image */}
        <div className="bg-lightGray dark:bg-transparent flex flex-col justify-center relative rounded-t-xl h-[120px]">
          <div className={`absolute inset-0 opacity-100 transition-opacity duration-300 bg-gradient-to-r ${currentGradient.gradient} rounded-t-xl`} />
          <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r ${currentGradient.hoverGradient} rounded-t-xl`} />
          {image && (
            <div className="absolute inset-0 rounded-t-xl overflow-hidden" style={{ backgroundColor: "#151411" }}>
              <div className="w-full h-full scale-90">
                <Image
                  src={image}
                  alt="Event Image"
                  layout="fill"
                  objectFit="cover"
                  className="opacity-100"
                />
              </div>
            </div>
          )}
        </div>

        {/* Content section */}
        <div className="p-4 bg-futarchyGray2 dark:bg-futarchyDarkGray2 relative z-20 rounded-b-xl">
          <div className="flex flex-col gap-4">
            {/* Header with timestamp and status */}
            <div className="flex justify-between items-center bg-futarchyGray3 dark:bg-futarchyGray112/10 rounded-lg p-2">
              <div className="text-xs">
                <Timestamp
                  countdownFinish={countdownFinish}
                  timestamp={timestamp}
                  endTime={endTime}
                />
              </div>
              <div className="text-xs font-medium text-futarchyGray11 dark:text-futarchyGray">
                {eventStatus?.toUpperCase() || 'ONGOING'}
              </div>
            </div>

            {/* Title */}
            <h3 className="text-sm font-bold font-oxanium text-futarchyGray11 dark:text-futarchyGray leading-5">
              {eventTitle || "Untitled Event"}
            </h3>

            {/* Tags */}
            {tags && (
              <div className="text-xs text-futarchyGray11 dark:text-futarchyGray">
                {tags}
              </div>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}; 