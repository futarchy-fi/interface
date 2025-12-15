/**
 * Supabase Snapshot Integration
 *
 * Fetches Snapshot proposal IDs from Supabase based on market_event_id
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fetch Snapshot proposal ID from Supabase
 * @param {string} marketEventId - The market_event_id (proposal address)
 * @returns {Promise<string|null>} Snapshot proposal ID or null if not found
 */
export async function fetchSnapshotProposalId(marketEventId) {
  try {
    if (!marketEventId) {
      console.warn('[SupabaseSnapshot] No marketEventId provided');
      return null;
    }

    console.log('[SupabaseSnapshot] Fetching ALL proposal links from Supabase and filtering locally for market_event_id:', marketEventId);

    // Fetch ALL rows from the table (no backend filtering)
    const { data, error } = await supabase
      .from('market_event_proposal_links')
      .select('*');

    if (error) {
      console.error('[SupabaseSnapshot] Error fetching proposal links:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.warn('[SupabaseSnapshot] No proposal links found in table');
      return null;
    }

    console.log('[SupabaseSnapshot] Fetched', data.length, 'proposal links from Supabase, filtering locally...');

    // Filter locally in frontend - find matching market_event_id
    const proposalLink = data.find(link => link.market_event_id === marketEventId);

    if (!proposalLink) {
      console.warn('[SupabaseSnapshot] No proposal_id found for market_event_id:', marketEventId);
      console.warn('[SupabaseSnapshot] Available market_event_ids:', data.map(d => d.market_event_id));
      return null;
    }

    if (!proposalLink.proposal_id) {
      console.warn('[SupabaseSnapshot] Found record but proposal_id is null for market_event_id:', marketEventId);
      return null;
    }

    console.log('[SupabaseSnapshot] Found Snapshot proposal ID:', proposalLink.proposal_id);
    return proposalLink.proposal_id;

  } catch (error) {
    console.error('[SupabaseSnapshot] Exception while fetching proposal ID:', error);
    return null;
  }
}

/**
 * Fetch all Snapshot proposal links from Supabase
 * @returns {Promise<Array>} Array of { market_event_id, proposal_id } objects
 */
export async function fetchAllProposalLinks() {
  try {
    const { data, error } = await supabase
      .from('market_event_proposal_links')
      .select('market_event_id, proposal_id');

    if (error) {
      console.error('[SupabaseSnapshot] Error fetching all proposal links:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[SupabaseSnapshot] Exception while fetching all proposal links:', error);
    return [];
  }
}
