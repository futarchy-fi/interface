import React, { useState, useEffect } from "react";
import { useAccount } from 'wagmi';
import RootLayout from "../../../layout/RootLayout";
import { fetchHighlightData } from "./HighlightDataTransformer";
import { fetchEventHighlightData } from "./EventsHighlightDataTransformer";

import CompaniesListCarousel from "../components/CompaniesListCarousel";
import { OrganizationsTable } from "../table";
import { useAggregatorCompanies } from "../../../../hooks/useAggregatorCompanies";
import { DEFAULT_AGGREGATOR } from "../../../../config/subgraphEndpoints";
import EventsHighlightCarousel from "../components/EventsHighlightCarousel";
import ResolvedEventsCarousel from "../components/ResolvedEventsCarousel";
import PageLayout from "../../../layout/PageLayout";
import DynamicShareCard from "../../../dynamicImageFolder/DynamicShareCard";
import CreateProposalModal from "../../../debug/CreateProposalModal";
import OrganizationManagerModal from "../../../debug/OrganizationManagerModal";
import EditProposalModal from "../../../debug/EditProposalModal";
import { CONTRACT_ADDRESSES } from "../../marketPage/constants/contracts";
import { ENABLE_V2_SUBGRAPH } from "../../../../config/featureFlags";

// Configuration flags
// Recently Resolved now works with V2 subgraph via fetchProposalsFromAggregator
const HIDE_RECENTLY_RESOLVED = false;

const CompaniesPage = ({ useStorybookUrl = false }) => {
  const { address: connectedWallet } = useAccount();
  const [isCarouselLoading, setIsCarouselLoading] = useState(true);
  const [isEventsCarouselLoading, setIsEventsCarouselLoading] = useState(true);
  const [isResolvedCarouselLoading, setIsResolvedCarouselLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isCreateProposalOpen, setIsCreateProposalOpen] = useState(false);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [aggregatorAddress, setAggregatorAddress] = useState(null);
  // Edit Proposal Modal state (Registry is always on Gnosis, no chainId needed)
  const [editProposalModal, setEditProposalModal] = useState({ isOpen: false, proposalMetadataAddress: null });

  // Fetch organizations for table view
  const effectiveAggregator = ENABLE_V2_SUBGRAPH ? DEFAULT_AGGREGATOR : aggregatorAddress;
  const { companies: organizations, loading: orgsLoading } = useAggregatorCompanies(effectiveAggregator);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      setDebugMode(urlParams.get('debugMode') === 'true');

      // Check for useAggregator param to load companies from subgraph
      const aggregator = urlParams.get('useAggregator');
      if (aggregator) {
        setAggregatorAddress(aggregator);
      }
    }
  }, []);

  // Load highlights data
  useEffect(() => {
    const loadHighlights = async () => {
      try {
        await fetchHighlightData();
        setIsCarouselLoading(false);
      } catch (error) {
        console.error("Error loading highlights:", error);
        setIsCarouselLoading(false);
      }
    };

    const loadEventHighlights = async () => {
      try {
        await fetchEventHighlightData("all"); // Fetch highlights from all companies
        setIsEventsCarouselLoading(false);
      } catch (error) {
        console.error("Error loading event highlights:", error);
        setIsEventsCarouselLoading(false);
      }
    };

    const loadResolvedEventHighlights = async () => {
      try {
        // Don't need to import since it will be imported by the ResolvedEventsCarousel component
        setIsResolvedCarouselLoading(false);
      } catch (error) {
        console.error("Error loading resolved event highlights:", error);
        setIsResolvedCarouselLoading(false);
      }
    };

    loadHighlights();
    loadEventHighlights();
    loadResolvedEventHighlights();
  }, []);



  return (
    <RootLayout
      headerConfig="app"
      footerConfig="main"
    >
      <PageLayout>
        {/* Active Milestones Section */}
        <div className="mb-12 mt-4">
          <h2 className="text-2xl font-semibold text-futarchyGray12 dark:text-white mb-6">
            Active Milestones
          </h2>
          {isEventsCarouselLoading ? (
            <div className="flex justify-center items-center h-[200px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-futarchyLavender"></div>
            </div>
          ) : (
            <EventsHighlightCarousel
              companyId="all"
              useStorybookUrl={useStorybookUrl}
              aggregatorAddress={aggregatorAddress}
              connectedWallet={connectedWallet}
              onEditProposal={(proposalMetadataAddress) => {
                setEditProposalModal({ isOpen: true, proposalMetadataAddress });
              }}
            />
          )}
        </div>

        {/* Recently Resolved Section */}
        {!HIDE_RECENTLY_RESOLVED && (
          <div className="mb-12 mt-8 md:mt-10">
            <h2 className="text-2xl font-semibold text-futarchyGray12 dark:text-white mb-6">
              Recently Resolved
            </h2>
            {isResolvedCarouselLoading ? (
              <div className="flex justify-center items-center h-[200px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            ) : (
              <ResolvedEventsCarousel
                companyId="all"
                limit={10}
                aggregatorAddress={DEFAULT_AGGREGATOR}
                connectedWallet={connectedWallet}
                onEditProposal={(proposalMetadataAddress) => {
                  setEditProposalModal({ isOpen: true, proposalMetadataAddress });
                }}
              />
            )}
          </div>
        )}

        {/* Organizations Section Header */}
        <div className="mb-6 mt-12">
          <h2 className="text-2xl font-semibold text-futarchyGray12 dark:text-white mb-6">
            Organizations
          </h2>
        </div>

        {/* Organizations Table (Desktop) */}
        <div className="hidden md:block">
          <OrganizationsTable
            organizations={organizations}
            connectedWallet={connectedWallet}
            loading={orgsLoading}
            onOrgClick={(org) => {
              // Navigate to milestones page
              const url = `/milestones?company_id=${org.companyID}`;
              window.location.href = url;
            }}
          />
        </div>

        {/* Companies Carousel (Mobile Fallback) */}
        <div className="md:hidden">
          <CompaniesListCarousel useStorybookUrl={useStorybookUrl} />
        </div>
      </PageLayout>

      {debugMode && (
        <>
          {/* Debug Mode: Share Button */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="fixed left-4 bottom-4 z-50 bg-futarchyBlue9 hover:bg-futarchyBlue10 text-white font-bold py-3 px-4 rounded-full shadow-lg transition-colors duration-200"
          >
            <span className="text-xl">📤</span>
          </button>

          {/* Debug Mode: Create Proposal Button */}
          <button
            onClick={() => setIsCreateProposalOpen(true)}
            className="fixed right-4 bottom-4 z-50 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold py-3 px-5 rounded-full shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <span className="text-xl">🏛️</span>
            <span>Create Proposal</span>
          </button>

          <DynamicShareCard
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
          />

          <CreateProposalModal
            isOpen={isCreateProposalOpen}
            onClose={() => setIsCreateProposalOpen(false)}
          />

          {/* Debug Mode: Create Organization Button */}
          <button
            onClick={() => setIsOrgModalOpen(true)}
            className="fixed right-4 bottom-20 z-50 bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white font-bold py-3 px-5 rounded-full shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <span>Manage Aggregator</span>
          </button>

          <OrganizationManagerModal
            isOpen={isOrgModalOpen}
            onClose={() => setIsOrgModalOpen(false)}
            mode="aggregator"
            entityId={aggregatorAddress || CONTRACT_ADDRESSES.DEFAULT_AGGREGATOR}
          />
        </>
      )}

      {/* Edit Proposal Modal - Registry contracts are always on Gnosis */}
      <EditProposalModal
        isOpen={editProposalModal.isOpen}
        onClose={() => setEditProposalModal({ isOpen: false, proposalMetadataAddress: null })}
        proposalMetadataAddress={editProposalModal.proposalMetadataAddress}
      />
    </RootLayout>
  );
};

export default CompaniesPage;
