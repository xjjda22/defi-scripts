// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
interface IERC20 { function approve(address,uint256) external returns (bool); function balanceOf(address) external view returns (uint256); }
/// Aave/Spark flashLoanSimple receiver: approves amount+premium back to the pool.
contract AaveFlashReceiver {
    address public immutable pool;
    uint256 public seenAmount; uint256 public seenPremium; uint256 public seenBalance;
    constructor(address p) { pool = p; }
    function executeOperation(address asset, uint256 amount, uint256 premium, address, bytes calldata) external returns (bool) {
        require(msg.sender == pool, "pool");
        seenAmount = amount; seenPremium = premium; seenBalance = IERC20(asset).balanceOf(address(this));
        IERC20(asset).approve(pool, amount + premium);
        return true;
    }
}
/// Morpho Blue flashLoan callback: approves the amount back.
contract MorphoFlashReceiver {
    address public immutable morpho; address public token;
    uint256 public seenAmount; uint256 public seenBalance;
    constructor(address m) { morpho = m; }
    function run(address t, uint256 amount) external { token = t; IMorpho(morpho).flashLoan(t, amount, ""); }
    function onMorphoFlashLoan(uint256 assets, bytes calldata) external {
        require(msg.sender == morpho, "morpho");
        seenAmount = assets; seenBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).approve(morpho, assets);
    }
}
interface IMorpho { function flashLoan(address token, uint256 assets, bytes calldata data) external; }
