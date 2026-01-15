export const TRADE_MESSAGES = {
    ERRORS: {
        INSUFFICIENT_DIRECT_BALANCE: "Your wallet balance is low. Split sDAI to mint the required tokens.",
        INSUFFICIENT_BALANCE: "Insufficient balance for this trade.",
    },
    WARNINGS: {
        SPLIT_REQUIRED: "You need to split sDAI to get more outcome tokens.",
    },
    LABELS: {
        SPLIT_BUTTON: (amount: string, token: string) => `Split ${amount} ${token}`,
        TRADE_BUTTON: (action: string, outcome: string) => `${action} ${outcome}`,
    },
    ACTIONS: {
        BUY: "Buy",
        SELL: "Sell"
    },
    HEADERS: {
        POOL_TYPE: "Pool Type",
        OUTCOME: "Outcome"
    },
    OPTIONS: {
        PREDICTION: { LABEL: "Prediction", SUB: "sDAI" },
        EXPECTED_VALUE: { LABEL: "Expected Value", SUB: "Company" },
        CONDITIONAL: { LABEL: "Conditional", SUB: "Outcomes" }
    },
    INPUTS: {
        PAY: "Pay",
        RECEIVE: "Receive"
    },
    OUTCOMES: {
        YES: "YES",
        NO: "NO"
    },
    TOOLTIPS: {
        COLLATERAL_AVAILABLE: (amount: string) => `+ ${amount} sDAI available to split`
    }
} as const;

export const MARKET_HERO_MESSAGES = {
    LABELS: {
        IMPACT: "Impact",
        STATUS: "Status",
        ACTIVE: "Active",
        VOLUME: "Volume (Total; sDAI)",
        LIQUIDITY: "Liquidity (Total; sDAI)",
        REMAINING_TIME: "Remaining Time",
        PREDICTION_MARKET: "Prediction Market",
        RESOLVE_QUESTION: "Resolve Question",
        ADD_LIQUIDITY: "Add Liquidity",
        SCROLL_DOWN: "Scroll Down",
        BREAKDOWN: "Breakdown",
        YES_VOLUME: "YES Volume",
        NO_VOLUME: "NO Volume",
        YES_TOTAL: "YES Total",
        NO_TOTAL: "NO Total"
    },
    LOADING: "Loading Market..."
} as const;

export const PORTFOLIO_MESSAGES = {
    HEADERS: {
        TITLE: "Your Positions",
        TOTAL_VALUE: "Total Value:",
        TOTAL_PNL: "Total PnL:",
        MARKET: "Market",
        SIDE: "Side",
        AVG_PRICE: "Avg Price",
        CURRENT: "Current",
        VALUE: "Value",
        PNL: "PnL"
    },
    LOADING: "Loading Positions..."
} as const;

export const COMPANY_TABLE_MESSAGES = {
    HEADERS: {
        TITLE: "Active Markets",
        SUBTITLE_SUFFIX: "DAOs Listed",
        COMPANY: "Company",
        DESCRIPTION: "Description",
        PROPOSALS: "Proposals",
        TREASURY: "Treasury",
        ACTION: "Action"
    },
    LOADING: "Loading Companies..."
} as const;

export const COMPANY_DETAIL_MESSAGES = {
    LOADING: "Loading Organization...",
    BACK_TO_DASHBOARD: "Back to Dashboard",
    STATS: {
        DELEGATES: "Delegates",
        TOKEN_HOLDERS: "token holders",
        PROPOSALS: "Proposals",
        ACTIVE_PROPOSALS: "Active proposals",
        TREASURY: "Treasury",
        TREASURY_SOURCE: "treasury source"
    },
    TABS: {
        PROPOSALS: "Proposals",
        NEW: "New"
    },
    SEARCH_PLACEHOLDER: "Search proposals...",
    PROPOSAL_CARD: {
        ENDS: "Ends",
        VOL: "Vol",
        ADDRESSES: "addresses"
    },
    SIDEBAR: {
        ABOUT: "About",
        WEBSITE: "Website",
        TWITTER: "Twitter",
        VOTING_POWER: "My Voting Power",
        VIEW_DETAILS: "View Details",
        CONTRACTS: "Contracts & Params",
        EDITORS: "Page Editors"
    }
} as const;

export const MARKET_CHART_MESSAGES = {
    TITLE: "Conditional Prices",
    STATS: {
        PAIR: "Trading Pair",
        SPOT: "Spot Price",
        YES: "Yes Price",
        NO: "No Price",
        PROB: "Event Prob",
        IMPACT: "Impact"
    },
    ACTIVITY: {
        FILTERS: {
            LAST_30: "Last 30 trades",
            LAST_60: "Last 60 trades",
            LAST_90: "Last 90 trades"
        },
        HEADERS: {
            OUTCOME: "Outcome",
            AMOUNT: "Amount",
            PRICE: "Price",
            DATE: "Date"
        }
    }
} as const;

export const TRANSACTION_MODAL_MESSAGES = {
    ANALYZING: "Analyzing Transaction...",
    CONFIRM: "Confirm Transaction",
    COMPLETE: "Transaction Complete",
    ESTIMATING: "Estimating Balance Change",
    LEAVING: "LEAVING WALLET",
    ENTERING: "ENTERING WALLET",
    ASSET_IN: "Asset In",
    ASSET_OUT: "Asset Out",
    METHOD: "Method",
    TARGET: "Target",
    STATUS: {
        CHECK_WALLET: "Check Wallet...",
        PROCESSING: "Processing",
        SUCCESS: "Success"
    }
} as const;

export const MARKET_PULSE_MESSAGES = {
    HEADER: "My Positions",
    NET_EXPOSURE: "Net Exposure",
    MERGEABLE: "Mergeable",
    PAIRS: "Pairs",
    BUTTONS: {
        MERGE: "Merge"
    }
} as const;
