// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ICcipRouter {
    struct TokenAmount {
        address token;
        uint256 amount;
    }

    struct Message {
        bytes receiver;
        bytes data;
        TokenAmount[] tokenAmounts;
        address feeToken;
        bytes extraArgs;
    }
    function getFee(uint64 destination, Message calldata message) external view returns (uint256);
    function getOnRamp(uint64 destination) external view returns (address);
    function ccipSend(uint64 destination, Message calldata message) external payable returns (bytes32);
}

interface ICcipRegistry {
    function getPool(address token) external view returns (address);
}

interface ILink {
    function balanceOf(address user) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address user, uint256 amount) external returns (bool);
}
