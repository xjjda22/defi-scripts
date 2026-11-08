// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IRestrictedToken {
    function totalSupply() external view returns (uint256);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

interface INestVault {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
}
