// This folder will contain the JSON ABIs for the contracts
export const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)"
];

export const FUTARCHY_ROUTER_ABI = [
    "function split(uint256 amount) external",
    "function merge(uint256 amount) external",
    "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)"
];
