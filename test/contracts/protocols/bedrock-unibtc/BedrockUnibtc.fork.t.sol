// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IBedrockVault {
    function uniBTC() external view returns (address);
    function allowedTokenList(address) external view returns (bool);
    function paused(address) external view returns (bool);
    function mint(address token, uint256 amount) external;
}

contract BedrockUnibtcForkTest is ProtocolTestBase {
    function test_fork_bedrock_unibtc_mint_wbtc() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault =
            Addresses.BedrockUnibtc.BEDROCK_VAULT_TRANSPARENTUPGRADEABLEPROXY_THE_PERMISSIONLESS_WRAPPED_BTC_MINT;
        address unibtc =
            Addresses.BedrockUnibtc.UNIBTC_BEDROCK_UNIVERSAL_BTC_8_DECIMALS_THE_VAULT_IS_ITS_ONLY_MINTER_ROLE_HOLDER;
        address wbtc = Addresses.BedrockUnibtc.WBTC_WRAPPED_BTC_8_DECIMALS_THE_TOKEN_MINTED_AGAINST;
        _requireCode(vault);
        _requireCode(unibtc);
        _requireCode(wbtc);
        IBedrockVault v = IBedrockVault(vault);
        assertEq(v.uniBTC(), unibtc, "uniBTC wiring");
        assertTrue(v.allowedTokenList(wbtc), "WBTC allowed");
        assertTrue(!v.paused(wbtc), "WBTC not paused");
        address user = address(0xA11CE);
        uint256 amount = 0.01e8;
        address whale = vm.envOr("FORK_WBTC_WHALE", address(0));
        require(whale != address(0), "configured WBTC whale required");
        vm.prank(whale);
        IERC20(wbtc).transfer(user, amount);
        uint256 before = IERC20(unibtc).balanceOf(user);
        vm.startPrank(user);
        IERC20(wbtc).approve(vault, amount);
        v.mint(wbtc, amount);
        vm.stopPrank();
        assertEq(IERC20(unibtc).balanceOf(user) - before, amount, "uniBTC minted 1:1");
        assertEq(IERC20(wbtc).balanceOf(user), 0, "WBTC spent");
    }
}
