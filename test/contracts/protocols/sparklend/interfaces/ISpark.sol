// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ISparkPool {
    function ADDRESSES_PROVIDER() external view returns (address);
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

interface ISparkProvider {
    function getPoolDataProvider() external view returns (address);
}

interface ISparkDataProvider {
    function getReserveTokensAddresses(address asset) external view returns (address, address, address);
}
