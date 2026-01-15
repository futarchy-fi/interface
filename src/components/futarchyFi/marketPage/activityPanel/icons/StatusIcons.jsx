import React from 'react';

export const HourglassIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M30 20 L70 20 L50 50 L70 80 L30 80 L50 50 Z"
      className="stroke-current"
      strokeWidth="4"
      fill="none"
    />
  </svg>
);

export const CheckCircleIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="50" cy="50" r="40" className="stroke-current" strokeWidth="4" fill="none" />
    <path
      d="M30 50 L45 65 L70 35"
      className="stroke-current"
      strokeWidth="4"
      fill="none"
    />
  </svg>
);

export const XCircleIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="50" cy="50" r="40" className="stroke-current" strokeWidth="4" fill="none" />
    <path
      d="M35 35 L65 65 M65 35 L35 65"
      className="stroke-current"
      strokeWidth="4"
      fill="none"
    />
  </svg>
); 