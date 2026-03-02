import { useState, useEffect } from 'react';

/**
 * Hook for fetching company and proposal data
 * Currently uses mock data, but can be extended to fetch from API
 */
export const useCompanyData = (companyId = 'gnosis-dao') => {
  const [companyData, setCompanyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Mock data - replace with actual API call
  const mockCompanyData = {
    "company_id": 9,
    "currency_token": "GNO",
    "description": "Gnosis builds innovative projects in payments, identity, and internet freedom, driving change and shaping the future of decentralized technology.",
    "logo": "/assets/gnosis-dao-logo.png",
    "name": "Gnosis DAO",
    "proposals": [
      {
        "approval_status": "pending_review",
        "condition_id": "0xf51abb7623759d517c99b7826a09fc3258ef7a461cc48100062df47532b34cfa",
        "countdown_finish": false,
        "end_time": "2026-03-15T18:00:00+00:00",
        "participating_users": [],
        "pool_no": "0xfbf1BE5CE2f9056dAaB1C368EC241ad7Be3507A8",
        "pool_yes": "0xF336F812Db1ad142F22A9A4dd43D40e64B478361",
        "prices": {
          "approval": "250.00",
          "refusal": "230.00"
        },
        "proposal_id": "0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919",
        "proposal_title": "Will GnosisPay achieve more than €2,000,000 in transaction volume during any single full calendar week (Monday 00:00 UTC to Sunday 23:59 UTC) ending on or before June 30, 2025?",
        "proposals_markdown_market": [
          {
            "proposal_markdown": "# Will reaching €2M in weekly GnosisPay transactions drive up the price of GNO?\nGNO powers governance and utility for the Gnosis ecosystem, while GnosisPay connects crypto with everyday spending. Predict how real-world adoption might impact the token's value.",
            "proposal_market": "proposal"
          }
        ],
        "question_id": "C78679457A7CFBA6B25C6AFF5A94C218F3D38A78BB560509302FE304F0079EA4",
        "tags": [
          "expansao",
          "global",
          "estrategia"
        ],
        "timestamp": "2025-05-26T22:17:47.210777+00:00",
        "tokens": "2500000"
      }
    ],
    "stats": {
      "active_traders": 0,
      "proposals": 1,
      "volume": ""
    },
    "fetchedAt": new Date().toISOString(),
    "displayName": "Gnosis DAO",
    "hasValidData": true
  };

  const loadCompanyData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/companies/${companyId}`);
      // if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // const data = await response.json();
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setCompanyData(mockCompanyData);
    } catch (err) {
      setError(`Failed to load company data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    loadCompanyData();
  };

  useEffect(() => {
    loadCompanyData();
  }, [companyId]);

  return {
    companyData,
    loading,
    error,
    refreshData
  };
}; 