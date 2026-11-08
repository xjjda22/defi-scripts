// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {
    IStakewiseVault,
    IStakewiseController,
    IStakewiseVaultsRegistry,
    IStakewiseVmLogs
} from "./interfaces/IStakewise.sol";

/// StakeWise V3 Genesis Vault: one payable call stakes ETH and mints osETH against it.
/// Pre-checks mirror the JS flow (no pending keeper state update, deposit inside
/// capacity). The exact `Deposited` payload is decoded from recorded logs because the
/// minted share count can differ from the pre-tx `convertToShares` by one wei.
/// Exits go through the validator exit queue and are not exercised here.
contract StakewiseV3ForkTest is ProtocolTestBase {
    struct Before {
        uint256 totalAssets;
        uint256 shares;
        uint256 osEth;
    }

    event log_named_uint(string key, uint256 value);

    function test_fork_stakewise_v3_deposit_and_mint_oseth() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vaultAddress = Addresses.StakewiseV3.GENESIS_VAULT;
        address osToken = Addresses.StakewiseV3.OSETH_OSTOKEN;
        address controllerAddress = Addresses.StakewiseV3.OSTOKENVAULTCONTROLLER;
        address registry = Addresses.StakewiseV3.VAULTSREGISTRY;
        _requireCode(vaultAddress);
        _requireCode(osToken);
        _requireCode(controllerAddress);
        _requireCode(registry);
        // Deployment wiring: the configured registry knows this vault, and the configured
        // controller is the one that prices the osToken shares this call mints.
        assertTrue(IStakewiseVaultsRegistry(registry).vaults(vaultAddress), "vault not registered");

        IStakewiseVault vault = IStakewiseVault(vaultAddress);
        require(!vault.isStateUpdateRequired(), "Genesis Vault needs a keeper state update");
        uint256 value = 0.1 ether;
        uint256 assetsBefore = vault.totalAssets();
        require(assetsBefore + value <= vault.capacity(), "deposit would exceed capacity");

        address user = address(uint160(uint256(keccak256("stakewise v3 depositor"))));
        vm.deal(user, value);
        // Mint osETH worth half the deposit, well inside the vault's LTV (as the JS flow does).
        uint256 osShares = IStakewiseController(controllerAddress).convertToShares(value / 2);
        require(osShares > 0, "osToken shares");
        uint256 expectedShares = vault.convertToShares(value);
        Before memory beforeState = Before(assetsBefore, vault.getShares(user), IERC20(osToken).balanceOf(user));

        IStakewiseVmLogs(address(vm)).recordLogs();
        vm.prank(user);
        // The return value is the osToken ASSET amount minted for the half deposit, not the
        // vault share count; the vault's own share delta and event are asserted below.
        uint256 mintedOsTokenAssets = vault.depositAndMintOsToken{value: value}(user, osShares, address(0));

        uint256 shares = vault.getShares(user) - beforeState.shares;
        require(mintedOsTokenAssets > 0 && mintedOsTokenAssets <= value / 2, "osToken assets minted");
        assertEq(vault.totalAssets() - beforeState.totalAssets, value, "vault totalAssets rises by the deposit");
        uint256 drift = shares > expectedShares ? shares - expectedShares : expectedShares - shares;
        assertTrue(drift <= 1, "shares within one wei of convertToShares");
        assertEq(IERC20(osToken).balanceOf(user) - beforeState.osEth, osShares, "osETH minted equals request");
        assertEq(uint256(vault.osTokenPositions(user)), osShares, "osToken position equals request");
        assertEq(user.balance, 0, "depositor ETH spent");

        _assertDeposited(address(vm), vaultAddress, user, value, shares);
        emit log_named_uint("ETH deposited", value);
        emit log_named_uint("vault shares minted", shares);
        emit log_named_uint("osETH shares minted", osShares);
        emit log_named_uint("vault totalAssets delta", vault.totalAssets() - beforeState.totalAssets);
    }

    /// Decodes the vault's `Deposited(caller, receiver, assets, shares, referrer)` and
    /// binds every field to the executed call, including the exact share count.
    function _assertDeposited(
        address vmAddress,
        address vaultAddress,
        address receiver,
        uint256 value,
        uint256 shares
    ) private {
        IStakewiseVmLogs.Log[] memory logs = IStakewiseVmLogs(vmAddress).getRecordedLogs();
        bytes32 signature = keccak256("Deposited(address,address,uint256,uint256,address)");
        bool found;
        for (uint256 i = 0; i < logs.length; i++) {
            IStakewiseVmLogs.Log memory entry = logs[i];
            if (entry.emitter != vaultAddress || entry.topics.length != 3 || entry.topics[0] != signature) continue;
            require(!found, "duplicate Deposited event");
            assertEq(address(uint160(uint256(entry.topics[1]))), receiver, "Deposited caller");
            assertEq(address(uint160(uint256(entry.topics[2]))), receiver, "Deposited receiver");
            (uint256 assets, uint256 eventShares, address referrer) = abi.decode(entry.data, (uint256, uint256, address));
            assertEq(assets, value, "Deposited assets");
            assertEq(eventShares, shares, "Deposited shares");
            assertEq(referrer, address(0), "Deposited referrer");
            found = true;
        }
        require(found, "Deposited event missing");
    }
}
