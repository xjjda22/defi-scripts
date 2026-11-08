// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// NEAR Omni Bridge source-chain entry point, limited to the function this test calls.
interface IOmniBridge {
    function initTransfer(
        address tokenAddress,
        uint128 amount,
        uint128 fee,
        uint128 nativeFee,
        string calldata recipient,
        string calldata message
    ) external payable;
}

/// Recorded-log surface: InitTransfer carries an unpredictable indexed originNonce, so the
/// event is decoded from the recorded logs instead of matched with expectEmit.
interface IVmLogs {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}
