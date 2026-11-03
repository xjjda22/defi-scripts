// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AaveFlashReceiver} from "../../src/simulation/fork/contracts/FlashReceivers.sol";
import {Vm, vm} from "./helpers/TestBase.sol";

interface IAaveV3Pool {
    function flashLoanSimple(address receiver, address asset, uint256 amount, bytes calldata params, uint16 code)
        external;
}

interface IERC20Like {
    function balanceOf(address) external view returns (uint256);
    function allowance(address, address) external view returns (uint256);
}

/// Runs the receiver against a **real** Aave V3 pool on a fork, not a mock.
///
///   FORK_RPC_URL=... forge test --match-contract AaveFlashReceiverFork -vv
///
/// Defaults are mainnet; the JS runner (`scripts/forkAaveCheck.js`) sets `AAVE_POOL` and
/// `AAVE_USDC` per chain and verifies those addresses first. The receiver produces no profit,
/// so the test funds it with the premium — that is what a real integrator does, and it keeps
/// the assertion about the protocol rather than about our own arithmetic.
contract AaveFlashReceiverForkTest {
    address internal constant DEFAULT_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
    address internal constant DEFAULT_USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    function test_fork_aave_flashloan_roundtrip() public {
        string memory url = vm.envOr("FORK_RPC_URL", string(""));
        if (bytes(url).length == 0) {
            vm.skip(true);
            return;
        }
        uint256 blockNo = vm.envOr("FORK_BLOCK", uint256(0));
        if (blockNo == 0) vm.createSelectFork(url);
        else vm.createSelectFork(url, blockNo);

        address pool = vm.envOr("AAVE_POOL", DEFAULT_POOL);
        address usdc = vm.envOr("AAVE_USDC", DEFAULT_USDC);
        uint256 amount = vm.envOr("AAVE_LOAN", uint256(1_000e6));

        // Liquidity lives in the aToken, not the pool, so the loan itself is the check:
        // flashLoanSimple reverts if the reserve cannot cover the amount.
        AaveFlashReceiver receiver = new AaveFlashReceiver(pool);
        uint256 premium = (amount * 5 + 5_000) / 10_000; // Aave V3 `percentMul`: 0.05%, half-up
        _fundUsdc(usdc, address(receiver), premium);

        IAaveV3Pool(pool).flashLoanSimple(address(receiver), usdc, amount, "", 0);
        emit log_named_uint("loan", amount);

        require(receiver.seenAmount() == amount, "callback amount");
        require(receiver.seenPremium() == premium, "callback premium");
        // Nothing is left behind: the receiver spent the loan and its own premium funding.
        require(IERC20Like(usdc).balanceOf(address(receiver)) == 0, "receiver residue");
        require(IERC20Like(usdc).allowance(address(receiver), pool) == 0, "allowance consumed");
    }

    /// USDC (FiatTokenV2) keeps `balances` in slot 9. There is no ERC-20 `deal` cheatcode —
    /// forge-std implements it with storage writes, and this is the same write by hand.
    function _fundUsdc(address token, address to, uint256 amount) internal {
        bytes32 slot = keccak256(abi.encode(to, uint256(9)));
        vm.store(token, slot, bytes32(amount));
    }

    event log_named_uint(string key, uint256 val);
}
