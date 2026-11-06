// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
/// Price mock installed over an oracle with anvil_setCode. Every getter returns the value stored at
/// PRICE_SLOT (set with anvil_setStorageAt), so the original contract's storage layout is untouched.
contract MockPrice {
    bytes32 internal constant PRICE_SLOT = keccak256("defi-scripts.mock.price");
    bytes32 internal constant DEC_SLOT = keccak256("defi-scripts.mock.decimals");
    function _p() internal view returns (uint256 v) { bytes32 s = PRICE_SLOT; assembly { v := sload(s) } }
    function decimals() external view returns (uint8) { bytes32 s = DEC_SLOT; uint256 d; assembly { d := sload(s) } return d == 0 ? 8 : uint8(d); }
    function latestAnswer() external view returns (int256) { return int256(_p()); }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) { return (1, int256(_p()), block.timestamp, block.timestamp, 1); }
    function price() external view returns (uint256) { return _p(); }
    function price_w() external returns (uint256) { return _p(); }
    /// Liquity V1 PriceFeed and similar oracles.
    function fetchPrice() external view returns (uint256) { return _p(); }
}

