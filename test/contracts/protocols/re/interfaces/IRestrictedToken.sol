// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IRestrictedToken {
    function totalSupply() external view returns (uint256);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}
