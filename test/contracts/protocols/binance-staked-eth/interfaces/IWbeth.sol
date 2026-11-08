// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IWbeth {
    function exchangeRate() external view returns (uint256);
    function deposit(address referral) external payable;
    function balanceOf(address user) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}
