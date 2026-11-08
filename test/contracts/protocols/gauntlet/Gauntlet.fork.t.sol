// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IGauntletVault {
    function asset() external view returns (address);
    function previewDeposit(uint256) external view returns (uint256);
    function deposit(uint256, address) external returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function feeRecipient() external view returns (address);
    function convertToAssets(uint256) external view returns (uint256);
    function maxDeposit(address) external view returns (uint256);
}

interface IGauntletUsdc {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

contract GauntletForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_gauntlet_deposit() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("ETHEREUM_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address target = Addresses.Gauntlet.GAUNTLET_USDC_PRIME;
        address usdc = Addresses.Tokens.USDC_ETHEREUM;
        _requireCode(target);
        _requireCode(usdc);
        IGauntletVault vault = IGauntletVault(target);
        // Implementation-only asset and preview calls validate proxy routing as well as ABI.
        assertEq(vault.asset(), usdc, "USDC asset");
        address user = address(uint160(uint256(keccak256("w1b gauntlet depositor"))));
        uint256 amount = 100e6;
        require(vault.maxDeposit(user) >= amount, "deposit capacity");
        uint256 preview = vault.previewDeposit(amount);
        require(preview > 0, "zero preview");
        // Documented USDC balance slot 9 (W0 Aave fixture).
        vm.store(usdc, keccak256(abi.encode(user, uint256(9))), bytes32(amount));
        uint256 supply = vault.totalSupply();
        address feeRecipient = vault.feeRecipient();
        uint256 feeSharesBefore = vault.balanceOf(feeRecipient);
        uint256 beforeShares = vault.balanceOf(user);
        vm.startPrank(user);
        IGauntletUsdc(usdc).approve(target, amount);
        uint256 minted = vault.deposit(amount, user);
        vm.stopPrank();
        assertEq(vault.balanceOf(user) - beforeShares, minted, "user shares");
        // MetaMorpho crystallizes pending performance fees in the deposit transaction.
        // Every share minted beyond the depositor's return must belong to feeRecipient.
        uint256 feeShares = vault.balanceOf(feeRecipient) - feeSharesBefore;
        assertEq(vault.totalSupply() - supply, minted + feeShares, "supply incl performance fees");
        emit log_named_uint("performance-fee shares minted", feeShares);
        require(minted > 0 && minted <= preview && preview - minted <= preview / 1e6 + 1, "preview rounding");
        assertEq(IGauntletUsdc(usdc).balanceOf(user), 0, "USDC spent");
        uint256 valued = vault.convertToAssets(minted);
        require(valued >= amount * 99 / 100 && valued <= amount * 101 / 100, "share asset value");
        emit log_named_uint("shares minted", minted);
        emit log_named_uint("USDC share value", valued);
    }
}
