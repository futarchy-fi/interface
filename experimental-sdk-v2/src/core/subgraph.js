import { request, gql } from 'graphql-request';
import { SUBGRAPH_URL, MARKET_SUBGRAPH_URL } from '../config/constants.js';

export class SubgraphClient {
    constructor() {
        this.hierarchyUrl = SUBGRAPH_URL;
        this.marketUrl = MARKET_SUBGRAPH_URL;
    }

    async query(document, variables = {}, useMarket = false) {
        const url = useMarket ? this.marketUrl : this.hierarchyUrl;
        return request(url, document, variables);
    }

    async getProposalDetails(id) {
        // Hierarchy Subgraph
        const query = gql`
            query GetProposalDetails($id: ID!) {
                proposal(id: $id) {
                    id
                    marketName
                    description
                    currencyToken { id symbol decimals }
                    outcomeTokens { id symbol decimals role }
                    pools {
                        id
                        name
                        type
                        outcomeSide
                        liquidity
                        tick
                        token0 { id symbol decimals role }
                        token1 { id symbol decimals role }
                    }
                }
            }
        `;
        return this.query(query, { id: id.toLowerCase() });
    }

    async getAggregator(id) {
        const query = gql`
            query GetAggregator($id: ID!) {
                aggregator(id: $id) {
                    id
                    name
                    description
                    metadata
                    owner
                    editor
                    organizations {
                        id
                        name
                        description
                        proposals {
                            id
                            marketName
                            metadataContract
                        }
                    }
                }
            }
        `;
        return this.query(query, { id: id.toLowerCase() });
    }

    async getOrganization(id) {
        const query = gql`
            query GetOrganization($id: ID!) {
                organization(id: $id) {
                    id
                    name
                    description
                    proposals {
                        id
                        marketName
                        metadataContract
                    }
                }
            }
        `;
        return this.query(query, { id: id.toLowerCase() });
    }

    async getPools(proposalId) {
        // Market Subgraph: used to find pools even if not linked in hierarchy
        const query = gql`
            query GetPools($proposalId: String!) {
                pools(where: { proposal: $proposalId }) {
                    id
                    name
                    type
                    outcomeSide
                    liquidity
                    tick
                    token0 { symbol decimals role }
                    token1 { symbol decimals role }
                }
            }
        `;
        return this.query(query, { proposalId: proposalId.toLowerCase() }, true);
    }

    async getSwaps(poolIds, limit = 10) {
        // Market Subgraph
        const query = gql`
            query GetSwaps($poolIds: [String!]!, $limit: Int!) {
                swaps(
                    where: { pool_in: $poolIds }
                    first: $limit
                    orderBy: timestamp
                    orderDirection: desc
                ) {
                    transactionHash
                    timestamp
                    amountIn
                    amountOut
                    tokenIn { symbol role }
                    tokenOut { symbol role }
                    pool { outcomeSide }
                    origin
                }
            }
        `;
        return this.query(query, { poolIds, limit }, true);
    }

    async getCandles(poolId, limit = 50) {
        // Market Subgraph
        const query = gql`
            query GetCandles($poolId: String!, $limit: Int!) {
                candles(
                    where: { pool: $poolId }
                    first: $limit
                    orderBy: periodStartUnix
                    orderDirection: desc
                ) {
                    periodStartUnix
                    open
                    high
                    low
                    close
                    volumeUSD
                }
            }
        `;
        return this.query(query, { poolId: poolId.toLowerCase(), limit }, true);
    }
}
