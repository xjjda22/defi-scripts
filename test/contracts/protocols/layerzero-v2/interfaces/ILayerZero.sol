// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IOftAdapter {
    struct SendParam {
        uint32 dstEid;
        bytes32 to;
        uint256 amountLD;
        uint256 minAmountLD;
        bytes extraOptions;
        bytes composeMsg;
        bytes oftCmd;
    }

    struct Fee {
        uint256 nativeFee;
        uint256 lzTokenFee;
    }

    struct Limit {
        uint256 minAmountLD;
        uint256 maxAmountLD;
    }

    struct FeeDetail {
        int256 feeAmountLD;
        string description;
    }

    struct OftReceipt {
        uint256 amountSentLD;
        uint256 amountReceivedLD;
    }

    struct MessageReceipt {
        bytes32 guid;
        uint64 nonce;
        Fee fee;
    }
    function token() external view returns (address);
    function endpoint() external view returns (address);
    function peers(uint32 eid) external view returns (bytes32);
    function quoteOFT(SendParam calldata param)
        external
        view
        returns (Limit memory, FeeDetail[] memory, OftReceipt memory);
    function quoteSend(SendParam calldata param, bool payInLzToken) external view returns (Fee memory);
    function send(SendParam calldata param, Fee calldata fee, address refund)
        external
        payable
        returns (MessageReceipt memory, OftReceipt memory);
}

interface ILayerZeroEndpoint {
    function eid() external view returns (uint32);
    function getSendLibrary(address sender, uint32 dstEid) external view returns (address);
    function outboundNonce(address sender, uint32 dstEid, bytes32 receiver) external view returns (uint64);
}

interface ILayerZeroUsdt {
    function balanceOf(address user) external view returns (uint256);
    function approve(address spender, uint256 amount) external;
    function transfer(address user, uint256 amount) external;
}

/// Protocol-local extension; do not widen the shared harness for one event check.
interface ILayerZeroVmLogs {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}
