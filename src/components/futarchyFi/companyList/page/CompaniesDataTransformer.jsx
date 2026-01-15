import axios from "axios";
// Import the fetchCompanyData function to get actual active milestone count
import { fetchCompanyData, getAvailableCompanies } from "../../proposalsList/page/proposalsPage/ProposalsPageDataTransformer";
// Import image utilities for dynamic image handling
import { getCompanyImage } from "../../../refactor/utils/imageUtils";
// Import Supabase client
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Mock data for debug mode
const mockCompanies = [
  {
    companyID: "1",
    title: "Gnosis",
    tags: ["Infrastructure", "Tools"],
    volume: "$2.1B",
    traders: 12500,
    proposals: 1,
  },
  {
    companyID: "10",
    name: "Kleros",
    tags: ["Justice", "Governance"],
    volume: "$850K",
    traders: 3200,
    proposals: 1,
  }
];

// ✅ REFACTORED: Removed hardcoded COMPANY_IMAGES constant
// Images now come from backend 'image' field with smart fallbacks
// See: src/components/refactor/utils/imageUtils.js for fallback logic
//
// OLD: const COMPANY_IMAGES = { "gnosis": "/assets/...", ... }
// NEW: Uses getCompanyImage(companyData) which reads from backend

// Function to simulate API delay
const simulateDelay = () => {
  const minDelay = 500; // 0.5 seconds
  const maxDelay = 2000; // 2 seconds
  const randomDelay =
    Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  return new Promise((resolve) => setTimeout(resolve, randomDelay));
  };

// ✅ REFACTORED: Instead of hardcoding hidden IDs, we filter companies that have no visible markets
// A company is hidden if ALL its markets have visibility="test" or if it has no active proposals
// This way, hiding is controlled by backend data, not hardcoded IDs
//
// OLD: const HIDDEN_COMPANY_IDS = ["12"];
// NEW: Filter based on proposal visibility and active status

// ✅ NEW: Fetch companies from dedicated 'companies' table
export const fetchFromCompaniesTable = async () => {
  try {
    console.log("[CompaniesDataTransformer] Fetching from 'company' table...");

    // 1. Fetch all companies from company table (singular)
    const { data: companies, error } = await supabase
      .from('company')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[CompaniesDataTransformer] Error fetching companies table:', error);
      throw error;
    }

    console.log('[CompaniesDataTransformer] Companies table data:', companies);

    if (!companies || companies.length === 0) {
      console.warn('[CompaniesDataTransformer] No companies found in table');
      return [];
    }

    // 2. Transform each company
    const transformedCompanies = await Promise.all(
      companies.map(async (company) => {
        try {
          const metadata = company.metadata || {};
          const companyId = metadata.company_id || company.id;

          console.log(`[CompaniesDataTransformer] Processing company: ${company.name} (ID: ${companyId})`);

          // Get background image for company card (NOT logo!)
          const imageUrl = metadata.background_image || metadata.image;

          // ❌ NO FALLBACK - Show error if missing
          if (!imageUrl) {
            console.error(`❌ [CompaniesDataTransformer] MISSING BACKGROUND IMAGE for company: ${company.name} (ID: ${companyId})`);
            console.error(`   Please add metadata.background_image field`);
          }

          console.log(`[CompaniesDataTransformer] Background image for ${company.name}:`, imageUrl || 'MISSING');

          // Get proposal count for this company
          const { count: proposalCount, error: countError } = await supabase
            .from('market_event')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .in('approval_status', ['ongoing', 'on_going']);

          if (countError) {
            console.warn(`[CompaniesDataTransformer] Error counting proposals for ${company.name}:`, countError);
          }

          const activeProposals = proposalCount || 0;

          return {
            companyID: companyId.toString(),
            id: company.id, // Integer ID
            title: company.name,
            name: company.name,
            description: company.description,
            image: imageUrl,
            proposals: activeProposals,
            slug: company.slug || company.name.toLowerCase().replace(/\s+/g, '-'),
            status: company.status, // ✅ Add status from company table

            // Additional data - prioritize table columns over metadata
            currency_token: company.currency_token || metadata.currency_token,
            website: metadata.website,
            colors: metadata.colors,
            banner: metadata.banner,

            // Raw data for debugging
            _raw: {
              metadata: metadata,
              proposalCount: activeProposals,
              imageSource: company.logo ? 'company.logo' : (metadata.image ? 'metadata.image' : 'generated')
            }
          };
        } catch (err) {
          console.error(`[CompaniesDataTransformer] Error processing company ${company.name}:`, err);
          return null;
        }
      })
    );

    // Filter out null results and companies with status !== 'public'
    const validCompanies = transformedCompanies.filter(c => {
      if (c === null) return false;

      // Check if company status is public (from company.status column)
      const isPublic = c.status === 'public';

      if (!isPublic) {
        console.log(`[CompaniesDataTransformer] Hiding company ${c.title} - status is not public (${c.status})`);
        return false;
      }

      return true;
    });

    console.log('[CompaniesDataTransformer] Final companies from table:', validCompanies);
    return validCompanies;

  } catch (error) {
    console.error('[CompaniesDataTransformer] Fatal error fetching from companies table:', error);
    return [];
  }
};

// Main function to fetch and transform company data (ORIGINAL - kept for backward compatibility)
export const fetchAndTransformCompanies = async (useCompaniesTable = true) => {
  // ✅ NEW: Try fetching from companies table first
  if (useCompaniesTable) {
    console.log('[CompaniesDataTransformer] Attempting to fetch from companies table...');
    const companiesFromTable = await fetchFromCompaniesTable();
    if (companiesFromTable && companiesFromTable.length > 0) {
      console.log('[CompaniesDataTransformer] Successfully fetched from companies table');
      return companiesFromTable;
    }
    console.warn('[CompaniesDataTransformer] Companies table empty or failed, falling back to market_event method');
  }
  try {
    const isDebugMode = process.env.NEXT_PUBLIC_DEBUG_MODE?.toLowerCase() === "true";
    console.log("Debug mode:", isDebugMode);

    // Instead of calling the external API that might not exist,
    // use the same data source as milestones (Supabase via fetchCompanyData)
    console.log("[CompaniesDataTransformer] Using Supabase data source like milestones");

    // Get available companies from the same source as milestones
    const availableCompanyIds = await getAvailableCompanies();

    // ✅ REFACTORED: No longer filtering by hardcoded IDs
    // Instead, we'll filter based on whether company has visible/active proposals
    console.log("[CompaniesDataTransformer] Available company IDs:", availableCompanyIds);
    console.log("[CompaniesDataTransformer] Company IDs count:", availableCompanyIds.length);
    console.log("[CompaniesDataTransformer] Company IDs detailed:", availableCompanyIds.map((id, index) => ({ index, id, type: typeof id, stringified: JSON.stringify(id) })));

    // For each company ID, fetch the company data
    const transformedCompanies = await Promise.all(availableCompanyIds.map(async (companyId) => {
      try {
        console.log(`[CompaniesDataTransformer] Processing company ${companyId}`);
        
        // Use the same fetchCompanyData function that works for milestones
        const companyData = await fetchCompanyData(companyId, false);
        
        if (!companyData) {
          console.warn(`[CompaniesDataTransformer] No data found for company ${companyId}`);
          return null;
        }

        const companyName = companyData.name?.toLowerCase().trim() || companyId.toString();

        // ✅ REFACTORED: Use dynamic image from backend with smart fallback
        // Priority: companyData.image > companyData.logo > generated fallback avatar
        const imageUrl = getCompanyImage(companyData);

        console.log("[CompaniesDataTransformer] Image details:", {
          companyName,
          companyId,
          companyDataImage: companyData.image,
          companyDataLogo: companyData.logo,
          finalImageUrl: imageUrl,
          isGeneratedFallback: imageUrl.includes('ui-avatars.com')
        });

        // Get the actual active milestone count using the same logic as Active Milestones
        let activeMilestonesCount = 0;
        if (companyData.proposals) {
          // Filter for active milestones - only include pending_review in debug mode
          // This should match what's actually visible in the Active Milestones section
          activeMilestonesCount = companyData.proposals.filter(p => {
            if (p.approvalStatus === "ongoing" || p.approvalStatus === "on_going") {
              return true; // Always include ongoing events
            }
            if (p.approvalStatus === "pending_review") {
              return isDebugMode; // Only include pending_review if debug mode is enabled
            }
            return false;
          }).length;
        }

        const transformedCompany = {
          companyID: companyId.toString(),
          title: companyData.name || 'Unknown Company',
          volume: "$0", // This data might not be available from current source
          traders: 0, // This data might not be available from current source
          proposals: activeMilestonesCount, // Use the dynamically calculated active milestone count
          tags: ["DeFi"], // Default tag, could be enhanced later
          image: imageUrl,
          // Add raw data for debugging
          _raw: {
            backendImage: companyData.image,
            backendLogo: companyData.logo,
            finalImageUrl: imageUrl,
            activeMilestonesCount: activeMilestonesCount,
            totalProposals: companyData.proposals?.length || 0
          }
        };

        console.log("[CompaniesDataTransformer] Transformed company:", transformedCompany);
        return transformedCompany;
        
      } catch (error) {
        console.warn(`[CompaniesDataTransformer] Failed to process company ${companyId}:`, error);
        return null;
      }
    }));

    // Filter out null results
    const validCompanies = transformedCompanies.filter(company => company !== null);

    // ✅ Filter companies based on whether they have active/visible proposals
    // A company is hidden if it has 0 active proposals
    // This replaces the hardcoded HIDDEN_COMPANY_IDS logic
    const companiesWithProposals = validCompanies.filter(company => {
      const hasActiveProposals = company.proposals > 0;
      if (!hasActiveProposals) {
        console.log(`[CompaniesDataTransformer] Hiding company ${company.title} (ID: ${company.companyID}) - no active proposals`);
      }
      return hasActiveProposals;
    });

    // Additional deduplication check by company title (case-insensitive)
    const uniqueCompanies = [];
    const seenTitles = new Set();

    for (const company of companiesWithProposals) {
      const normalizedTitle = company.title.toLowerCase().trim();
      if (!seenTitles.has(normalizedTitle)) {
        seenTitles.add(normalizedTitle);
        uniqueCompanies.push(company);
      } else {
        console.warn(`[CompaniesDataTransformer] Duplicate company detected and removed: ${company.title} (ID: ${company.companyID})`);
      }
    }

    console.log("[CompaniesDataTransformer] Final transformed companies:", uniqueCompanies);
    console.log("[CompaniesDataTransformer] Companies after filtering:", uniqueCompanies.length, "vs before:", validCompanies.length);
    return uniqueCompanies;

  } catch (error) {
    console.error("[CompaniesDataTransformer] Error:", error);
    console.error("[CompaniesDataTransformer] Full error details:", {
      message: error.message,
      stack: error.stack
    });
    
    // If everything fails, return mock data to prevent eternal loading
    console.log("[CompaniesDataTransformer] Falling back to mock data to prevent loading loop");
    return mockCompanies.map(company => ({
      ...company,
      // ✅ Use dynamic fallback instead of hardcoded mapping
      image: getCompanyImage({ name: company.name || company.title, id: company.companyID })
    }));
  }
};
