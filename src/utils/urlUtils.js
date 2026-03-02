/**
 * URL Utilities
 * 
 * Centralized URL generation for consistent link formats across the app.
 */

import { USE_QUERY_PARAM_URLS } from '../config/featureFlags';

/**
 * Generate market page URL based on feature flag
 * 
 * @param {string} proposalId - The proposal/market address
 * @returns {string} - URL to the market page
 * 
 * When USE_QUERY_PARAM_URLS is true:
 *   /market?proposalId=0x123...
 * 
 * When USE_QUERY_PARAM_URLS is false:
 *   /markets/0x123...
 */
export function getMarketUrl(proposalId) {
    if (!proposalId) return '/';

    return USE_QUERY_PARAM_URLS
        ? `/market?proposalId=${proposalId}`
        : `/markets/${proposalId}`;
}

export default {
    getMarketUrl
};
