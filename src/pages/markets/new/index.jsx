// Static import (not next/dynamic ssr:false): with output:'export' the dynamic
// chunk 404'd, leaving /markets/new an empty shell in production (PR #81).
// CreateMarketFlow renders its static planner during SSG and mounts the
// wallet-connected panels client-side behind a mounted guard.
import CreateMarketFlow from '../../../components/futarchyFi/createMarket/CreateMarketFlow';

export default function NewMarketPage() {
  return <CreateMarketFlow />;
}
