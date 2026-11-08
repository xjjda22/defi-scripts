// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IRootChainManager {
    function depositEtherFor(address user) external payable;
    function implementation() external view returns (address);
}

interface IEtherPredicate {
    function implementation() external view returns (address);
}
