// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IMaplePool {
    function asset() external view returns (address);
    function manager() external view returns (address);
    function totalSupply() external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function symbol() external view returns (string memory);
}

interface IMapleManager {
    function pool() external view returns (address);
}
