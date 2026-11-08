// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {ISentora} from "./interfaces/ISentora.sol";

/// Genuine permissionless Morpho V2 interest settlement on Sentora's deployed
/// RLUSD vault. This is NOT a deposit, generic ERC-20 transfer, or getter-only
/// exception: cached assets and fee-share supply must change economically.
/// Official semantics: https://docs.morpho.org/developers/contracts/morpho-vaults-v2/#accrueinterest
/// maxDeposit() always returns 0 in V2; it does not imply deposits are closed.
contract SentoraForkTest is ProtocolTestBase {
    struct Before {
        uint256 assets;
        uint256 supply;
        uint256 performanceShares;
        uint256 managementShares;
        uint256 timestamp;
    }
    event log_named_uint(string key, uint256 value);

    function test_fork_sentora_curator_accrue_interest() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address target = Addresses.SentoraCurator.SENTORA_RLUSD_MAIN;
        _requireCode(target);
        _requireCode(Addresses.SentoraCurator.RLUSD);
        ISentora vault = ISentora(target);
        assertEq(vault.asset(), Addresses.SentoraCurator.RLUSD, "RLUSD implementation wiring");
        assertEq(vault.receiveSharesGate(), address(0), "receive shares gate");
        assertEq(vault.sendSharesGate(), address(0), "send shares gate");
        assertEq(vault.receiveAssetsGate(), address(0), "receive assets gate");
        assertEq(vault.sendAssetsGate(), address(0), "send assets gate");
        address performanceRecipient = vault.performanceFeeRecipient();
        address managementRecipient = vault.managementFeeRecipient();
        Before memory beforeState = Before(
            vault._totalAssets(),
            vault.totalSupply(),
            vault.balanceOf(performanceRecipient),
            vault.balanceOf(managementRecipient),
            vault.lastUpdate()
        );
        (uint256 expectedAssets, uint256 performanceFeeShares, uint256 managementFeeShares) = vault.accrueInterestView();
        require(expectedAssets > beforeState.assets, "no economic interest to settle");
        require(performanceFeeShares + managementFeeShares > 0, "no fee shares to settle");
        require(beforeState.timestamp < block.timestamp, "accrual already current");
        address caller = address(uint160(uint256(keccak256("sentora unprivileged interest caller"))));
        require(caller != performanceRecipient && caller != managementRecipient, "distinct caller");
        vm.prank(caller);
        vault.accrueInterest();
        assertEq(vault._totalAssets(), expectedAssets, "cached assets settle to exact preview");
        assertEq(
            vault.totalSupply() - beforeState.supply, performanceFeeShares + managementFeeShares, "fee supply delta"
        );
        uint256 performanceDelta = vault.balanceOf(performanceRecipient) - beforeState.performanceShares;
        if (performanceRecipient == managementRecipient) {
            assertEq(performanceDelta, performanceFeeShares + managementFeeShares, "combined fee recipient delta");
        } else {
            assertEq(performanceDelta, performanceFeeShares, "performance fee delta");
            assertEq(
                vault.balanceOf(managementRecipient) - beforeState.managementShares,
                managementFeeShares,
                "management fee delta"
            );
        }
        assertEq(uint256(vault.lastUpdate()), block.timestamp, "interest timestamp settled");
        assertEq(vault.balanceOf(caller), 0, "caller receives no fabricated shares");
        emit log_named_uint("cached RLUSD assets before", beforeState.assets);
        emit log_named_uint("cached RLUSD assets after", vault._totalAssets());
        emit log_named_uint("interest settled (RLUSD wei)", vault._totalAssets() - beforeState.assets);
        emit log_named_uint("fee shares minted", vault.totalSupply() - beforeState.supply);
    }
}
