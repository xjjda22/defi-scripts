// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// The ERC-20 metadata and supply surface this read-only test calls. PST is a
/// CCIP cross-chain token, not an ERC-4626 vault: there is no asset()/totalAssets().
interface IHumaPst {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
}
