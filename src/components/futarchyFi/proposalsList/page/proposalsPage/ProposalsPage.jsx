import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ProposalsCard, MobileProposalsCard } from "../../cards/ProposalsCard";
import Image from "next/image";
import RootLayout from "../../../../layout/RootLayout";
import {
  DropdownListIcon,
  DropdownCheckIcon,
  DropdownCancelIcon,
  DropdownOngoingIcon,
} from "../../cards/Resources";
import CustomDropdown from "../../components/CustomDropdown";
import SearchBox from "../../components/SearchBox";
import { fetchCompanyData } from "./ProposalsPageDataTransformer";
import ProposalsListCarousel from "../../components/ProposalsListCarousel";
import PageHeader from "../../../../layout/PageHeader";
import PageLayout from "../../../../layout/PageLayout";

const PROPOSAL_IMAGES = {
  "ethereum-budget": "/assets/ethereum-budget-picture.png",
  "gnosis-pay": "/assets/gnosis-pay.png",
  "protocol-upgrade": "/assets/protocol-update-picture.png",
};

const getImageKey = (proposal) => {
  // Default image
  let imageKey = "gnosis-pay";

  try {
    const title = (proposal.proposalTitle || "").toLowerCase();
    const id = (proposal.proposalID || "").toLowerCase();

    if (title.includes("budget") || id.includes("budget")) {
      imageKey = "ethereum-budget";
    } else if (title.includes("buyback") || id.includes("buyback")) {
      imageKey = "ethereum-buyback";
    } else if (title.includes("protocol") || title.includes("upgrade")) {
      imageKey = "protocol-upgrade";
    }
  } catch (error) {
    console.warn("Error determining image key:", error);
  }

  return imageKey;
};

const ProposalsPage = ({
  initialCompanyId = "gnosis",
  preserveHash = false,
  useNewCards = false,
}) => {
  const [activeFilter, setActiveFilter] = useState("All");
  const [proposals, setProposals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [companyData, setCompanyData] = useState(null);
  const [isLoadingCompany, setIsLoadingCompany] = useState(true);

  // Check for debug mode
  const [debugMode, setDebugMode] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      setDebugMode(urlParams.get('debugMode') === 'true');
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && !preserveHash) {
      window.history.pushState({}, "", `/${initialCompanyId}/milestones`);
    }
  }, [initialCompanyId, preserveHash]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setIsLoadingCompany(true);
        const data = await fetchCompanyData(initialCompanyId, false);
        setCompanyData(data);

        if (!data.proposals) {
          console.warn("No proposals data received");
          setProposals([]);
        } else {
          const proposalsWithImages = data.proposals.map((proposal) => ({
            ...proposal,
            image:
              PROPOSAL_IMAGES[getImageKey(proposal)] ||
              PROPOSAL_IMAGES["gnosis-pay"],
          }));

          setProposals(proposalsWithImages);
        }
        setError(null);
      } catch (err) {
        setError(err.message || "Failed to load data");
        console.error("Error loading data:", err);
        setProposals([]);
        setCompanyData(null);
      } finally {
        setIsLoading(false);
        setIsLoadingCompany(false);
      }
    };

    loadData();
  }, [initialCompanyId]);

  // Update the filter options structure
  const filterOptions = [
    { value: "All", label: "All Milestones", icon: DropdownListIcon },
    { value: "Active", label: "Active", icon: DropdownOngoingIcon },
    { value: "Approved", label: "Approved", icon: DropdownCheckIcon },
    { value: "Refused", label: "Refused", icon: DropdownCancelIcon },
  ];

  // Update the filter logic to handle new options and debug mode
  const filteredProposals = (proposals || []).filter((proposal) => {
    // First apply debug mode filtering - hide pending_review unless debug mode is on
    if (proposal.approvalStatus === "pending_review" && !debugMode) {
      return false;
    }

    const titleMatch =
      proposal.proposalTitle
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ?? false;
    const statusMatch = (() => {
      switch (activeFilter) {
        case "All":
          return true;
        case "Active":
          return proposal.approvalStatus === "ongoing" || proposal.approvalStatus === "on_going";
        case "Approved":
          return proposal.approvalStatus === "approved";
        case "Refused":
          return proposal.approvalStatus === "refused";
        default:
          return false;
      }
    })();
    return titleMatch && statusMatch;
  });

  // Calculate active proposals count
  const activeProposalsCount = useMemo(() => {
    return proposals.filter((proposal) => 
      proposal.approvalStatus === "ongoing" || proposal.approvalStatus === "on_going"
    ).length;
  }, [proposals]);

  // Calculate total visible milestones count (respecting debug mode)
  const visibleMilestonesCount = useMemo(() => {
    return proposals.filter((proposal) => {
      // Hide pending_review unless debug mode is on
      if (proposal.approvalStatus === "pending_review" && !debugMode) {
        return false;
      }
      return true;
    }).length;
  }, [proposals, debugMode]);

  const heroContent = useMemo(() => {
    if (isLoadingCompany) {
  return (
          <div className="relative bg-gradient-to-r from-futarchyDarkGray2 via-futarchyDarkGray2 to-futarchyDarkGray2/90 pt-20 font-oxanium">
            <div className="flex justify-center items-center min-h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-futarchyLavender"></div>
            </div>
          </div>
      );
    }
    if (companyData) {
      return (
            <PageHeader title={companyData.name} logoSrc={companyData.logo} logoAlt={`${companyData.name} Logo`}>
              <div className="flex flex-col items-start gap-8 w-full">
                <div className="flex gap-3">
                  {activeProposalsCount > 0 && (
                    <div className="py-1 px-2 bg-futarchyEmerald3 rounded-full text-futarchyEmerald11 text-sm leading-4 border border-futarchyEmerald6 flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-futarchyEmerald11 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-futarchyEmerald11"></span>
                      </span>
                      {activeProposalsCount} Active Milestone
                      {activeProposalsCount !== 1 ? "s" : ""}
                    </div>
                  )}
                  <div className="py-1 px-2 bg-white/10 rounded-full text-futarchyGray112 text-sm leading-4 border border-futarchyGray6">
                    {companyData.currencyToken}
                  </div>
                </div>

                <p className="text-sm lg:text-base text-white/70 leading-relaxed lg:w-2/3">
                  {companyData.description}
                </p>

                <div className="flex flex-col md:grid md:grid-cols-3 md:gap-8 gap-4 justify-between">
                  <div className="w-full md:w-[167px] lg:py-7 lg:px-10 lg:w-[286px] h-[88px] lg:h-auto p-4 border border-futarchyGray6 bg-futarchyDarkGray3 rounded-xl shadow-[inset_0_0_12px_rgba(255,255,255,0.1)] md:justify-self-start">
                    <p className="text-xl lg:text-4xl text-futarchyGray122 font-semibold text-center lg:leading-10 leading-8">
                      {visibleMilestonesCount}
                    </p>
                    <p className="text-sm lg:text-[22px] text-futarchyGray112 font-normal text-center lg:leading-9 leading-6">
                      Milestones
                    </p>
                  </div>
                </div>
              </div>
            </PageHeader>
      );
    }
    return null;
  }, [isLoadingCompany, companyData, activeProposalsCount, visibleMilestonesCount]);

  return (
    <RootLayout
      headerConfig="app"
      footerConfig="main"
    >
      <PageLayout hero={heroContent} contentClassName="pt-10 z-10 select-none">
        {/* Test div for new market page */}
     {/*   <div className="my-4 p-4 border border-dashed border-futarchyGray8 dark:border-futarchyDarkGray8 rounded-md">
          <p className="text-sm text-futarchyGray11 dark:text-futarchyGray112 mb-2">
            Test Area: Link to new Market Page
          </p>
          <Link href="/markets/new" className="text-futarchyBlue11 hover:underline">
            Go to new Market Page
          </Link>
        </div>*/}
        {/* Filter Controls */}
        <div className="flex flex-col md:flex-row gap-4 justify-center md:justify-between items-center">
          <div className="hidden w-full md:w-auto flex flex-col md:flex-row gap-4">
            <SearchBox value={searchQuery} onChange={setSearchQuery} />
          </div>
          <div className="w-full md:w-auto">
            <CustomDropdown
              options={filterOptions}
              value={activeFilter}
              onChange={setActiveFilter}
            />
          </div>
        </div>

        {useNewCards ? (
          <div className="mt-8">
            <ProposalsListCarousel proposals={filteredProposals} isLoading={isLoading} />
          </div>
        ) : (
          <>
            {/* Proposals Section */}
            <div className="text-2xl text-futarchyDarkGray4 dark:text-futarchyGray3 font-semibold mt-8">
              <span>Proposals</span>
            </div>
            <div className="text-sm text-futarchyDarkGray4/70 dark:text-futarchyGray112/80 font-medium">
              Fully realized proposals with all features and comprehensive
              data where functionalities meet their full expression
            </div>
            <div className="mt-6">
              <div className="mt-2">
                {isLoading ? (
                  <div className="flex justify-center items-center min-h-[200px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-futarchyLavender"></div>
                  </div>
                ) : error ? (
                  <div className="text-center text-futarchyCrimson11 py-8">
                    {error}
                  </div>
                ) : filteredProposals.length === 0 ? (
                  <div className="text-center text-black dark:text-futarchyGray112 py-8">
                    No milestones found matching your criteria.
                  </div>
                ) : (
                  <>
                    <div
                      className="grid auto-rows-fr gap-6 md:gap-8 justify-center"
                      style={{
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(304px, 1fr))",
                        "@media (minWidth: 768px)": {
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(392px, 1fr))",
                        },
                        maxWidth: "1280px",
                        margin: "0 auto",
                      }}
                    >
                      {filteredProposals.map((proposal) => (
                        <div
                          key={proposal.proposalID || proposal.proposalTitle}
                          className="flex justify-start"
                        >
                          <div className="hidden md:block">
                            <ProposalsCard
                              {...proposal}
                              resolutionStatus={proposal.resolution_status}
                            />
                          </div>
                          <div className="block md:hidden">
                            <MobileProposalsCard
                              {...proposal}
                              resolutionStatus={proposal.resolution_status}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </PageLayout>
    </RootLayout>
  );
};

export default ProposalsPage;
