// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// The Aave V3 pool surface these fork tests touch: the supply entry point, the
/// getter that proves the address is a real pool (its `ADDRESSES_PROVIDER`
/// points at the pool-addresses provider deployed in front of it), and the
/// per-user account data snapshot.
interface IAaveV3Pool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;

    function ADDRESSES_PROVIDER() external view returns (address);

    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
}
