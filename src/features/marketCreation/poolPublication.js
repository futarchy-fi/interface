/**
 * Return a newly created pool address only once per PoolCreator instance.
 * A null result means there is nothing new to publish to the parent state.
 */
export function nextPoolPublication(poolAddress, publishedAddress) {
  if (!poolAddress || poolAddress === publishedAddress) return null;
  return poolAddress;
}
