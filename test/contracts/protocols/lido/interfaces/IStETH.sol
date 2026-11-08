// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Only the surface the fork test calls.
///
/// There is deliberately no `getLido()`: stETH has never exposed that selector.
/// Its dispatcher falls through to the `Lido.sol` fallback, which requires empty
/// calldata and reverts `NON_EMPTY_DATA` — probed on mainnet at block 26363300
/// and at 20000000. The app-only getter that does exist is `getLidoLocator()`,
/// and it is what the test uses as the "this is stETH" probe.
interface IStETH {
    function submit(address _referral) external payable returns (uint256);

    function balanceOf(address) external view returns (uint256);

    function getLidoLocator() external view returns (address);

    /// `submit` returns minted shares, so this converts them back to stETH.
    /// It is also exactly how `balanceOf` is computed.
    function getPooledEthByShares(uint256 _sharesAmount) external view returns (uint256);

    function getTotalShares() external view returns (uint256);

    function totalSupply() external view returns (uint256);
}
