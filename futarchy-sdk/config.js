// config.js - Configuration with Environment Variables Support

// Load environment variables from .env file
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

export const config = {
    // Supabase configuration - reads from environment variables with fallbacks
    supabaseUrl: process.env.SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co',
    supabaseKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI1ODI4NjcsImV4cCI6MjAyODE1ODg2N30.i7q3kKFfS1g9wnzl0hHZPgQ-bKZKF8FKJqJj9Jc7jA0',
    
    // Default pools for testing - can be overridden by environment variables
    defaultPools: {
        yes: process.env.DEFAULT_YES_POOL || '0xF336F812Db1ad142F22A9A4dd43D40e64B478361',
        no: process.env.DEFAULT_NO_POOL || '0xfbf1BE5CE2f9056dAaB1C368EC241ad7Be3507A8',
        base: process.env.DEFAULT_BASE_POOL || '0x88A8ABD96A2e7ceF3B15cB42c11BE862312BA5Da'
    },
    
    // Default intervals (in milliseconds)
    intervals: {
        '1m': '60000',
        '1h': '3600000', 
        '1d': '86400000'
    },
    
    // Helper function to check if we're using default (potentially invalid) credentials
    isUsingDefaultCredentials() {
        return !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY;
    },
    
    // Helper function to validate configuration
    validate() {
        const errors = [];
        
        if (!this.supabaseUrl || !this.supabaseUrl.startsWith('https://')) {
            errors.push('Invalid SUPABASE_URL - must be a valid HTTPS URL');
        }
        
        if (!this.supabaseKey || this.supabaseKey.length < 50) {
            errors.push('Invalid SUPABASE_ANON_KEY - must be a valid JWT token');
        }
        
        // Check if using placeholder values
        if (this.supabaseUrl.includes('your-project-id')) {
            errors.push('SUPABASE_URL is still using placeholder value');
        }
        
        if (this.supabaseKey.includes('your_supabase_anon_key_here')) {
            errors.push('SUPABASE_ANON_KEY is still using placeholder value');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    },
    
    // Helper function to get environment info
    getEnvironmentInfo() {
        return {
            hasEnvFile: process.env.NODE_ENV !== undefined,
            usingDefaults: this.isUsingDefaultCredentials(),
            supabaseConfigured: this.validate().isValid,
            availablePools: Object.keys(this.defaultPools).length,
            availableIntervals: Object.keys(this.intervals).length
        };
    }
}; 