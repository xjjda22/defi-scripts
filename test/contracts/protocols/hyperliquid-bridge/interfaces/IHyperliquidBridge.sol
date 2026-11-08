// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IBridge2 {
    function paused() external view returns (bool);
    function usdcToken() external view returns (address);
}

interface IBridgeUsdc {
    function balanceOf(address user) external view returns (uint256);
    function transfer(address user, uint256 amount) external returns (bool);
}
