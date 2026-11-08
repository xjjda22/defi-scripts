// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IRootChainManager {
    function depositEtherFor(address user) external payable;
    function implementation() external view returns (address);
}

interface IEtherPredicate {
    function implementation() external view returns (address);
}

interface IPolygonVmEmit {
    function expectEmit(bool topic1, bool topic2, bool topic3, bool data, address emitter) external;
}
