// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// OP Stack source-chain entry points, limited to the functions this test calls.
interface IL1StandardBridge {
    function depositETH(uint32 _minGasLimit, bytes calldata _extraData) external payable;
    function messenger() external view returns (address);
    function systemConfig() external view returns (address);
}

interface IOptimismPortal {
    function ethLockbox() external view returns (address);
    function paused() external view returns (bool);
}

/// Cheatcodes the shared helper does not declare: the emitter-scoped 5-arg expectEmit (as in
/// PolygonBridge) and the 2-arg prank, because L1StandardBridge rejects msg.sender != tx.origin.
interface IWorldChainVm {
    function expectEmit(bool topic1, bool topic2, bool topic3, bool data, address emitter) external;
    function prank(address sender, address origin) external;
}
