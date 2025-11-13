import React, { useState, useEffect } from "react";
import Image from 'next/image';
import { CheckIcon, CancelIcon, NewspaperIcon, EyeIcon, LoadingSpinner } from './Icons';

// --- ICONS ---
// These are self-contained for simplicity.

// --- STYLING & CONFIG ---
const statusColors = {
  ongoing: {
    top: { 
      border: "border-futarchyBlue5 hover:border-futarchyBlue7 dark:border-futarchyBlue9 dark:hover:border-futarchyBlue7", 
      text: "text-futarchyBlue11 dark:text-futarchyBlue9 dark:hover:text-futarchyBlue7", 
      background: "bg-futarchyBlue4 hover:bg-futarchyBlue5 dark:bg-transparent", 
      iconFill: "currentColor" 
    },
    bottom: { 
      border: "border-futarchyGold5 hover:border-futarchyGold7 dark:border-futarchyGold7 dark:hover:border-futarchyGold5", 
      text: "text-futarchyGold11 dark:text-futarchyGold7 dark:hover:text-futarchyGold5", 
      background: "bg-futarchyGold4 hover:bg-futarchyGold5 dark:bg-transparent", 
      iconFill: "currentColor" 
    },
  },
  approved: {
    top: { 
      border: "border-futarchyBlue6 hover:border-futarchyBlue9 dark:border-futarchyBlue9 dark:hover:border-futarchyBlue7", 
      text: "text-futarchyBlue11 dark:text-futarchyBlue9 dark:hover:text-futarchyBlue7", 
      background: "bg-futarchyBlue5 hover:bg-futarchyBlue6 dark:bg-transparent", 
      iconFill: "currentColor" 
    },
    bottom: { 
      border: "border-futarchyGold4 hover:border-futarchyGold6 dark:border-futarchyGold5 dark:hover:border-futarchyGold4", 
      text: "text-futarchyGold7 dark:text-futarchyGold5 dark:hover:text-futarchyGold4", 
      background: "bg-futarchyGold3 hover:bg-futarchyGold4 dark:bg-transparent", 
      iconFill: "currentColor" 
    },
  },
  refused: {
    top: { 
      border: "border-futarchyBlue4 hover:border-futarchyBlue6 dark:border-futarchyBlue5 dark:hover:border-futarchyBlue4", 
      text: "text-futarchyBlue7 dark:text-futarchyBlue5 dark:hover:text-futarchyBlue4", 
      background: "bg-futarchyBlue3 hover:bg-futarchyBlue4 dark:bg-transparent", 
      iconFill: "currentColor" 
    },
    bottom: { 
      border: "border-futarchyGold6 hover:border-futarchyGold9 dark:border-futarchyGold9 dark:hover:border-futarchyGold7", 
      text: "text-futarchyGold11 dark:text-futarchyGold9 dark:hover:text-futarchyGold7", 
      background: "bg-futarchyGold5 hover:bg-futarchyGold6 dark:bg-transparent", 
      iconFill: "currentColor" 
    },
  },
};

const statusStyles = {
    approved: { gradient: "from-futarchyBlue4 to-transparent", hoverGradient: "from-futarchyBlue7 to-transparent" },
    refused: { gradient: "from-futarchyGold4 to-transparent", hoverGradient: "from-futarchyGold7 to-transparent" },
    ongoing: { gradient: "from-futarchyGreen4 to-transparent", hoverGradient: "from-futarchyGreen7 to-transparent" },
};


// --- SUB-COMPONENTS ---
const Timestamp = ({ endTime }) => {
  const [remainingTime, setRemainingTime] = useState("");

  useEffect(() => {
    if (!endTime) return;

    const updateRemainingTime = () => {
      const now = Date.now() / 1000;
      const timeLeft = endTime - now;

      if (timeLeft <= 0) {
        const endDate = new Date(endTime * 1000).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        setRemainingTime(`Ended on: ${endDate}`);
      } else {
        const days = Math.floor(timeLeft / 86400);
        const hours = Math.floor((timeLeft % 86400) / 3600);
        const minutes = Math.floor((timeLeft % 3600) / 60);
        
        let timeString = '';
        if (days > 0) timeString += `${days}d `;
        if (hours > 0 || days > 0) timeString += `${hours}h `;
        timeString += `${minutes}m`;
        
        setRemainingTime(`Remaining Time: ${timeString}`);
      }
    };

    updateRemainingTime();
    const interval = setInterval(updateRemainingTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [endTime]);

  return (
    <div className="w-fit px-2 py-0.5 text-start rounded-full text-xs bg-futarchyGold9/35 border border-futarchyGold9 text-futarchyGold11 dark:border-futarchyGold6 dark:bg-futarchyGold7/15 dark:text-futarchyGold6 font-medium">
      {remainingTime || '...'}
    </div>
  );
};

const ProposalStatus = ({ approvalStatus }) => {
  const { borderColor, textColor, bgColor, statusText } = (() => {
    switch (approvalStatus) {
      case "approved": return { borderColor: "border-futarchyBlue6 dark:border-futarchyBlue5", textColor: "text-futarchyBlue11 dark:text-futarchyBlue5 dark:font-medium", bgColor: "bg-futarchyBlue3 dark:bg-transparent", statusText: "Approved" };
      case "refused": return { borderColor: "border-futarchyGold6 dark:border-futarchyGold5", textColor: "text-futarchyGold11 dark:text-futarchyGold5 dark:font-medium", bgColor: "bg-futarchyGold3 dark:bg-transparent", statusText: "Refused" };
      default: return { borderColor: "border-futarchyTeal7 dark:border-futarchyTeal5", textColor: "text-futarchyTeal9 dark:text-futarchyTeal5 dark:font-medium", bgColor: "bg-futarchyTeal3 dark:bg-transparent", statusText: "Ongoing" };
    }
  })();

  return (
    <div className="flex">
      <div className={`inline-flex items-center justify-center rounded-full py-0.5 px-2 ${borderColor} ${textColor} ${bgColor} border font-medium text-xs leading-4 whitespace-nowrap`}>
        {statusText}
      </div>
    </div>
  );
};

const ProposalsPrices = ({ approvalPrice, refusalPrice, approvalStatus, isLoading }) => {
  const currentColors = statusColors[approvalStatus] || statusColors.ongoing;

  const displayApproval = isLoading ? <LoadingSpinner /> : (typeof approvalPrice === 'number' ? `$${approvalPrice.toFixed(2)}` : "N/A");
  const displayRefusal = isLoading ? <LoadingSpinner /> : (typeof refusalPrice === 'number' ? `$${refusalPrice.toFixed(2)}` : "N/A");

  return (
    <div className="flex relative">
      <button className={`relative overflow-hidden px-3 py-2 rounded-l-lg w-1/2 transition-all duration-300 ${currentColors.top.text} ${currentColors.top.background} ${currentColors.top.border} border-t-2 border-l-2 border-b-2 border-r`} disabled={isLoading}>
        <span className="flex items-center gap-2 relative z-10 transition-colors duration-300 justify-between">
          <CheckIcon fill={currentColors.top.iconFill} />
          <span className="font-oxanium text-xs leading-4 min-h-[16px] flex items-center">{displayApproval}</span>
        </span>
      </button>
      <button className={`relative overflow-hidden px-3 py-2 rounded-r-lg w-1/2 transition-all duration-300 ${currentColors.bottom.text} ${currentColors.bottom.background} ${currentColors.bottom.border} border-t-2 border-r-2 border-b-2 border-l`} disabled={isLoading}>
        <span className="flex items-center gap-2 relative z-10 transition-colors duration-300 justify-between">
          <CancelIcon fill={currentColors.bottom.iconFill} />
          <span className="font-oxanium text-xs leading-4 min-h-[16px] flex items-center">{displayRefusal}</span>
        </span>
      </button>
    </div>
  );
};

const ProposalActions = ({ proposalID }) => (
    <div className="flex flex-row gap-1 items-center text-sm font-light select-none justify-between">
        <a href={`/markets/${proposalID}`} className="bg-futarchyGray2 dark:bg-futarchyDarkGray2 border-2 border-futarchyGray4 dark:border-futarchyGray112/40 rounded-xl w-full py-3 px-[14px] text-center flex flex-row justify-center items-center gap-[6px]">
            <EyeIcon className="w-5 h-5 text-futarchyGray11 dark:text-futarchyGray3" />
            <span className="relative z-10 text-sm font-semibold text-futarchyGray12 dark:text-futarchyGray3">View Market</span>
        </a>
    </div>
);


// --- MAIN COMPONENT ---
export const ProposalsCard = ({
  proposalID,
  proposalTitle,
  approvalStatus = 'ongoing',
  endTime,
  image,
  approvalPrice,
  refusalPrice,
  impact,
  eventProbability,
  isLoading = false,
}) => {

  return (
    <a href={`/markets/${proposalID}`} className="group relative block border-2 border-futarchyGray62 dark:border-futarchyGray11/70 rounded-3xl w-full md:w-[340px] shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden bg-futarchyGray3 dark:bg-futarchyDarkGray2">
      <div className="relative w-full h-[430px]">
        {/* Top Section: Positioned behind and moves up on hover */}
        <div className="absolute top-0 left-0 right-0 z-0 transition-transform duration-300 ease-in-out group-hover:-translate-y-4">
            <div className="bg-futarchyGray2 dark:bg-transparent p-4 pb-0">
                <div className="relative h-[180px] overflow-hidden rounded-2xl border-2 border-futarchyGray62 dark:border-futarchyGray11/70">
                    {/* Image Layer */}
                    {image && (
                        <div className="absolute inset-0 z-0">
                            <Image
                                src={image}
                                alt="Proposal Image"
                                layout="fill"
                                objectFit="cover"
                            />
                        </div>
                    )}
                    {/* Shine Effect Layer */}
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/60 to-transparent transform -translate-x-full -skew-x-12 group-hover:translate-x-full transition-transform duration-700 ease-in-out z-20"></div>
                </div>
            </div>
        </div>
        
        {/* Bottom Section: Positioned on top and static */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          {/* Divider */}
          <div className="border-t-2 border-futarchyGray62 dark:border-futarchyGray11/70"></div>
          
          {/* Bottom Section Content */}
          <div className="p-4 bg-futarchyGray3 dark:bg-futarchyDarkGray3">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col border-2 border-futarchyGray62 dark:border-futarchyGray112/40 bg-futarchyGray2 dark:bg-futarchyDarkGray2 rounded-2xl">
                    <div className="flex flex-row justify-between items-center p-3 bg-transparent rounded-t-xl border-b-2 border-futarchyGray62 dark:border-futarchyGray112/40">
                        <Timestamp endTime={endTime} />
                        <ProposalStatus approvalStatus={approvalStatus} />
                    </div>
                    <div className="flex flex-col p-3 gap-3">
                        <h3 className="text-sm font-bold font-oxanium text-futarchyDarkGray3 dark:text-futarchyGray3 leading-5 line-clamp-2 min-h-[40px]" data-testid={`proposal-card-title-${proposalID}`} title={proposalTitle}>
                          {proposalTitle}
                        </h3>
                        <ProposalsPrices approvalPrice={approvalPrice} refusalPrice={refusalPrice} approvalStatus={approvalStatus} isLoading={isLoading} />
                        <div className="flex flex-row justify-between items-center text-sm gap-2">
                          <div className="flex justify-start items-center gap-1">
                            <span className="text-futarchyGray11 dark:text-white/80">Impact:</span>
                            {isLoading ? <LoadingSpinner className="h-3 w-3" /> : (
                              <span className={`font-medium text-sm ${(impact && parseFloat(impact) >= 0) ? 'text-futarchyTeal9' : 'text-futarchyCrimson9'}`}>
                                {impact || "N/A"}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-start items-center gap-1">
                            <span className="text-futarchyGray11 dark:text-white/80">Event Probability:</span>
                            {isLoading ? <LoadingSpinner className="h-3 w-3" /> : (
                              <span className="font-medium text-futarchyViolet11 dark:text-futarchyViolet9 text-sm">
                                {eventProbability || "N/A"}
                              </span>
                            )}
                          </div>
                        </div>
                    </div>
                </div>
                <ProposalActions proposalID={proposalID} />
            </div>
          </div>
        </div>
      </div>
    </a>
  );
};


// --- MOCK DATA ---
export const mockProposal = {
  proposalID: '0x123456789',
  proposalTitle: 'Should Futarchy Labs increase the marketing budget by 20% for Q3?',
  approvalStatus: 'ongoing',
  endTime: Math.floor(Date.now() / 1000) + (5 * 24 * 60 * 60), // 5 days from now
  image: '/assets/shareDashboard/BG.png', // Placeholder image
  approvalPrice: 0.58,
  refusalPrice: 0.42,
  impact: '+8.50%',
  eventProbability: '58.00%',
  isLoading: false,
};

export const mockProposalLoading = {
    ...mockProposal,
    isLoading: true,
};

export const mockProposalApproved = {
    ...mockProposal,
    approvalStatus: 'approved',
    endTime: Math.floor(Date.now() / 1000) - (2 * 24 * 60 * 60), // Ended 2 days ago
};
