// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// StakeWise V3 Genesis Vault surface used by the deposit primitive.
interface IStakewiseVault {
    function depositAndMintOsToken(address receiver, uint256 osTokenShares, address referrer)
        external
        payable
        returns (uint256);
    function convertToShares(uint256 assets) external view returns (uint256);
    function getShares(address account) external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function isStateUpdateRequired() external view returns (bool);
    function capacity() external view returns (uint256);
    function osTokenPositions(address user) external view returns (uint128);
}

interface IStakewiseController {
    function convertToShares(uint256 assets) external view returns (uint256);
}

interface IStakewiseVaultsRegistry {
    function vaults(address vault) external view returns (bool);
}

/// `recordLogs`/`getRecordedLogs` are absent from the shared `Vm`; the local form lets
/// the test decode the exact `Deposited` payload, whose share count is only known after
/// the transaction (it can drift one wei from the pre-tx `convertToShares`).
interface IStakewiseVmLogs {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}
