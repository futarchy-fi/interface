import React, { useMemo } from 'react';

// Simple generative background animation
const FutarchyTileAnimation = ({ seed }) => {
  // Use seed to create variations in timing/paths if desired
  // For simplicity, let's use a subtle pulsing dot grid animation
  const duration1 = useMemo(() => 2 + Math.random() * 2, [seed]); // Random duration between 2s and 4s
  const duration2 = useMemo(() => 3 + Math.random() * 3, [seed]); // Random duration between 3s and 6s

  return (
    <svg className="absolute inset-0 w-full h-full z-0" preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={`pattern-${seed}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1" fill="currentColor" className="opacity-10 animate-pulse-slow" />
        </pattern>
        <radialGradient id={`grad-${seed}-1`}>
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`grad-${seed}-2`}>
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Background Pattern */}
      <rect width="100%" height="100%" fill={`url(#pattern-${seed})`} className="text-futarchyGray11 dark:text-futarchyGray112" />
      {/* Pulsing Gradient Circles for subtle movement */}
      <circle cx="20%" cy="30%" r="50%" fill={`url(#grad-${seed}-1)`} className="text-futarchyBlue9 dark:text-futarchyBlue7">
        <animate attributeName="r" values="40%;60%;40%" dur={`${duration1}s`} repeatCount="indefinite" />
      </circle>
      <circle cx="80%" cy="70%" r="60%" fill={`url(#grad-${seed}-2)`} className="text-futarchyPurple8 dark:text-futarchyPurple6">
        <animate attributeName="r" values="50%;70%;50%" dur={`${duration2}s`} repeatCount="indefinite" />
      </circle>

      <style>{`
        .animate-pulse-slow {
          animation: pulse-opacity 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse-opacity {
          0%, 100% { opacity: 0.05; }
          50% { opacity: 0.15; }
        }
      `}</style>
    </svg>
  );
};

export default FutarchyTileAnimation; 