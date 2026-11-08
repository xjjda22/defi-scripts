// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IRusdy {
    function usdy() external view returns (address);
    function USDY_TO_RUSDY_SHARES_MULTIPLIER() external view returns (uint256);
    function paused() external view returns (bool);
    function balanceOf(address user) external view returns (uint256);
    function sharesOf(address user) external view returns (uint256);
    function totalShares() external view returns (uint256);
    function getSharesByRUSDY(uint256 amount) external view returns (uint256);
    function getRUSDYByShares(uint256 shares) external view returns (uint256);
    function unwrap(uint256 amount) external;
}

interface IOndoVmLogs {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}
