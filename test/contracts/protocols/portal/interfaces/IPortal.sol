// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IPortalTokenBridge {
    function wrapAndTransferETH(uint16 recipientChain, bytes32 recipient, uint256 arbiterFee, uint32 nonce)
        external
        payable
        returns (uint64);
}

interface IPortalCore {
    function messageFee() external view returns (uint256);
}

interface IPortalWeth {
    function balanceOf(address user) external view returns (uint256);
}

interface IPortalVmLogs {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}
