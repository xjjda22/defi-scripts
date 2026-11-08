// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Only the Spoke surface this test calls. Aave V4 Spokes keep accounting on one
/// Liquidity Hub; the reserve struct names the Hub and the underlying token.
interface IEtherfiCashLiquid {
    struct Reserve {
        address underlying;
        address hub;
        uint16 assetId;
        uint8 decimals;
        uint24 collateralRisk;
        uint8 flags;
        uint32 dynamicConfigKey;
    }

    struct ReserveConfig {
        uint24 collateralRisk;
        bool paused;
        bool frozen;
        bool borrowable;
        bool receiveSharesEnabled;
    }

    function getReserve(uint256 reserveId) external view returns (Reserve memory);
    function getReserveConfig(uint256 reserveId) external view returns (ReserveConfig memory);
    function getUserSuppliedAssets(uint256 reserveId, address user) external view returns (uint256);
    function getUserSuppliedShares(uint256 reserveId, address user) external view returns (uint256);
    function supply(uint256 reserveId, uint256 amount, address onBehalfOf) external returns (uint256, uint256);
    function withdraw(uint256 reserveId, uint256 amount, address onBehalfOf) external returns (uint256, uint256);
}
