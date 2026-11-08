// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ISsvNetwork {
    function registerOperator(bytes calldata publicKey, uint256 fee, bool setPrivate)
        external
        returns (uint64 id);
}

interface ISsvNetworkViews {
    struct OperatorData {
        address owner;
        uint256 fee;
        uint32 validatorCount;
        address whitelistedAddress;
        bool isPrivate;
        bool isActive;
    }
    function getOperatorById(uint64 operatorId) external view returns (OperatorData memory);
}

interface ISsvVmLogs {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}
