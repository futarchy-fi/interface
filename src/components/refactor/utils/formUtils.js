// Form validation utilities
export const validateAddress = (address) => {
  if (!address) return { isValid: false, error: 'Address is required' };
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { isValid: false, error: 'Invalid address format' };
  }
  return { isValid: true };
};

export const validateRequired = (value, fieldName) => {
  if (!value || !value.trim()) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  return { isValid: true };
};

export const validateDateTime = (dateTimeString) => {
  if (!dateTimeString) {
    return { isValid: false, error: 'Date and time is required' };
  }
  
  const timestamp = new Date(dateTimeString).getTime();
  if (isNaN(timestamp)) {
    return { isValid: false, error: 'Invalid date format' };
  }
  
  if (timestamp <= Date.now()) {
    return { isValid: false, error: 'Date must be in the future' };
  }
  
  return { isValid: true };
};

// Status styling utilities
export const getStatusStyle = (type) => {
  switch (type) {
    case 'error':
      return 'bg-red-50 border-red-200 text-red-700';
    case 'success':
      return 'bg-green-50 border-green-200 text-green-700';
    case 'info':
      return 'bg-blue-50 border-blue-200 text-blue-700';
    case 'warning':
      return 'bg-yellow-50 border-yellow-200 text-yellow-700';
    default:
      return 'bg-gray-50 border-gray-200 text-gray-700';
  }
};

// Form input utilities
export const formatInputClassName = (hasError = false) => {
  const baseClasses = 'w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none';
  const errorClasses = hasError 
    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500';
  
  return `${baseClasses} ${errorClasses}`;
};

export const formatMonoInputClassName = (hasError = false) => {
  return `${formatInputClassName(hasError)} font-mono text-sm`;
}; 