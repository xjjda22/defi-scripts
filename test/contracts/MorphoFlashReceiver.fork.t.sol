// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MorphoFlashReceiver} from "../../src/simulation/fork/contracts/FlashReceivers.sol";
import {Vm, vm} from "./helpers/TestBase.sol";

interface IMorphoBlue {
    struct MarketParams {
        address loanToken;
        address collateralToken;
        address oracle;
        address irm;
        uint256 lltv;
    }

    function flashLoan(address token, uint256 assets, bytes calldata data) external;
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function idToMarketParams(bytes32 id) external view returns (MarketParams memory);
}

interface IERC20Like {
    function balanceOf(address) external view returns (uint256);
    function allowance(address, address) external view returns (uint256);
}

/// Runs the receiver against the **real** Morpho Blue singleton on a fork, not a mock.
///
///   FORK_BLOCK=<observed-block> FORK_RPC_URL=... forge test --match-contract MorphoFlashReceiverFork -vv
///
/// Addresses, all code-checked before use:
/// - Morpho Blue `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`: the "Morpho" row of the Morpho
///   docs addresses table (https://docs.morpho.org/developers/contracts/addresses/), the same
///   singleton address on every chain; contract API documented at
///   https://docs.morpho.org/developers/contracts/blue/ (which is where `idToMarketParams` and
///   the `keccak256(abi.encode(params))` market id rule come from). Used here on mainnet, id 1.
/// - USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, the mainnet FiatTokenV2 proxy, the
///   same token the Aave fork test uses.
///
/// Code is not identity — this repo shipped 11 fake Uniswap factories that way. So the test also
/// asks the contract two questions only Morpho Blue answers: `DOMAIN_SEPARATOR()` (non-zero
/// EIP-712 domain) and `idToMarketParams()` for the USDC/wstETH 0.86 market, whose returned
/// params must hash back to the id the test passed in (`id == keccak256(abi.encode(params))`).
///
/// Morpho Blue charges **no fee**, so the callback receives exactly `amount`, approves it, and
/// Morpho pulls that same `amount` back. The receiver therefore needs no starting balance and
/// there is nothing to fund here — unlike the Aave test, which pre-funds the 0.05% premium.
contract MorphoFlashReceiverForkTest {
    address internal constant DEFAULT_MORPHO = 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb;
    address internal constant DEFAULT_USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    /// USDC/wstETH 86% market id. It is not trusted: the test reads the params back and requires
    /// keccak256(abi.encode(params)) == this id, i.e. the contract's storage round-trips.
    bytes32 internal constant USDC_WSTETH_086 =
        0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc;
    address internal constant WSTETH = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
    uint256 internal constant LLTV_086 = 860_000_000_000_000_000;

    function test_fork_morpho_flashloan_roundtrip() public {
        string memory url = vm.envOr("FORK_RPC_URL", string(""));
        if (bytes(url).length == 0) {
            vm.skip(true);
            return;
        }
        uint256 blockNo = vm.envOr("FORK_BLOCK", uint256(0));
        require(blockNo > 0, "FORK_BLOCK required: receiver tests never fork latest");
        vm.createSelectFork(url, blockNo);

        address morpho = vm.envOr("MORPHO", DEFAULT_MORPHO);
        address usdc = vm.envOr("MORPHO_USDC", DEFAULT_USDC);
        uint256 amount = vm.envOr("MORPHO_LOAN", uint256(1_000e6));

        require(morpho.code.length > 0, "morpho: no code");
        require(usdc.code.length > 0, "token: no code");

        // Identity: an address with code is not evidence, these two calls are.
        bytes32 domain = IMorphoBlue(morpho).DOMAIN_SEPARATOR();
        require(domain != bytes32(0), "not morpho: zero domain separator");
        IMorphoBlue.MarketParams memory params = IMorphoBlue(morpho).idToMarketParams(USDC_WSTETH_086);
        require(params.loanToken == usdc, "market loan token");
        require(params.collateralToken == WSTETH, "market collateral");
        require(params.lltv == LLTV_086, "market lltv");
        require(keccak256(abi.encode(params)) == USDC_WSTETH_086, "market id != params");
        emit log_named_bytes32("domain_separator", domain);

        // The loan is drawn from Morpho's own token balance, so liquidity is the check: the
        // flashLoan reverts if Morpho cannot cover the amount.
        uint256 morphoBefore = IERC20Like(usdc).balanceOf(morpho);
        require(morphoBefore >= amount, "morpho usdc liquidity");

        // A fresh receiver holds nothing; the loan itself is the only funding it ever gets.
        MorphoFlashReceiver receiver = new MorphoFlashReceiver(morpho);
        require(IERC20Like(usdc).balanceOf(address(receiver)) == 0, "receiver pre-funded");

        receiver.run(usdc, amount);

        require(receiver.token() == usdc, "token recorded");
        require(receiver.seenAmount() == amount, "callback amount");
        // The callback fires after Morpho has sent the assets and before it pulls them back.
        require(receiver.seenBalance() == amount, "callback balance");
        // Nothing is left behind: no fee, so the borrowed assets are exactly what is repaid.
        require(IERC20Like(usdc).balanceOf(address(receiver)) == 0, "receiver residue");
        require(IERC20Like(usdc).allowance(address(receiver), morpho) == 0, "allowance consumed");
        require(IERC20Like(usdc).balanceOf(morpho) == morphoBefore, "morpho balance");

        emit log_named_uint("loan", amount);
        emit log_named_uint("callback_balance", receiver.seenBalance());
        emit log_named_uint("morpho_before", morphoBefore);
        emit log_named_uint("morpho_after", IERC20Like(usdc).balanceOf(morpho));
    }

    event log_named_uint(string key, uint256 val);
    event log_named_bytes32(string key, bytes32 val);
}
