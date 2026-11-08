// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IDeriveActionManager {
    function depositToNewSubaccount(address asset, uint256 amount, uint32 managerId, address owner)
        external
        returns (uint256);
}

contract LyraForkTest is ProtocolTestBase {
    address private constant USDC_SPOT_ASSET = 0x57B03E14d409ADC7fAb6CFc44b5886CAD2D5f02b;

    function test_fork_lyra_deposit_usdc_subaccount() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address manager = Addresses.DeriveV3.DERIVE_V3_ACTION_MANAGER_ONCHAINACTIONMANAGER_PROXY_DEPOSITTONEWSUBACCOUNT;
        address vault = Addresses.DeriveV3.DERIVE_V3_SPOT_VAULT_COLLATERAL_CUSTODY_RECEIVES_THE_DEPOSIT;
        address usdc = Addresses.DeriveV3.USDC_ETHEREUM_ERC_20_PULLED_BY_THE_DEPOSIT;
        _requireCode(manager);
        _requireCode(vault);
        _requireCode(usdc);
        address user = address(0xA11CE);
        uint256 amount = 100e6;
        bytes32 slot = keccak256(abi.encode(user, uint256(9)));
        vm.store(usdc, slot, bytes32(amount));
        uint256 vaultBefore = IERC20(usdc).balanceOf(vault);
        vm.startPrank(user);
        IERC20(usdc).approve(manager, amount);
        IDeriveActionManager(manager).depositToNewSubaccount(USDC_SPOT_ASSET, amount, 1, user);
        vm.stopPrank();
        assertEq(IERC20(usdc).balanceOf(vault) - vaultBefore, amount, "USDC custody delta");
        assertEq(IERC20(usdc).balanceOf(user), 0, "USDC spent");
    }
}
