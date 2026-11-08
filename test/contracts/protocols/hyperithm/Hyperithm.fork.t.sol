// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IHyperithmVault {
    function asset() external view returns (address);
    function previewDeposit(uint256) external view returns (uint256);
    function deposit(uint256, address) external returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function performanceFeeRecipient() external view returns (address);
    function managementFeeRecipient() external view returns (address);
    function convertToAssets(uint256) external view returns (uint256);
    function receiveSharesGate() external view returns (address);
    function receiveAssetsGate() external view returns (address);
}

interface IHyperithmUsdc {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

contract HyperithmForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_hyperithm_deposit() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("ETHEREUM_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address target = Addresses.Hyperithm.HYPERITHM_USDC_APEX_VAULT_V2;
        address usdc = Addresses.Tokens.USDC_ETHEREUM;
        _requireCode(target);
        _requireCode(usdc);
        IHyperithmVault vault = IHyperithmVault(target);
        // Implementation-only asset and preview calls validate proxy routing as well as ABI.
        assertEq(vault.asset(), usdc, "USDC asset");
        address user = address(uint160(uint256(keccak256("w1b hyperithm depositor"))));
        uint256 amount = 100e6;
        assertEq(vault.receiveSharesGate(), address(0), "receive shares gate");
        assertEq(vault.receiveAssetsGate(), address(0), "receive assets gate");
        uint256 preview = vault.previewDeposit(amount);
        require(preview > 0, "zero preview");
        // Documented USDC balance slot 9 (W0 Aave fixture).
        vm.store(usdc, keccak256(abi.encode(user, uint256(9))), bytes32(amount));
        uint256 supply = vault.totalSupply();
        uint256 feesBefore = _feeShares(vault);
        uint256 beforeShares = vault.balanceOf(user);
        vm.startPrank(user);
        IHyperithmUsdc(usdc).approve(target, amount);
        uint256 minted = vault.deposit(amount, user);
        vm.stopPrank();
        assertEq(vault.balanceOf(user) - beforeShares, minted, "user shares");
        uint256 feesMinted = _feeShares(vault) - feesBefore;
        assertEq(vault.totalSupply() - supply, minted + feesMinted, "supply incl accrued fees");
        emit log_named_uint("accrued fee shares minted", feesMinted);
        require(minted > 0 && minted <= preview && preview - minted <= preview / 1e6 + 1, "preview rounding");
        assertEq(IHyperithmUsdc(usdc).balanceOf(user), 0, "USDC spent");
        uint256 valued = vault.convertToAssets(minted);
        require(valued >= amount * 99 / 100 && valued <= amount * 101 / 100, "share asset value");
        emit log_named_uint("shares minted", minted);
        emit log_named_uint("USDC share value", valued);
    }

    function _feeShares(IHyperithmVault vault) private view returns (uint256) {
        address performance = vault.performanceFeeRecipient();
        address management = vault.managementFeeRecipient();
        uint256 shares = vault.balanceOf(performance);
        if (management != performance) shares += vault.balanceOf(management);
        return shares;
    }
}
