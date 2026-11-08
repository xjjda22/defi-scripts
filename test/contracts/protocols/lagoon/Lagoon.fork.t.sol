// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

struct LagoonInit {
    address underlying;
    string name;
    string symbol;
    address safe;
    address whitelistManager;
    address valuationManager;
    address admin;
    address feeReceiver;
    uint16 managementRate;
    uint16 performanceRate;
    bool enableWhitelist;
    uint256 rateUpdateCooldown;
}

interface ILagoonFactory {
    function createVaultProxy(
        address logic,
        address initialOwner,
        uint256 initialDelay,
        LagoonInit calldata init,
        bytes32 salt
    ) external returns (address);
    function isInstance(address) external view returns (bool);
}

interface ILagoonVault {
    function asset() external view returns (address);
    function requestDeposit(uint256 assets, address controller, address owner) external payable;
    function pendingDepositRequest(uint256 requestId, address controller) external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
}

contract LagoonForkTest is ProtocolTestBase {
    function test_fork_lagoon_create_vault_and_request_deposit() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address factory = Addresses.Lagoon.VAULT_FACTORY;
        address logic = Addresses.Lagoon.VAULT_LOGIC_V0_5_0;
        address usdc = Addresses.Tokens.USDC_ETHEREUM;
        _requireCode(factory);
        _requireCode(logic);
        _requireCode(usdc);
        address curator = address(this);
        LagoonInit memory init = LagoonInit(
            usdc, "Foundry USDC Vault", "fdUSDC", curator, curator, curator, curator, curator, 0, 0, false, 0
        );
        bytes32 salt = keccak256("foundry lagoon vault");
        address vault = ILagoonFactory(factory).createVaultProxy(logic, curator, 86400, init, salt);
        assertTrue(ILagoonFactory(factory).isInstance(vault), "factory instance");
        assertEq(ILagoonVault(vault).asset(), usdc, "USDC wiring");
        address user = address(0xB0B);
        uint256 amount = 100e6;
        bytes32 slot = keccak256(abi.encode(user, uint256(9)));
        vm.store(usdc, slot, bytes32(amount));
        vm.startPrank(user);
        IERC20(usdc).approve(vault, amount);
        ILagoonVault(vault).requestDeposit(amount, user, user);
        vm.stopPrank();
        assertEq(IERC20(usdc).balanceOf(user), 0, "USDC spent");
        assertEq(ILagoonVault(vault).pendingDepositRequest(0, user), amount, "pending deposit");
        assertEq(ILagoonVault(vault).balanceOf(user), 0, "no shares before settlement");
    }
}
