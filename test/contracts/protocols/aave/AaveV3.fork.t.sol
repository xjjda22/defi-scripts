// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import * as Addresses from "../_shared/Addresses.sol";
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IAaveV3Pool} from "./interfaces/IAaveV3Pool.sol";
import {IAaveProtocolDataProvider} from "./interfaces/IAaveProtocolDataProvider.sol";

/// Aave V3 supply against the real mainnet pool on a fork.
///
///   ETHEREUM_RPC_URL=... FORK_BLOCK=26363300 forge test \
///     --match-path 'test/contracts/protocols/aave/**' -vv
///
/// The delta is the aToken Aave mints for the supplier: USDC leaves the wallet
/// and the aToken balance appears. Aave V3 books USDC at LTV 0 on this block, so
/// `getUserAccountData` reports zero collateral even though the supply succeeds;
/// the aToken is the honest delta, not collateral. No mock, no receiver, no
/// PRIVATE_KEY.
contract AaveV3ForkTest is ProtocolTestBase {
    function test_fork_aave_supply() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;

        address pool = Addresses.Aave.V3_POOL;
        address usdc = Addresses.Usdc.USDC;
        _requireCode(pool);
        _requireCode(usdc);

        // A getter only a real Aave pool answers: the pool's immutable link back
        // to the PoolAddressesProvider deployed in front of it.
        require(IAaveV3Pool(pool).ADDRESSES_PROVIDER() != address(0), "not aave pool");

        // Resolve aUSDC from the pool's data provider rather than pinning it.
        address dataProvider = Addresses.Aave.V3_DATA_PROVIDER;
        _requireCode(dataProvider);
        (address aUsdc,,) = IAaveProtocolDataProvider(dataProvider).getReserveTokensAddresses(usdc);
        _requireCode(aUsdc);

        address user = address(0xA11CE);
        _dealUsdc(usdc, user, 1_000e6);

        vm.startPrank(user);
        IERC20(usdc).approve(pool, 1_000e6);
        IAaveV3Pool(pool).supply(usdc, 1_000e6, user, 0);
        vm.stopPrank();

        uint256 aTokenBalance = IERC20(aUsdc).balanceOf(user);
        assertEq(IERC20(usdc).balanceOf(user), 0, "usdc spent");
        // Aave share rounding costs at most 1 wei at this block (measured 999,999,999).
        assertTrue(aTokenBalance >= 1_000e6 - 2 && aTokenBalance <= 1_000e6, "aToken");
    }

    /// USDC (FiatTokenV2) keeps `balances` in slot 9. This is the same storage
    /// write `AaveFlashReceiver.fork.t.sol` uses, cited because the slot is part
    /// of that token's deployed layout rather than guessed.
    function _dealUsdc(address token, address to, uint256 amount) internal {
        bytes32 slot = keccak256(abi.encode(to, uint256(9)));
        vm.store(token, slot, bytes32(amount));
    }
}
