// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ITether {
    function balanceOf(address user) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint256);
    function symbol() external view returns (string memory);
    function transfer(address user, uint256 amount) external;
}
