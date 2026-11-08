// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Minimal ERC-20 surface the protocol fork tests need: a balance read, an
/// approval for the pool/router, and the metadata getters used for identity.
interface IERC20 {
    function balanceOf(address owner) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
}
