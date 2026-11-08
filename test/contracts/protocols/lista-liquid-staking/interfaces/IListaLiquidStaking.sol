// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Lista liquid staking (BSC), limited to the functions this test calls.
interface IListaStakeManager {
    function deposit() external payable;
    function paused() external view returns (bool);
}

interface ISlisBNB {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
}

/// Recorded-log surface: the minted share amount is only known after deposit() runs, so the
/// mint Transfer is decoded from the recorded logs and compared to the measured delta.
interface IVmLogs {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}
