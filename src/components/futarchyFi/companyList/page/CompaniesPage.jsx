import React, { useState, useEffect } from "react";
import RootLayout from "../../../layout/RootLayout";
import { fetchHighlightData } from "./HighlightDataTransformer";
import { fetchEventHighlightData } from "./EventsHighlightDataTransformer";
import FireTheCeoPromoBanner from "../components/FireTheCeoPromoBanner";
import CompaniesListCarousel from "../components/CompaniesListCarousel";
import EventsHighlightCarousel from "../components/EventsHighlightCarousel";
import ResolvedEventsCarousel from "../components/ResolvedEventsCarousel";
import PageLayout from "../../../layout/PageLayout";

// Configuration flags
const HIDE_RECENTLY_RESOLVED = false; // Set to true only if the Recently Resolved section needs to be temporarily hidden

const CompaniesPage = ({ useStorybookUrl = false }) => {
  const [isCarouselLoading, setIsCarouselLoading] = useState(true);
  const [isEventsCarouselLoading, setIsEventsCarouselLoading] = useState(true);
  const [isResolvedCarouselLoading, setIsResolvedCarouselLoading] = useState(true);


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
            {/* Fire the CEO Section */}
            <div className="mt-8 md:mt-10">
              <FireTheCeoPromoBanner />
            </div>

            {/* Active Milestones Section */}
            <div className="mb-12 mt-8 md:mt-10">
              <h2 className="mt-16 text-2xl font-semibold text-futarchyGray12 dark:text-white mb-6">
                Active Milestones
              </h2>
              {isEventsCarouselLoading ? (
                <div className="flex justify-center items-center h-[200px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-futarchyLavender"></div>
                </div>
              ) : (
                <EventsHighlightCarousel companyId="all" useStorybookUrl={useStorybookUrl} />
              )}
            </div>

            {/* Recent Resolved Section */}
            {!HIDE_RECENTLY_RESOLVED && (
              <div className="mb-12 mt-8 md:mt-10">
                <h2 className="text-2xl font-semibold text-futarchyGray12 dark:text-white mb-6">
                  Recent Resolved
                </h2>
                {isResolvedCarouselLoading ? (
                  <div className="flex justify-center items-center h-[200px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                  </div>
                ) : (
                  <ResolvedEventsCarousel companyId="all" limit={10} />
                )}
              </div>
            )}

            {/* Companies Section Header */}
            <div className="mb-6 mt-12">
              <h2 className="text-2xl font-semibold text-futarchyGray12 dark:text-white mb-6">
                Companies
              </h2>
            </div>

            {/* Companies Carousel */}
            <div className="mt-10">
              <CompaniesListCarousel useStorybookUrl={useStorybookUrl} />
            </div>
      </PageLayout>
    </RootLayout>
  );
};

export default CompaniesPage;
