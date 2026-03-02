/**
 * Image utility functions for handling company images dynamically
 * Eliminates hardcoded image mappings by using backend data with smart fallbacks
 */

/**
 * Get company image with fallback strategy
 * Priority: backend image field > backend logo field > generated fallback
 *
 * @param {Object} companyData - Company data from API
 * @param {string} companyData.image - Primary image URL from backend
 * @param {string} companyData.logo - Alternative logo URL from backend
 * @param {string} companyData.logo_url - Alternative logo_url field
 * @param {string} companyData.name - Company name for fallback generation
 * @param {number|string} companyData.id - Company ID for color generation
 * @returns {string} Image URL
 */
export function getCompanyImage(companyData) {
  if (!companyData) {
    return getDefaultFallbackImage();
  }

  // Priority 1: Backend 'image' field (main image column)
  if (companyData.image && companyData.image.trim() !== '') {
    return companyData.image;
  }

  // Priority 2: Backend 'logo' field (alternative)
  if (companyData.logo && companyData.logo.trim() !== '') {
    return companyData.logo;
  }

  // Priority 3: Backend 'logo_url' field (alternative)
  if (companyData.logo_url && companyData.logo_url.trim() !== '') {
    return companyData.logo_url;
  }

  // Priority 4: Generate fallback avatar
  return generateFallbackImage(
    companyData.name || 'Unknown',
    companyData.id || 0
  );
}

/**
 * Generate fallback image using UI Avatars API
 * Creates a dynamic avatar with company initials and consistent color
 *
 * @param {string} name - Company name
 * @param {number|string} id - Company ID (used for consistent color generation)
 * @returns {string} Fallback image URL
 */
export function generateFallbackImage(name, id) {
  const initials = getInitials(name);
  const bgColor = generateColorFromId(id);

  // Use UI Avatars service to generate dynamic placeholder
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=200&background=${bgColor}&color=fff&bold=true&rounded=true`;
}

/**
 * Get initials from company name (first letter of first two words)
 *
 * @param {string} name - Company name
 * @returns {string} Initials (max 2 characters)
 */
export function getInitials(name) {
  if (!name || typeof name !== 'string') {
    return 'CO'; // Default: "CO" for Company
  }

  return name
    .split(' ')
    .filter(word => word.length > 0) // Remove empty strings
    .map(word => word[0].toUpperCase())
    .join('')
    .slice(0, 2); // Max 2 letters
}

/**
 * Generate consistent color from company ID
 * Uses predefined palette for visual consistency
 *
 * @param {number|string} id - Company ID
 * @returns {string} Hex color without '#' (e.g., '4F46E5')
 */
export function generateColorFromId(id) {
  // Predefined color palette (Tailwind colors)
  const colors = [
    '4F46E5', // Indigo-600
    '7C3AED', // Violet-600
    'DB2777', // Pink-600
    'DC2626', // Red-600
    '059669', // Emerald-600
    '2563EB', // Blue-600
    'EA580C', // Orange-600
    '16A34A', // Green-600
    '9333EA', // Purple-600
    'CA8A04', // Yellow-600
  ];

  // Convert ID to number if string
  const numericId = typeof id === 'string' ? parseInt(id) || 0 : id;

  // Return color based on ID modulo array length
  return colors[numericId % colors.length];
}

/**
 * Verify if image URL is accessible (client-side check)
 * Useful for validating images before displaying
 *
 * @param {string} url - Image URL to verify
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<boolean>} True if image loads successfully
 */
export async function verifyImageUrl(url, timeout = 5000) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      resolve(true);
    };

    img.onerror = () => {
      resolve(false);
    };

    // Set timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      resolve(false);
    }, timeout);

    img.src = url;

    // Clear timeout if image loads/fails before timeout
    img.onload = () => {
      clearTimeout(timeoutId);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(timeoutId);
      resolve(false);
    };
  });
}

/**
 * Get verified company image with async validation
 * Checks if image URL is accessible, falls back if not
 *
 * @param {Object} companyData - Company data
 * @returns {Promise<string>} Verified image URL or fallback
 */
export async function getVerifiedCompanyImage(companyData) {
  const imageUrl = getCompanyImage(companyData);

  // If it's a generated fallback (UI Avatars), no need to verify
  if (imageUrl.includes('ui-avatars.com')) {
    return imageUrl;
  }

  // Try to verify the image
  const isValid = await verifyImageUrl(imageUrl);

  if (isValid) {
    return imageUrl;
  }

  // If verification failed, return generated fallback
  console.warn(`[imageUtils] Image verification failed for ${companyData.name}, using fallback`);
  return generateFallbackImage(companyData.name, companyData.id);
}

/**
 * Get default fallback image (last resort)
 * Used when company data is missing or invalid
 *
 * @returns {string} Default fallback image URL
 */
export function getDefaultFallbackImage() {
  // Option 1: Use UI Avatars with generic initials
  return 'https://ui-avatars.com/api/?name=CO&size=200&background=6B7280&color=fff&bold=true&rounded=true';

  // Option 2: Use local fallback (if exists)
  // return '/assets/default-company-logo.png';
}

/**
 * Generate color from string (alternative to ID-based color)
 * Creates consistent color hash from company name
 *
 * @param {string} str - String to hash
 * @returns {string} Hex color without '#'
 */
export function generateColorFromString(str) {
  if (!str || typeof str !== 'string') {
    return '6B7280'; // Gray-500 default
  }

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }

  const color = Math.abs(hash).toString(16).slice(0, 6).padStart(6, '0');
  return color;
}

/**
 * Preload image (useful for smoother loading)
 *
 * @param {string} url - Image URL to preload
 * @returns {Promise<boolean>} True if preloaded successfully
 */
export async function preloadImage(url) {
  return verifyImageUrl(url);
}

/**
 * Get responsive image sizes
 * Returns different URLs for different screen sizes (if backend supports it)
 *
 * @param {string} baseUrl - Base image URL
 * @param {Object} sizes - Size configurations
 * @returns {Object} Responsive image URLs
 */
export function getResponsiveImageUrls(baseUrl, sizes = { sm: 200, md: 400, lg: 800 }) {
  // If using a CDN that supports image resizing (like Cloudflare, Imgix)
  // you can append size parameters here

  // For now, return same URL for all sizes
  // TODO: Implement when using image CDN
  return {
    small: baseUrl,
    medium: baseUrl,
    large: baseUrl,
  };
}
