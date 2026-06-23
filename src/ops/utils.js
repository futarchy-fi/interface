export function addressesEqual(a, b) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

export function formatValue(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return '';
  return String(value);
}

export function shortAddress(address) {
  if (!address || address.length < 12) return address || '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getErrorMessage(error) {
  if (!error) return '';
  return error.shortMessage || error.details || error.message || String(error);
}
