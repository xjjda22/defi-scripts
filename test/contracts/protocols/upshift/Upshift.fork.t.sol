// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IUpshift {
    function depositsPaused() external view returns (bool);
    function maxDepositAmount() external view returns (uint256);
    function previewDeposit(address asset, uint256 amount) external view returns (uint256);
    function deposit(address asset, uint256 amount, address receiver) external;
}

interface IUpshiftToken {
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

contract UpshiftForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_upshift_deposit() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("ETHEREUM_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address vault = Addresses.Upshift.SENTORA_USD_VAULT;
        address receipt = Addresses.Upshift.SENTUSD;
        address usdc = Addresses.Upshift.USDC;
        _requireCode(vault);
        _requireCode(receipt);
        _requireCode(usdc);
        require(!IUpshift(vault).depositsPaused(), "deposits paused");
        uint256 amount = 100e6;
        require(IUpshift(vault).maxDepositAmount() >= amount, "deposit cap");
        uint256 expected = IUpshift(vault).previewDeposit(usdc, amount);
        require(expected > 0, "zero preview");
        address user = address(uint160(uint256(keccak256("w1b upshift depositor"))));
        // Documented USDC slot 9 (W0 Aave fixture).
        vm.store(usdc, keccak256(abi.encode(user, uint256(9))), bytes32(amount));
        uint256 supply = IUpshiftToken(receipt).totalSupply();
        uint256 beforeShares = IUpshiftToken(receipt).balanceOf(user);
        vm.startPrank(user);
        IUpshiftToken(usdc).approve(vault, amount);
        IUpshift(vault).deposit(usdc, amount, user);
        vm.stopPrank();
        uint256 minted = IUpshiftToken(receipt).balanceOf(user) - beforeShares;
        assertEq(minted, expected, "receipt matches preview");
        assertEq(IUpshiftToken(receipt).totalSupply() - supply, minted, "supply delta");
        assertEq(IUpshiftToken(usdc).balanceOf(user), 0, "USDC spent");
        emit log_named_uint("sentUSD shares minted", minted);
        emit log_named_uint("USDC spent", amount);
    }
}
