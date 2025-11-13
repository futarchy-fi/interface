import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  getStaticMarketAddresses, 
  getMarketConfig, 
  generateMarketSEO 
} from '../../config/markets';

// Import MarketPageShowcase with no SSR
const MarketPageShowcase = dynamic(
  () => import("../../components/futarchyFi/marketPage/MarketPageShowcase"),
  { ssr: false }
);

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function DynamicMarketPage({ address, seoData, marketConfig }) {
  const [marketData, setMarketData] = useState(null);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const { data, error } = await supabase
          .from('market_event')
          .select('*')
          .eq('id', address)
          .single();
        
        if (error) {
          console.error('Error fetching market data:', error);
          return;
        }
        
        setMarketData(data);
      } catch (err) {
        console.error('Failed to fetch market data:', err);
      }
    };

    if (address) {
      fetchMarketData();
    }
  }, [address]);

  // If no config exists, show 404 or redirect
  if (!marketConfig) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Market Not Found</h1>
          <p className="text-gray-600">The market address {address} is not configured.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        {/* Basic meta tags */}
        <title>{seoData.title}</title>
        <meta name="description" content={seoData.description} />
        <meta name="keywords" content={marketConfig.keywords?.join(', ')} />
        
        {/* Open Graph tags for social sharing */}
        <meta property="og:title" content={seoData.openGraph.title} />
        <meta property="og:description" content={seoData.openGraph.description} />
        <meta property="og:image" content={seoData.openGraph.image} />
        <meta property="og:url" content={seoData.openGraph.url} />
        <meta property="og:type" content={seoData.openGraph.type} />
        <meta property="og:site_name" content={seoData.openGraph.siteName} />
        
        {/* Twitter Card tags */}
        <meta name="twitter:card" content={seoData.twitter.card} />
        <meta name="twitter:title" content={seoData.twitter.title} />
        <meta name="twitter:description" content={seoData.twitter.description} />
        <meta name="twitter:image" content={seoData.twitter.image} />
        
        {/* Additional meta tags */}
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={seoData.url} />
        
        {/* Structured data for better SEO */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": seoData.title,
            "description": seoData.description,
            "url": seoData.url,
            "image": seoData.image,
            "publisher": {
              "@type": "Organization",
              "name": "Futarchy.fi",
              "url": "https://app.futarchy.fi"
            },
            "category": marketConfig.category,
            "keywords": marketConfig.keywords?.join(', ')
          })}
        </script>
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <MarketPageShowcase proposal={address} />
    </>
  );
}

// Generate static paths for all configured markets at build time
export async function getStaticPaths() {
  const addresses = getStaticMarketAddresses();
  
  const paths = addresses.map((address) => ({
    params: { address }
  }));

  return {
    paths,
    fallback: false // Static export requires all paths to be pre-generated
  };
}

// Generate static props for each market page
export async function getStaticProps({ params }) {
  const { address } = params;
  
  // Get market configuration
  const marketConfig = getMarketConfig(address);
  
  // If no config exists, return 404
  if (!marketConfig) {
    return {
      notFound: true
    };
  }

  // Generate SEO data
  const seoData = generateMarketSEO(address);
  
  // Optional: Fetch additional market data at build time
  let marketData = null;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
    
    const { data } = await supabase
      .from('market_event')
      .select('*')
      .eq('id', address)
      .single();
    
    marketData = data;
  } catch (error) {
    console.warn(`Failed to fetch market data for ${address} at build time:`, error);
  }

  // Regenerate SEO data with actual market data if available
  const finalSeoData = generateMarketSEO(address, marketData);

  // Note: revalidate is not supported with output: export
  return {
    props: {
      address,
      seoData: finalSeoData,
      marketConfig,
      marketData
    }
  };
} 