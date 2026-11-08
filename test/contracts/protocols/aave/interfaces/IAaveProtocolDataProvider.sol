// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// The subset of Aave V3's PoolDataProvider the tests use. The deployed
/// provider is `Addresses.Aave.V3_DATA_PROVIDER`; this call is the documented
/// way to resolve an asset's aToken without hardcoding a token address.
interface IAaveProtocolDataProvider {
    function getReserveTokensAddresses(address asset)
        external
        view
        returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress);
}
