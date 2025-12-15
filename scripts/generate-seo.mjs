#!/usr/bin/env node

/**
 * SEO Generator Script
 * 
 * Fetches all market events from Supabase and generates SEO metadata
 * for use in the dynamic markets configuration system.
 * 
 * Usage:
 *   npm run generate-seo           - Generate SEO, use cache if available
 *   npm run generate-seo -- --overwrite  - Force regenerate all SEO content
 * 
 * Note: Images in metadata.seo.image are always preserved regardless of mode
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

// Parse command line arguments
const args = process.argv.slice(2);
const FORCE_OVERWRITE = args.includes('--overwrite');

if (FORCE_OVERWRITE) {
  console.log('🔄 OVERWRITE MODE: Will regenerate all SEO content (title & description)');
  console.log('   Note: Existing images will still be preserved');
}

// Initialize Supabase client using environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co';
const supabaseKey = process.env.NEXT_PRIVATE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const openaiKey = process.env.OPENAI_SECRET_KEY || '';

// Security check
const usingServiceRole = !!process.env.NEXT_PRIVATE_SUPABASE_ANON_KEY;
if (!usingServiceRole) {
  console.warn('⚠️ WARNING: Using public anon key for database writes. This is a security risk!');
  console.warn('💡 Using NEXT_PRIVATE_SUPABASE_ANON_KEY (service role) for secure operations.');
} else {
  console.log('🔐 Using service role key for secure database operations');
}

console.log('🔧 Environment check:');
console.log(`   Supabase URL: ${supabaseUrl}`);
console.log(`   Supabase Key: ${supabaseKey ? '✅ Found' : '❌ Missing'}`);
console.log(`   OpenAI Key: ${openaiKey ? '✅ Found' : '❌ Missing'}`);

if (!supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is required');
  console.error('💡 Make sure you have .env.local or .env file with the Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI client (optional - will fall back to manual generation if not available)
let openai = null;
if (openaiKey) {
  openai = new OpenAI({
    apiKey: openaiKey,
  });
  console.log('🤖 OpenAI integration enabled');
} else {
  console.log('⚠️ OpenAI key not found - using fallback SEO generation');
}

// Initialize logging system
const logFilePath = path.join(process.cwd(), 'logs', 'seo-generation.log');
const logDir = path.dirname(logFilePath);

// Ensure logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
  console.log(`📁 Created logs directory: ${logDir}`);
}

// Initialize log file with session header
console.log(`📄 Logging to: ${logFilePath}`);

// Logging function
function logToFile(level, message, data = null) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(logFilePath, logLine, 'utf8');
    
    // Also log to console with appropriate emoji
    const emoji = {
      'INFO': '📝',
      'SUCCESS': '✅',
      'WARNING': '⚠️',
      'ERROR': '❌',
      'CACHE_HIT': '💾',
      'AI_CALL': '🤖',
      'AI_RESPONSE': '🎯'
    };
    
    console.log(`${emoji[level] || '📝'} ${message}`);
  } catch (error) {
    // Fallback to console only if file logging fails
    console.error(`❌ Failed to write to log file: ${error.message}`);
    console.log(`${level}: ${message}`);
    if (data) {
      console.log('Data:', JSON.stringify(data, null, 2));
    }
  }
}

// Helper function to fetch AI prompt from database
async function fetchAIPromptTemplate() {
  try {
    logToFile('INFO', 'Fetching AI prompt template from ai_prompts table');
    
    const { data, error } = await supabase
      .from('ai_prompts')
      .select('id, provider, model, prompt, created_at, updated_at')
      .order('created_at', { ascending: false })  // Get most recent first
      .limit(1)
      .single();
    
    if (error) {
      logToFile('WARNING', 'Failed to fetch AI prompt template - continuing without it', { error: error.message });
      return { prompt: null, provider: null, model: null };
    }
    
    if (data && data.prompt) {
      logToFile('SUCCESS', 'AI prompt template fetched successfully', { 
        promptId: data.id,
        provider: data.provider,
        model: data.model,
        promptPreview: data.prompt.substring(0, 100) + '...',
        createdAt: data.created_at,
        updatedAt: data.updated_at
      });
      return {
        prompt: data.prompt,
        provider: data.provider || 'openai',
        model: data.model || 'gpt-4o-mini'
      };
    }
    
    logToFile('WARNING', 'No AI prompt found in database - using default');
    return { prompt: null, provider: null, model: null };
  } catch (err) {
    logToFile('ERROR', 'Error fetching AI prompt template - continuing without it', { error: err.message });
    return { prompt: null, provider: null, model: null };
  }
}

// Store the fetched prompt template globally
let aiPromptConfig = null;

// Helper function to generate SEO content using OpenAI and save to Supabase
async function generateSEOWithAI(market) {
  if (!openai) return null;
  
  const marketId = market.id;
  logToFile('AI_CALL', `Starting AI SEO generation for market: ${marketId}`, {
    marketTitle: market.title,
    tokens: market.tokens,
    displayTitles: {
      title0: market.metadata?.display_title_0,
      title1: market.metadata?.display_title_1
    }
  });
  
  try {
    // Prepare market context for AI
    const tokens = market.tokens || 'tokens';
    const title = market.title || 'prediction market';
    const displayTitle0 = market.metadata?.display_title_0 || '';
    const displayTitle1 = market.metadata?.display_title_1 || '';
    const description = market.metadata?.description || '';
    
    let prompt = '';
    const modelToUse = aiPromptConfig?.model || 'gpt-4o-mini';
    
    if (aiPromptConfig?.prompt) {
      // Use the template from database with variable substitution
      // Support both {{variable}} and ${variable} formats
      prompt = aiPromptConfig.prompt
        // First replace {{}} format
        .replace(/\{\{title\}\}/g, title)
        .replace(/\{\{display_title_0\}\}/g, displayTitle0)
        .replace(/\{\{display_title_1\}\}/g, displayTitle1)
        .replace(/\{\{tokens\}\}/g, tokens)
        .replace(/\{\{description\}\}/g, description)
        // Then replace ${} format with various naming conventions
        .replace(/\$\{title\}/g, title)
        .replace(/\$\{displayTitle0\}/g, displayTitle0)
        .replace(/\$\{displayTitle1\}/g, displayTitle1)
        .replace(/\$\{display_title_0\}/g, displayTitle0)
        .replace(/\$\{display_title_1\}/g, displayTitle1)
        .replace(/\$\{tokens\}/g, tokens)
        .replace(/\$\{description\}/g, description);
      
      logToFile('INFO', 'Using AI prompt template from database', {
        provider: aiPromptConfig.provider,
        model: modelToUse,
        variableSubstitution: {
          title,
          displayTitle0,
          displayTitle1,
          tokens,
          description
        }
      });
    } else {
      // Fallback to default prompt
      prompt = `Generate SEO-optimized title and description for a futarchy prediction market:

Market Title: "${title}"
Display Titles: "${displayTitle0}" "${displayTitle1}"
Tokens: ${tokens}
Description: ${description}

Requirements:
- Title: 50-60 characters, engaging, clear about the prediction
- Description: 140-160 characters, mention the tokens/impact, include call-to-action
- Focus on the prediction/governance aspect
- Make it appealing for traders and governance participants

Return JSON format:
{
  "title": "SEO title here",
  "description": "SEO description here"
}`;
      
      logToFile('INFO', 'Using default AI prompt (no template found)');
    }

    logToFile('AI_CALL', `Sending prompt to OpenAI for market: ${marketId}`, {
      prompt,
      model: modelToUse,
      temperature: 0.7,
      max_tokens: 200
    });

    const requestTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: modelToUse,
      messages: [
        {
          role: "system",
          content: "You are an expert SEO copywriter specializing in DeFi and prediction markets. Generate compelling, accurate SEO content."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    });
    const responseTime = Date.now() - requestTime;

    const response = completion.choices[0]?.message?.content;
    
    logToFile('AI_RESPONSE', `Received OpenAI response for market: ${marketId}`, {
      responseTimeMs: responseTime,
      rawResponse: response,
      usage: completion.usage
    });

    if (response) {
      try {
        // Clean the response to handle markdown code blocks
        let cleanedResponse = response.trim();
        
        // Remove markdown code blocks if present
        if (cleanedResponse.startsWith('```json') && cleanedResponse.endsWith('```')) {
          cleanedResponse = cleanedResponse.slice(7, -3).trim();
        } else if (cleanedResponse.startsWith('```') && cleanedResponse.endsWith('```')) {
          cleanedResponse = cleanedResponse.slice(3, -3).trim();
        }
        
        const aiSEO = JSON.parse(cleanedResponse);
        
        logToFile('SUCCESS', `Successfully parsed AI SEO for market: ${marketId}`, {
          generatedTitle: aiSEO.title,
          generatedDescription: aiSEO.description,
          titleLength: aiSEO.title?.length,
          descriptionLength: aiSEO.description?.length,
          wasMarkdownWrapped: cleanedResponse !== response
        });
        
        // Save AI-generated SEO back to Supabase
        await saveAISEOToSupabase(market.id, aiSEO);
        
        return aiSEO;
      } catch (parseError) {
        logToFile('ERROR', `Failed to parse OpenAI response for market: ${marketId}`, {
          error: parseError.message,
          rawResponse: response
        });
        return null;
      }
    }
  } catch (error) {
    logToFile('ERROR', `OpenAI API error for market: ${marketId}`, {
      error: error.message,
      errorStack: error.stack
    });
    return null;
  }
  
  return null;
}

// Helper function to save AI-generated SEO to Supabase
async function saveAISEOToSupabase(marketId, aiSEO) {
  logToFile('INFO', `Attempting to save AI SEO to Supabase for market: ${marketId}`, {
    title: aiSEO.title,
    description: aiSEO.description
  });

  try {
    // Get current metadata
    const { data: currentMarket, error: fetchError } = await supabase
      .from('market_event')
      .select('metadata')
      .eq('id', marketId)
      .single();

    if (fetchError) {
      logToFile('ERROR', `Failed to fetch market ${marketId} for SEO update`, {
        error: fetchError.message,
        errorCode: fetchError.code
      });
      return;
    }

    const existingSEO = currentMarket.metadata?.seo;
    logToFile('INFO', `Current SEO state for market ${marketId}`, {
      hasExistingSEO: !!existingSEO,
      existingAIGenerated: existingSEO?.AI_generated,
      existingTitle: existingSEO?.title,
      existingImage: existingSEO?.image,  // Log existing image
      existingGeneratedAt: existingSEO?.generated_at
    });

    // Prepare updated metadata with AI SEO
    // IMPORTANT: Preserve existing image field if it exists
    const updatedMetadata = {
      ...currentMarket.metadata,
      seo: {
        ...currentMarket.metadata?.seo,
        title: aiSEO.title,
        description: aiSEO.description,
        AI_generated: true,
        generated_at: new Date().toISOString()
        // image field is preserved from ...currentMarket.metadata?.seo spread
      }
    };

    // Update the market with new SEO metadata
    const { data: updateResult, error: updateError } = await supabase
      .from('market_event')
      .update({ metadata: updatedMetadata })
      .eq('id', marketId);

    if (updateError) {
      logToFile('ERROR', `Failed to save AI SEO for market ${marketId}`, {
        error: updateError.message,
        errorCode: updateError.code,
        supabaseDetails: updateError.details,
        supabaseHint: updateError.hint
      });
    } else {
      logToFile('SUCCESS', `Successfully saved AI SEO to database for market: ${marketId}`, {
        savedTitle: aiSEO.title,
        savedDescription: aiSEO.description,
        preservedImage: updatedMetadata.seo?.image,  // Log preserved image
        timestamp: new Date().toISOString(),
        updateResult: updateResult,
        updatedMetadataPreview: {
          seoTitle: updatedMetadata.seo?.title,
          seoImage: updatedMetadata.seo?.image,  // Show image was preserved
          seoAIGenerated: updatedMetadata.seo?.AI_generated
        }
      });
    }
  } catch (error) {
    logToFile('ERROR', `Unexpected error saving AI SEO for market ${marketId}`, {
      error: error.message,
      errorStack: error.stack
    });
  }
}

// Helper function to generate SEO-friendly title
async function generateTitle(market, aiSEO = null) {
  // Check for AI-generated title first
  if (aiSEO?.title) {
    return aiSEO.title;
  }
  
  // Check for metadata.seo.title first
  if (market.metadata?.seo?.title) {
    return market.metadata.seo.title;
  }
  
  // Use display titles if available
  if (market.metadata?.display_title_0 && market.metadata?.display_title_1) {
    return `${market.metadata.display_title_0} ${market.metadata.display_title_1}`.trim();
  }
  
  // Use market title, but clean it up for SEO
  if (market.title) {
    // Remove quotes and make it more readable
    let title = market.title
      .replace(/"/g, '')
      .replace(/Will\s+/, '')
      .replace(/\?$/, '');
    
    // Truncate if too long
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }
    
    return title;
  }
  
  return 'Futarchy Market Prediction';
}

// Helper function to generate SEO description
async function generateDescription(market, aiSEO = null) {
  // Check for AI-generated description first
  if (aiSEO?.description) {
    return aiSEO.description;
  }
  
  // Check for metadata.seo.description first
  if (market.metadata?.seo?.description) {
    return market.metadata.seo.description;
  }
  
  // Use existing description from metadata
  if (market.metadata?.description) {
    return market.metadata.description;
  }
  
  // Generate description based on market data
  const marketName = market.title || 'this proposal';
  const tokens = market.tokens || 'GNO, sDAI';
  const [baseToken] = tokens.split(',').map(t => t.trim());
  
  let description = `Markets are currently forecasting the impact on ${baseToken} price if ${marketName.toLowerCase().replace(/^will\s+/i, '').replace(/\?$/, '')}. `;
  description += `Trade your insights or follow the predictions at futarchy.fi!`;
  
  // Truncate if too long for meta description
  if (description.length > 160) {
    description = description.substring(0, 157) + '...';
  }
  
  return description;
}

// Helper function to generate SEO image
function generateImage(market) {
  // Check for metadata.seo.image first
  if (market.metadata?.seo?.image) {
    // Ensure the image path has proper prefix
    const img = market.metadata.seo.image;
    // If it's just a filename without path, add /assets/ prefix
    if (!img.startsWith('/') && !img.startsWith('http')) {
      return `/assets/${img}`;
    }
    return img;
  }
  
  // Use token images if available
  if (market.metadata?.token_images?.company) {
    const img = market.metadata.token_images.company;
    // Ensure proper path prefix
    if (!img.startsWith('/') && !img.startsWith('http')) {
      return `/assets/${img}`;
    }
    return img;
  }
  
  // Default based on tokens or company
  const tokens = market.tokens || '';
  if (tokens.includes('GNO')) {
    return '/assets/gnosis-proposal-1.png';
  } else if (tokens.includes('PNK')) {
    return '/assets/kleros-proposal-1.png';
  }
  
  // Generic futarchy image
  return '/assets/futarchy-market-default.png';
}

// Helper function to generate keywords
function generateKeywords(market) {
  const keywords = ['futarchy', 'prediction market', 'governance', 'blockchain'];
  
  // Add token-specific keywords
  const tokens = market.tokens || '';
  if (tokens.includes('GNO')) {
    keywords.push('GNO', 'Gnosis', 'GnosisDAO');
  }
  if (tokens.includes('PNK')) {
    keywords.push('PNK', 'Kleros', 'arbitration');
  }
  if (tokens.includes('sDAI')) {
    keywords.push('sDAI', 'savings', 'DeFi');
  }
  
  // Add category-specific keywords
  if (market.tags) {
    keywords.push(...market.tags);
  }
  
  return [...new Set(keywords)]; // Remove duplicates
}

// Helper function to determine market category
function getMarketCategory(market) {
  const title = (market.title || '').toLowerCase();
  const tokens = (market.tokens || '').toLowerCase();
  
  if (title.includes('governance') || title.includes('dao') || title.includes('proposal')) {
    return 'governance';
  }
  if (title.includes('price') || title.includes('trading') || title.includes('volume')) {
    return 'trading';
  }
  if (title.includes('defi') || title.includes('tvl') || title.includes('yield')) {
    return 'defi';
  }
  if (tokens.includes('pnk') || title.includes('kleros')) {
    return 'arbitration';
  }
  
  return 'governance'; // Default category
}

// Helper function to generate market path
function generatePath(marketId) {
  return `/markets/${marketId}`;
}

// Helper function to clear all cached AI SEO data
async function clearCachedSEO() {
  logToFile('INFO', '🧹 Clearing all cached AI SEO data for fresh generation');
  
  try {
    // Get all markets
    const { data: markets, error } = await supabase
      .from('market_event')
      .select('id, metadata')
      .not('metadata->seo->AI_generated', 'is', null);

    if (error) {
      logToFile('ERROR', 'Failed to fetch markets for SEO clearing', {
        error: error.message,
        errorCode: error.code
      });
      return;
    }

    if (!markets || markets.length === 0) {
      logToFile('INFO', 'No cached AI SEO data found to clear');
      return;
    }

    logToFile('INFO', `Found ${markets.length} markets with cached AI SEO data`);

    // Clear AI SEO data from each market
    for (const market of markets) {
      if (market.metadata?.seo?.AI_generated) {
        // Preserve the image field if it exists
        const preservedImage = market.metadata.seo.image;
        
        const updatedMetadata = {
          ...market.metadata,
          seo: {
            // Keep the image field if it existed
            ...(preservedImage && { image: preservedImage }),
            // Remove only AI-generated fields
            // title and description are removed, but image is preserved
            AI_generated: undefined,
            generated_at: undefined
          }
        };

        // Clean up undefined values
        if (updatedMetadata.seo.AI_generated === undefined) delete updatedMetadata.seo.AI_generated;
        if (updatedMetadata.seo.generated_at === undefined) delete updatedMetadata.seo.generated_at;

        // If SEO object only has image or is empty, handle accordingly
        if (Object.keys(updatedMetadata.seo).length === 0) {
          delete updatedMetadata.seo;
        }

        const { error: updateError } = await supabase
          .from('market_event')
          .update({ metadata: updatedMetadata })
          .eq('id', market.id);

        if (updateError) {
          logToFile('ERROR', `Failed to clear SEO for market ${market.id}`, {
            error: updateError.message,
            errorCode: updateError.code
          });
        } else {
          logToFile('SUCCESS', `Cleared cached AI SEO for market: ${market.id}`);
        }
      }
    }

    logToFile('SUCCESS', `🧹 Successfully cleared cached AI SEO from ${markets.length} markets`);
    
  } catch (error) {
    logToFile('ERROR', 'Unexpected error clearing cached SEO', {
      error: error.message,
      errorStack: error.stack
    });
  }
}

// Main function to fetch markets and generate SEO data
async function generateSEOData() {
  const sessionId = Date.now().toString();
  logToFile('INFO', '🚀 Starting SEO generation session', {
    sessionId,
    timestamp: new Date().toISOString(),
    openaiEnabled: !!openai,
    logFile: logFilePath
  });

  // Fetch AI prompt template before processing markets
  aiPromptConfig = await fetchAIPromptTemplate();
  
  // Clear cached AI SEO data when:
  // 1. --overwrite flag is set (force regeneration)
  // 2. We detect the prompt template might have changed
  if (openai && FORCE_OVERWRITE) {
    logToFile('INFO', 'OVERWRITE MODE: Clearing all cached AI SEO for fresh regeneration');
    await clearCachedSEO();
  }
  
  try {
    // Fetch all market events from Supabase
    logToFile('INFO', '📡 Fetching markets from Supabase database');
    const { data: markets, error } = await supabase
      .from('market_event')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logToFile('ERROR', 'Failed to fetch markets from Supabase', {
        error: error.message,
        errorCode: error.code
      });
      throw new Error(`Supabase error: ${error.message}`);
    }

    if (!markets || markets.length === 0) {
      logToFile('WARNING', 'No markets found in Supabase database');
      return;
    }

    logToFile('INFO', `📊 Successfully fetched ${markets.length} markets from Supabase`, {
      marketCount: markets.length,
      marketIds: markets.map(m => m.id),
      // DEBUG: Let's see what metadata structure we're getting
      sampleMarketMetadata: markets[0] ? {
        id: markets[0].id,
        hasMetadata: !!markets[0].metadata,
        metadataKeys: markets[0].metadata ? Object.keys(markets[0].metadata) : [],
        hasSEO: !!markets[0].metadata?.seo,
        seoContent: markets[0].metadata?.seo || 'No SEO found'
      } : 'No markets found'
    });

    // Generate SEO configuration for each market
    const marketsConfig = {};
    let activeCount = 0;
    let skippedCount = 0;
    let aiGeneratedCount = 0;
    let aiCachedCount = 0;

    for (let i = 0; i < markets.length; i++) {
      const market = markets[i];
      const marketId = market.id;
      
      // Skip if market doesn't have required data
      if (!marketId || !market.title) {
        console.log(`⚠️ Skipping market ${marketId}: Missing required data`);
        skippedCount++;
        continue;
      }

      // Determine if market should be active (not resolved and not test visibility)
      const isActive = market.resolution_status !== 'resolved' && 
                      market.visibility !== 'test' &&
                      (market.approval_status === 'on_going' || market.approval_status === 'ongoing' || market.approval_status === 'pending_review');

      // Try to generate SEO content with AI first
      let aiSEO = null;
      if (openai) {
        // Check if AI SEO already exists in metadata
        // Skip cache if:
        // 1. --overwrite flag is set (force regeneration)
        // 2. It contains placeholder variables (indicating it wasn't properly substituted)
        const cachedSEO = market.metadata?.seo;
        const hasPlaceholders = cachedSEO?.title?.includes('${') || cachedSEO?.description?.includes('${');
        
        if (cachedSEO?.AI_generated && !hasPlaceholders && !FORCE_OVERWRITE) {
          logToFile('CACHE_HIT', `Using cached AI SEO for market ${i + 1}/${markets.length}: ${marketId}`, {
            cachedTitle: market.metadata.seo.title,
            cachedDescription: market.metadata.seo.description,
            generatedAt: market.metadata.seo.generated_at,
            cacheAge: market.metadata.seo.generated_at ? 
              Math.round((Date.now() - new Date(market.metadata.seo.generated_at).getTime()) / 1000 / 60) + ' minutes' : 
              'unknown',
            // DEBUG: Let's see the full metadata structure
            fullMetadataStructure: {
              hasMetadata: !!market.metadata,
              hasSEO: !!market.metadata?.seo,
              seoKeys: market.metadata?.seo ? Object.keys(market.metadata.seo) : [],
              aiGenerated: market.metadata?.seo?.AI_generated
            }
          });
          
          aiSEO = {
            title: market.metadata.seo.title,
            description: market.metadata.seo.description
          };
          aiCachedCount++;
        } else {
          console.log(`🤖 Generating AI SEO for market ${i + 1}/${markets.length}: ${marketId}`);
          aiSEO = await generateSEOWithAI(market);
          if (aiSEO) {
            console.log(`✅ AI SEO generated: "${aiSEO.title}"`);
            aiGeneratedCount++;
          }
          
          // Rate limiting: small delay between API calls
          if (i < markets.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
          }
        }
      }

      const title = await generateTitle(market, aiSEO);
      const description = await generateDescription(market, aiSEO);
      const image = generateImage(market);
      const keywords = generateKeywords(market);
      const category = getMarketCategory(market);
      const path = generatePath(marketId);

      marketsConfig[marketId] = {
        title,
        description,
        image,
        path,
        openGraph: {
          title: `${title} | Futarchy.fi`,
          description,
          image,
          type: 'website',
          siteName: 'Futarchy.fi'
        },
        twitter: {
          card: 'summary_large_image',
          title: `${title} | Futarchy.fi`,
          description,
          image
        },
        keywords,
        category,
        isActive,
        // Store additional metadata for reference
        metadata: {
          tokens: market.tokens,
          companyId: market.company_id,
          approvalStatus: market.approval_status,
          resolutionStatus: market.resolution_status,
          visibility: market.visibility,
          endDate: market.end_date,
          createdAt: market.created_at
        }
      };

      if (isActive) {
        activeCount++;
        console.log(`✅ Generated SEO for active market: ${marketId} - "${title}"`);
      } else {
        console.log(`📝 Generated SEO for inactive market: ${marketId} - "${title}" (${market.resolution_status})`);
      }
    }

    const summary = {
      totalProcessed: markets.length,
      activeMarkets: activeCount,
      inactiveMarkets: markets.length - activeCount - skippedCount,
      skippedMarkets: skippedCount,
      aiEnhanced: openai ? aiGeneratedCount + aiCachedCount : 0,
      freshAIGeneration: aiGeneratedCount,
      cachedFromDB: aiCachedCount,
      completionRate: openai ? Math.round((aiGeneratedCount + aiCachedCount) / (markets.length - skippedCount) * 100) : 0
    };

    logToFile('INFO', '📈 SEO Generation Session Complete', {
      sessionSummary: summary,
      sessionDuration: Date.now() - parseInt(sessionId) + 'ms'
    });

    console.log(`\n📈 SEO Generation Summary${FORCE_OVERWRITE ? ' (OVERWRITE MODE)' : ''}:`);
    console.log(`   Total markets processed: ${summary.totalProcessed}`);
    console.log(`   Active markets: ${summary.activeMarkets}`);
    console.log(`   Inactive markets: ${summary.inactiveMarkets}`);
    console.log(`   Skipped markets: ${summary.skippedMarkets}`);
    if (openai) {
      console.log(`   🤖 AI-enhanced SEO: ${summary.aiEnhanced}/${summary.totalProcessed - summary.skippedMarkets} (${summary.completionRate}%)`);
      console.log(`      • Fresh AI generation: ${summary.freshAIGeneration}`);
      console.log(`      • Cached from database: ${summary.cachedFromDB}`);
    }

    // Generate the updated markets.js file
    const configPath = path.join(process.cwd(), 'src', 'config', 'markets.js');
    
         const configContent = `/**
 * Markets configuration with SEO metadata for each market address
 * This file is auto-generated by scripts/generate-seo.mjs
 * 
 * Last updated: ${new Date().toISOString()}
 * Total markets: ${Object.keys(marketsConfig).length}
 * Active markets: ${activeCount}
 */

export const MARKETS_CONFIG = ${JSON.stringify(marketsConfig, null, 2)};

/**
 * Get all market addresses that should be statically generated
 */
export function getStaticMarketAddresses() {
  return Object.keys(MARKETS_CONFIG);
}

/**
 * Get market configuration by address
 */
export function getMarketConfig(address) {
  return MARKETS_CONFIG[address] || null;
}

/**
 * Get all active market configurations
 */
export function getAllActiveMarkets() {
  return Object.entries(MARKETS_CONFIG)
    .filter(([_, config]) => config.isActive)
    .map(([address, config]) => ({ address, ...config }));
}

/**
 * Generate dynamic SEO metadata for a market
 */
export function generateMarketSEO(address, marketData = null) {
  const config = getMarketConfig(address);
  if (!config) return null;

  // Allow dynamic override from marketData if available
  const title = marketData?.seoTitle || config.title;
  const description = marketData?.seoDescription || config.description;
  const image = marketData?.seoImage || config.image;

  return {
    title: \`\${title} | Futarchy.fi\`,
    description,
    image,
    url: \`https://app.futarchy.fi\${config.path}\`,
    openGraph: {
      ...config.openGraph,
      title: marketData?.seoTitle ? \`\${marketData.seoTitle} | Futarchy.fi\` : config.openGraph.title,
      description: marketData?.seoDescription || config.openGraph.description,
      image: marketData?.seoImage || config.openGraph.image,
      url: \`https://app.futarchy.fi\${config.path}\`
    },
    twitter: {
      ...config.twitter,
      title: marketData?.seoTitle ? \`\${marketData.seoTitle} | Futarchy.fi\` : config.twitter.title,
      description: marketData?.seoDescription || config.twitter.description,
      image: marketData?.seoImage || config.twitter.image
    }
  };
}`;

    // Write the updated configuration file
    fs.writeFileSync(configPath, configContent, 'utf8');
    
    console.log(`\n💾 Updated markets configuration: ${configPath}`);
    console.log(`🎉 SEO generation completed successfully!`);
    console.log(`\n🔗 All market pages will be generated at:`);
    
    // Show first few markets as examples
    const allMarkets = Object.entries(marketsConfig).slice(0, 5);
      
    allMarkets.forEach(([address, config]) => {
      const status = config.isActive ? '✅ Active' : '📋 Inactive';
      console.log(`   • /markets/${address} - "${config.title}" (${status})`);
    });
    
    if (Object.keys(marketsConfig).length > 5) {
      console.log(`   • ... and ${Object.keys(marketsConfig).length - 5} more markets`);
    }

  } catch (error) {
    console.error('❌ Error generating SEO data:', error);
    process.exit(1);
  }
}

// Run the script
generateSEOData();

export { generateSEOData }; 