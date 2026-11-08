// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface ICianVault {
    function asset() external view returns (address);
    function paused() external view returns (bool);
    function remainingUpdateTime() external view returns (uint256);
    function balanceOf(address user) external view returns (uint256);
    function requestRedeem(uint256 shares, address token) external;
}

/// CIAN's holder exit remains permissionless while the operator price window is
/// stale: existing shares can be queued to the RedeemOperator. Deposit is not claimed.
contract CianYieldLayerForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_cian_request_redeem() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses.CianYieldLayer.RSETH_YIELD_LAYER_VAULT_YLRSETH;
        address rseth = Addresses.CianYieldLayer.RSETH_ASSET_OF_THE_RSETH_YIELD_LAYER;
        address operator = Addresses.CianYieldLayer.RSETH_YIELD_LAYER_REDEEMOPERATOR;
        _requireCode(vault);
        _requireCode(rseth);
        _requireCode(operator);
        ICianVault cian = ICianVault(vault);
        assertEq(cian.asset(), rseth, "rsETH asset wiring");
        assertTrue(!cian.paused(), "vault not paused");

        address user = address(uint160(uint256(keccak256("cian redeemer"))));
        uint256 shares = 1e18;
        address whale = vm.envOr("FORK_CIAN_SHARE_WHALE", address(0));
        require(whale != address(0) && cian.balanceOf(whale) >= shares, "ylrsETH share whale");
        vm.prank(whale);
        IERC20(vault).transfer(user, shares);
        assertEq(cian.balanceOf(user), shares, "seeded shares");
        uint256 operatorBefore = cian.balanceOf(operator);
        vm.prank(user);
        cian.requestRedeem(shares, rseth);

        assertEq(cian.balanceOf(user), 0, "shares queued");
        assertEq(cian.balanceOf(operator) - operatorBefore, shares, "RedeemOperator shares");
        emit log_named_uint("shares queued", shares);
        emit log_named_uint("operator shares after", cian.balanceOf(operator));
        emit log_named_uint("price window", cian.remainingUpdateTime());
    }
}
