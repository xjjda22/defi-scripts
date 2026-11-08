// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {ISparkPool, ISparkProvider, ISparkDataProvider} from "./interfaces/ISpark.sol";

/// Port of the SparkLend USDC supply primitive, not the multi-step borrow recipe.
contract SparkLendForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_sparklend_supply() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address pool = Addresses.Spark.SPARKLEND_POOL;
        address usdc = Addresses.Usdc.USDC;
        _requireCode(pool);
        _requireCode(usdc);
        // Implementation-only wiring getter: do not accept an empty proxy stub.
        address provider = ISparkPool(pool).ADDRESSES_PROVIDER();
        _requireCode(provider);
        address dataProvider = ISparkProvider(provider).getPoolDataProvider();
        _requireCode(dataProvider);
        (address aUsdc,,) = ISparkDataProvider(dataProvider).getReserveTokensAddresses(usdc);
        _requireCode(aUsdc);
        address user = address(uint160(uint256(keccak256("sparklend user"))));
        uint256 amount = 100e6;
        // USDC FiatTokenV2 balances mapping slot 9, as in AaveFlashReceiver.fork.t.sol.
        vm.store(usdc, keccak256(abi.encode(user, uint256(9))), bytes32(amount));
        uint256 beforeShares = IERC20(aUsdc).balanceOf(user);
        vm.startPrank(user);
        IERC20(usdc).approve(pool, amount);
        ISparkPool(pool).supply(usdc, amount, user, 0);
        vm.stopPrank();
        uint256 minted = IERC20(aUsdc).balanceOf(user) - beforeShares;
        assertEq(IERC20(usdc).balanceOf(user), 0, "USDC spent");
        assertTrue(minted + 2 >= amount && minted <= amount + 2, "aUSDC delta");
        emit log_named_uint("USDC supplied", amount);
        emit log_named_uint("aUSDC minted", minted);
    }
}
