import React, { useState, useEffect, useRef } from "react";
import { CheckIcon, CancelIcon, NewspaperIcon, EyeIcon } from "./Resources";
import Image from 'next/image';

// Move statusColors to the top level, after imports
const statusColors = {
  ongoing: {
    top: {
      border: "border-futarchyBlue5",
      text: "text-futarchyBlue11",
      hover: "hover:border-futarchyBlue9",
      background: "bg-futarchyBlue4",
      dividerColor: "bg-futarchyBlue9",
      iconFill: "currentColor"
    },
    bottom: {
      border: "border-futarchyGold5",
      text: "text-futarchyGold11",
      hover: "hover:border-futarchyGold9",
      background: "bg-futarchyGold4",
      dividerColor: "bg-futarchyGold9",
      iconFill: "currentColor"
    },
  },
  approved: {
    top: {
      border: "border-futarchyBlue6",
      text: "text-futarchyBlue11",
      hover: "hover:border-futarchyBlue11",
      background: "bg-futarchyBlue5",
      dividerColor: "bg-futarchyBlue11",
      iconFill: "currentColor"
    },
    bottom: {
      border: "border-futarchyGold4",
      text: "text-futarchyGold7",
      hover: "hover:border-futarchyGold7",
      background: "bg-futarchyGold3",
      dividerColor: "bg-futarchyGold7",
      iconFill: "currentColor"
    },
  },
  refused: {
    top: {
      border: "border-futarchyBlue4",
      text: "text-futarchyBlue7",
      hover: "hover:border-futarchyBlue7",
      background: "bg-futarchyBlue3",
      dividerColor: "bg-futarchyBlue7",
      iconFill: "currentColor"
    },
    bottom: {
      border: "border-futarchyGold6",
      text: "text-futarchyGold11",
      hover: "hover:border-futarchyGold11",
      background: "bg-futarchyGold5",
      dividerColor: "bg-futarchyGold11",
      iconFill: "currentColor"
    },
  },
};

// Timestamp component with countdown and optional mock timestamp
const Timestamp = ({ countdownFinish, timestamp, endTime }) => {
  const [remainingTime, setRemainingTime] = useState("");

  useEffect(() => {
    const updateRemainingTime = () => {
      const now = Date.now() / 1000; // Current time in seconds
      
      if (countdownFinish) {
        // If countdown is finished, show when it ended
        const endDate = new Date(endTime * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        setRemainingTime(`Ended on: ${endDate}`);
      } else if (endTime) {
        // If countdown is ongoing, calculate remaining time
        const timeLeft = endTime - now;
        
        if (timeLeft <= 0) {
          const endDate = new Date(endTime * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          setRemainingTime(`Ended on: ${endDate}`);
        } else {
          // Calculate days, hours, minutes
          const days = Math.floor(timeLeft / 86400);
          const hours = Math.floor((timeLeft % 86400) / 3600);
          const minutes = Math.floor((timeLeft % 3600) / 60);
          
          let timeString = '';
          if (days > 0) {
            timeString += `${days}d `;
          }
          if (hours > 0 || days > 0) {
            timeString += `${hours}h `;
          }
          timeString += `${minutes}m`;
          
          setRemainingTime(`Open until: ${timeString}`);
        }
      }
    };

    updateRemainingTime();
    const interval = setInterval(updateRemainingTime, 1000);
    return () => clearInterval(interval);
  }, [countdownFinish, endTime]);

  return (
    <div className="select-none text-black text-sm font-semibold whitespace-nowrap leading-6">
      {remainingTime}
    </div>
  );
};

const Proposals = ({
  proposalID,
  proposalsDoc,
  proposalMarket,
  approvalStatus,
}) => {
  const sampleDocText = "Read Proposal";
  const sampleMarketText = "View Market";

  const statusClasses = statusColors[approvalStatus] || statusColors.ongoing;

  return (
    <div>
      <div className="flex flex-row gap-1 items-center text-sm font-light select-none justify-between">
        <a
          href="/documentation"
          className="border-2 border-futarchyGray4 rounded-xl w-1/2 py-3 px-[14px] text-center flex flex-row justify-center gap-[6px]"
          target="_self"
          rel="noopener noreferrer"
        >
          <NewspaperIcon />
          <span className="relative z-10 text-base font-semibold text-futarchyGray12">
            {sampleDocText}
          </span>
        </a>
        <span className={`text-2xl ${statusClasses.separator}`}></span>
        <a
          href={`/markets/${proposalID}`}
          className="border-2 border-futarchyGray4 rounded-xl w-1/2 py-3 px-[14px] text-center flex flex-row justify-center gap-[6px]"
          
        >
          <EyeIcon />
          <span className="relative z-10 text-base font-semibold text-futarchyGray12">
            {sampleMarketText}
          </span>
        </a>
      </div>
    </div>
  );
};

const ProposalStatus = ({ approvalStatus }) => {
  const { borderColor, textColor, bgColor, statusText } = (() => {
    switch (approvalStatus) {
      case "approved":
        return {
          borderColor: "border-futarchyBlue6",
          textColor: "text-futarchyBlue11",
          bgColor: "bg-futarchyBlue3",
          statusText: "Approved",
        };
      case "refused":
        return {
          borderColor: "border-futarchyGold6",
          textColor: "text-futarchyGold11",
          bgColor: "bg-futarchyGold3",
          statusText: "Refused",
        };
      case "ongoing":
      default:
        return {
          borderColor: "border-futarchyGreen6",
          textColor: "text-futarchyGreen11",
          bgColor: "bg-futarchyGreen3",
          statusText: "Ongoing",
        };
    }
  })();

  return (
    <div className="flex">
      <div
        className={`inline-flex items-center justify-center rounded-full py-1 px-[10px] 
                    ${borderColor} ${textColor} ${bgColor} 
                    border font-medium text-xs leading-4 whitespace-nowrap`}
      >
        {statusText}
      </div>
    </div>
  );
};

// Update the ProposalsPrices component
const ProposalsPrices = ({ prices = {}, approvalStatus, metadata }) => {
  const { approval = "", refusal = "" } = prices;
  
  // Check if we should invert prices based on metadata
  const shouldInvertPrices = metadata?.invertCondPoolPrice === true;
  
  // Apply inversion logic if needed - calculate 1/price
  let displayApproval = approval;
  let displayRefusal = refusal;
  
  if (shouldInvertPrices) {
    const approvalNum = parseFloat(approval.toString().replace(/[^\d.-]/g, ''));
    const refusalNum = parseFloat(refusal.toString().replace(/[^\d.-]/g, ''));
    
    displayApproval = approvalNum > 0 ? (1 / approvalNum).toFixed(4) : approval;
    displayRefusal = refusalNum > 0 ? (1 / refusalNum).toFixed(4) : refusal;
  }

  const currentColors = statusColors[approvalStatus] || statusColors.ongoing;
  const [dividerColor, setDividerColor] = useState("bg-futarchyGray4");

  return (
    <div className="flex relative">
      {/* Top Button */}
      <button
        className={`relative overflow-hidden px-3 py-2 border-2 border-r-0 rounded-l-lg w-1/2 
                    transition-all duration-300
                    ${currentColors.top.border} ${currentColors.top.text} ${currentColors.top.hover}
                    ${currentColors.top.background}`}
        onMouseEnter={() => setDividerColor(currentColors.top.dividerColor)}
        onMouseLeave={() => setDividerColor("bg-futarchyGray4")}
      >
        <div
          className={`absolute inset-0 opacity-0 hover:opacity-100
                     transition-opacity duration-300`}
        />
        <span
          className="flex items-center gap-2 relative z-10
                      transition-colors duration-300 justify-between"
        >
          <CheckIcon fill={currentColors.top.iconFill} />
          <span className="font-oxanium text-sm leading-5">{displayApproval}</span>
        </span>
      </button>

      {/* Divider line */}
      <div className={`w-0.5 transition-colors duration-300 relative z-10 ${dividerColor}`}></div>

      {/* Bottom Button */}
      <button
        className={`relative overflow-hidden px-3 py-2 border-2 border-l-0 rounded-r-lg w-1/2 
                    transition-all duration-300
                    ${currentColors.bottom.border} ${currentColors.bottom.text} ${currentColors.bottom.hover}
                    ${currentColors.bottom.background}`}
        onMouseEnter={() => setDividerColor(currentColors.bottom.dividerColor)}
        onMouseLeave={() => setDividerColor("bg-futarchyGray4")}
      >
        <div
          className={`absolute inset-0 opacity-0 hover:opacity-100
                     transition-opacity duration-300`}
        />
        <span
          className="flex items-center gap-2 relative z-10
                      transition-colors duration-300 justify-between"
        >
          <CancelIcon fill={currentColors.bottom.iconFill} />
          <span className="font-oxanium text-sm leading-5">{displayRefusal}</span>
        </span>
      </button>
    </div>
  );
};

export const ProposalsCard = ({
  proposalID,
  proposalTitle,
  approvalStatus,
  countdownFinish,
  timestamp,
  endTime,
  tags,
  prices,
  image,
  useStorybookUrl = false,
  proposalsDocMarket = [{}],
  impact = "28.71%",
  eventProbability = "51%",
  metadata,
}) => {
  const statusStyles = {
    approved: {
      gradient: "from-futarchyBlue4 to-transparent rounded-t-xl",
      hoverGradient: "from-futarchyBlue7 to-transparent rounded-t-xl",
      border: "border-futarchyBlue3",
    },
    refused: {
      gradient: "from-futarchyGold4 to-transparent rounded-t-xl",
      hoverGradient: "from-futarchyGold7 to-transparent rounded-t-xl",
      border: "border-futarchyGold3",
    },
    ongoing: {
      gradient: "from-futarchyGreen4 to-transparent rounded-t-xl",
      hoverGradient: "from-futarchyGreen7 to-transparent rounded-t-xl",
      border: "border-futarchyGreen3",
    },
  };

  const currentStyle = statusStyles[approvalStatus] || statusStyles.ongoing;

  return (
    <div className="w-[392px] h-[334px] rounded-xl overflow-hidden border border-futarchyGray62 dark:border-futarchyDarkGray42 bg-white dark:bg-futarchyDarkGray3 shadow-sm">
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <h3 className="text-xl font-semibold text-futarchyGray12 dark:text-white mb-2">
              {proposalTitle}
            </h3>
            <div className="flex items-center gap-2">
              <div className="py-1 px-2 bg-white/10 rounded-full text-futarchyGray11 dark:text-futarchyGray112 text-xs leading-4 border border-futarchyGray4 dark:border-futarchyDarkGray42">
                {tags}
              </div>
              <ProposalStatus approvalStatus={approvalStatus} />
            </div>
          </div>
          {image && (
            <div className="w-24 h-24 rounded-xl overflow-hidden">
              <Image
                src={image}
                alt="Proposal Image"
                layout="fill"
                objectFit="cover"
                className="opacity-100"
              />
            </div>
          )}
        </div>
        <p className="text-sm text-futarchyGray11 dark:text-futarchyGray112 mb-4 line-clamp-3">
          {tags}
        </p>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="text-xs text-futarchyGray11 dark:text-futarchyGray112">
              <Timestamp
                countdownFinish={countdownFinish}
                timestamp={timestamp}
                endTime={endTime}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-futarchyGray11">Impact:</span>
              <span className={`font-medium text-lg ${
                parseFloat(impact) >= 0 
                  ? 'text-futarchyTeal9' 
                  : 'text-futarchyCrimson9'
              }`}>
                {parseFloat(impact) >= 0 ? '+' : ''}{impact}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-futarchyGray11">Event Probability:</span>
              <span className="font-medium text-futarchyGray12">
                {eventProbability}
              </span>
            </div>
          </div>
          <a
            href={`/markets/${proposalID}`}
            className="py-2 px-4 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:bg-black/90 dark:hover:bg-white/90 transition-colors"
          >
            View Details
          </a>
        </div>
      </div>
    </div>
  );
};

export const MobileProposalsCard = ({
  proposalID,
  proposalTitle,
  approvalStatus,
  countdownFinish,
  timestamp,
  endTime,
  tags,
  prices,
  image,
  useStorybookUrl = false,
  proposalsDocMarket = [{}],
  impact = "28.71%",
  eventProbability = "51%",
  metadata,
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

  const currentGradient = gradientStyles[approvalStatus] || gradientStyles.ongoing;

  return (
    <div className="w-[304px] h-[316px] rounded-xl overflow-hidden border border-futarchyGray62 dark:border-futarchyDarkGray42 bg-white dark:bg-futarchyDarkGray3 shadow-sm">
      <div className="p-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <h3 className="text-xl font-semibold text-futarchyGray12 dark:text-white mb-2">
              {proposalTitle}
            </h3>
            <div className="flex items-center gap-2">
              <div className="py-1 px-2 bg-white/10 rounded-full text-futarchyGray11 dark:text-futarchyGray112 text-xs leading-4 border border-futarchyGray4 dark:border-futarchyDarkGray42">
                {tags}
              </div>
              <ProposalStatus approvalStatus={approvalStatus} />
            </div>
          </div>
          {image && (
            <div className="w-24 h-24 rounded-xl overflow-hidden">
              <Image
                src={image}
                alt="Proposal Image"
                layout="fill"
                objectFit="cover"
                className="opacity-100"
              />
            </div>
          )}
        </div>
        <p className="text-sm text-futarchyGray11 dark:text-futarchyGray112 mb-4 line-clamp-3">
          {tags}
        </p>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="text-xs text-futarchyGray11 dark:text-futarchyGray112">
              <Timestamp
                countdownFinish={countdownFinish}
                timestamp={timestamp}
                endTime={endTime}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-futarchyGray11">Impact:</span>
              <span className={`font-medium text-sm ${
                parseFloat(impact) >= 0 
                  ? 'text-futarchyTeal9' 
                  : 'text-futarchyCrimson9'
              }`}>
                {parseFloat(impact) >= 0 ? '+' : ''}{impact}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-futarchyGray11">Event Probability:</span>
              <span className="font-medium text-futarchyGray12">
                {eventProbability}
              </span>
            </div>
          </div>
          <a
            href={`/markets/${proposalID}`}
            className="py-2 px-4 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:bg-black/90 dark:hover:bg-white/90 transition-colors"
          >
            View Details
          </a>
        </div>
      </div>
    </div>
  );
};
