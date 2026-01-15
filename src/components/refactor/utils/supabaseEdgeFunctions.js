import { SUPABASE_CONFIG, SUPABASE_FUNCTIONS, DEFAULT_COMPANY_ID } from '../constants/supabase';

/**
 * Utility for calling Supabase Edge Functions
 * Uses direct fetch API to properly send request body
 */

/**
 * Fetch company information by ID using direct fetch to Supabase Edge Function
 * @param {number} id - Company ID to fetch (defaults to 9)
 * @returns {Promise<Object>} Company information
 */
export const fetchCompanyInfoById = async (id = DEFAULT_COMPANY_ID) => {
  const companyId = id || DEFAULT_COMPANY_ID;
  
  console.log(`🏢 Fetching company info for ID: ${companyId}`);
  
  try {
    const response = await fetch(`${SUPABASE_CONFIG.url}${SUPABASE_FUNCTIONS.companyInfo}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_CONFIG.anonKey
      },
      body: JSON.stringify({ id: companyId })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Company info fetched successfully:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Error fetching company info:', error);
    throw new Error(`Failed to fetch company info: ${error.message}`);
  }
};

/**
 * Validate company ID
 * @param {number} id - Company ID to validate
 * @returns {boolean} Whether ID is valid
 */
export const validateCompanyId = (id) => {
  return id && typeof id === 'number' && id > 0 && Number.isInteger(id);
};

/**
 * Format company info response for display
 * @param {Object} companyInfo - Raw company info from API
 * @returns {Object} Formatted company info
 */
export const formatCompanyInfo = (companyInfo) => {
  if (!companyInfo) return null;
  
  return {
    ...companyInfo,
    fetchedAt: new Date().toISOString(),
    displayName: companyInfo.name || `Company ${companyInfo.id}`,
    hasValidData: !!(companyInfo.id && companyInfo.name)
  };
};

/**
 * Get multiple company infos (for future use)
 * @param {number[]} ids - Array of company IDs
 * @returns {Promise<Object[]>} Array of company information
 */
export const fetchMultipleCompanyInfos = async (ids = [DEFAULT_COMPANY_ID]) => {
  const promises = ids.map(id => fetchCompanyInfoById(id));
  
  try {
    const results = await Promise.allSettled(promises);
    return results.map((result, index) => ({
      id: ids[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  } catch (error) {
    console.error('❌ Error fetching multiple company infos:', error);
    throw error;
  }
}; 