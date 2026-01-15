import { useState, useCallback } from 'react';
import { fetchCompanyInfoById, validateCompanyId, formatCompanyInfo } from '../utils/supabaseEdgeFunctions';
import { DEFAULT_COMPANY_ID, COMPANY_INFO_STATUS } from '../constants/supabase';

/**
 * React hook for fetching company information from Supabase Edge Functions
 * Provides state management and loading states for company data
 */
export function useCompanyInfo(defaultId = DEFAULT_COMPANY_ID) {
  // State
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(COMPANY_INFO_STATUS.IDLE);
  const [lastFetchedId, setLastFetchedId] = useState(null);
  const [fetchHistory, setFetchHistory] = useState([]);

  // Fetch company info by ID
  const fetchCompanyInfo = useCallback(async (id = defaultId) => {
    const companyId = id || defaultId;
    
    // Validate ID
    if (!validateCompanyId(companyId)) {
      const errorMsg = `Invalid company ID: ${companyId}. Must be a positive integer.`;
      setError(errorMsg);
      setStatus(COMPANY_INFO_STATUS.ERROR);
      return null;
    }

    setLoading(true);
    setError(null);
    setStatus(COMPANY_INFO_STATUS.LOADING);
    
    const fetchStartTime = Date.now();

    try {
      console.log(`📥 useCompanyInfo: Fetching company ID ${companyId}`);
      
      const rawData = await fetchCompanyInfoById(companyId);
      const formattedData = formatCompanyInfo(rawData);
      
      setCompanyInfo(formattedData);
      setLastFetchedId(companyId);
      setStatus(COMPANY_INFO_STATUS.SUCCESS);
      
      // Update fetch history
      setFetchHistory(prev => [{
        id: companyId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - fetchStartTime,
        success: true,
        data: formattedData
      }, ...prev.slice(0, 9)]); // Keep last 10 fetches
      
      console.log(`✅ useCompanyInfo: Successfully fetched company ID ${companyId}`);
      return formattedData;
      
    } catch (err) {
      console.error(`❌ useCompanyInfo: Failed to fetch company ID ${companyId}:`, err);
      
      const errorMsg = err.message || 'Failed to fetch company info';
      setError(errorMsg);
      setStatus(COMPANY_INFO_STATUS.ERROR);
      
      // Update fetch history with error
      setFetchHistory(prev => [{
        id: companyId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - fetchStartTime,
        success: false,
        error: errorMsg
      }, ...prev.slice(0, 9)]);
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [defaultId]);

  // Refresh current company info
  const refreshCompanyInfo = useCallback(() => {
    if (lastFetchedId) {
      return fetchCompanyInfo(lastFetchedId);
    } else {
      return fetchCompanyInfo(defaultId);
    }
  }, [lastFetchedId, defaultId, fetchCompanyInfo]);

  // Clear current data
  const clearCompanyInfo = useCallback(() => {
    setCompanyInfo(null);
    setError(null);
    setStatus(COMPANY_INFO_STATUS.IDLE);
    setLastFetchedId(null);
  }, []);

  // Get fetch statistics
  const getFetchStats = useCallback(() => {
    const successful = fetchHistory.filter(f => f.success).length;
    const failed = fetchHistory.filter(f => !f.success).length;
    const averageDuration = fetchHistory.length > 0 
      ? fetchHistory.reduce((sum, f) => sum + f.duration, 0) / fetchHistory.length 
      : 0;

    return {
      total: fetchHistory.length,
      successful,
      failed,
      successRate: fetchHistory.length > 0 ? (successful / fetchHistory.length) * 100 : 0,
      averageDuration: Math.round(averageDuration)
    };
  }, [fetchHistory]);

  // Check if data is stale (older than 5 minutes)
  const isDataStale = useCallback(() => {
    if (!companyInfo?.fetchedAt) return true;
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return new Date(companyInfo.fetchedAt).getTime() < fiveMinutesAgo;
  }, [companyInfo]);

  return {
    // Data
    companyInfo,
    lastFetchedId,
    fetchHistory,
    
    // State
    loading,
    error,
    status,
    
    // Actions
    fetchCompanyInfo,
    refreshCompanyInfo,
    clearCompanyInfo,
    
    // Utilities
    getFetchStats,
    isDataStale,
    
    // Computed values
    hasData: !!companyInfo,
    isIdle: status === COMPANY_INFO_STATUS.IDLE,
    isLoading: status === COMPANY_INFO_STATUS.LOADING,
    isSuccess: status === COMPANY_INFO_STATUS.SUCCESS,
    isError: status === COMPANY_INFO_STATUS.ERROR
  };
}

export default useCompanyInfo; 