import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const MetaMaskLogin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const signInWithMetaMask = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Check if MetaMask is installed
      if (!window.ethereum || !window.ethereum.isMetaMask) {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
      }
      
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      
      // Create a message to sign
      const timestamp = Date.now();
      const nonce = Math.floor(Math.random() * 1000000);
      const message = `Sign this message to authenticate with our application.\n\nWallet: ${address}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
      
      // Get provider and request signature
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const signature = await signer.signMessage(message);
      
      console.log('Message signed successfully');
      
      // Call your Supabase Edge Function
      const { data: response, error: functionError } = await supabase.functions.invoke('wallet-auth', {
        body: {
          wallet_address: address,
          message: message,
          signature: signature
        }
      });
      
      if (functionError) throw functionError;
      
      console.log('Edge function response:', response);
      
      if (response && response.access_token && response.refresh_token) {
        // Set the session in Supabase
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: response.access_token,
          refresh_token: response.refresh_token
        });

        if (sessionError) throw sessionError;
        
        const userMessage = response.new_user 
          ? `New user created and signed in with wallet ${address}`
          : `Signed in with wallet ${address}`;
        
        setSuccess(userMessage);
        console.log('Signed in with MetaMask!', {
          user: response.user,
          isNewUser: response.new_user
        });
        
        // You can redirect the user or update the UI here
        // window.location.href = '/dashboard';
      } else {
        throw new Error('Invalid response format from Edge Function');
      }
      
    } catch (error) {
      console.error('Error signing in with MetaMask:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <div style={{color: 'red', marginBottom: '10px'}}>{error}</div>}
      {success && <div style={{color: 'green', marginBottom: '10px'}}>{success}</div>}
      
      <button 
        onClick={signInWithMetaMask}
        disabled={loading}
        style={{
          padding: '10px 16px',
          backgroundColor: '#3B82F6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '16px'
        }}
      >
        <svg width="20" height="20" viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M32.9582 1L19.8241 10.7183L22.2541 5.11683L32.9582 1Z" fill="#E2761B" stroke="#E2761B" strokeWidth="0.412861" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2.04183 1L15.0249 10.809L12.7459 5.11683L2.04183 1Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.412861" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M28.2001 23.4515L24.7192 28.7496L32.143 30.7742L34.2686 23.5525L28.2001 23.4515Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.412861" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M0.741699 23.5525L2.85725 30.7742L10.281 28.7496L6.80011 23.4515L0.741699 23.5525Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.412861" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9.89281 14.5149L7.84351 17.6139L15.2163 17.9169L14.9743 9.91965L9.89281 14.5149Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.412861" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M25.1073 14.5149L19.9648 9.82868L19.8238 17.9169L27.1865 17.6139L25.1073 14.5149Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.412861" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M10.2808 28.7496L14.7728 26.6239L10.8856 23.6031L10.2808 28.7496Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.412861" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M20.2268 26.6239L24.7188 28.7496L24.114 23.6031L20.2268 26.6239Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.412861" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {loading ? 'Connecting...' : 'Sign in with MetaMask'}
      </button>
    </div>
  );
};

export default MetaMaskLogin; 