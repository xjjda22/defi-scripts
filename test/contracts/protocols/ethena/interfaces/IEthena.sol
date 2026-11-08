// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IStakedUsde {
    function asset() external view returns (address);
    function previewDeposit(uint256 amount) external view returns (uint256);
    function deposit(uint256 amount, address user) external returns (uint256);
    function balanceOf(address user) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

interface IUsde {
    function balanceOf(address user) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}
