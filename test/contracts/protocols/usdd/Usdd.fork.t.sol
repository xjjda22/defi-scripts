// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IERC20Supply {
    function totalSupply() external view returns (uint256);
}

interface ILegacyTransfer {
    function transfer(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external;
}

interface IUsddPsm {
    function ilk() external view returns (bytes32);
    function usdd() external view returns (address);
    function gemJoin() external view returns (address);
    function sellEnabled() external view returns (uint256);
    function sellGem(address usr, uint256 gemAmt) external;
}

contract UsddForkTest is ProtocolTestBase {
    function test_fork_usdd_mint_against_usdt() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address psm = Addresses.Usdd.USDD_PSM_MCD_PSM_USDT_A_USDDPSM_DSSPSM_FORK;
        address usdd = Addresses.Usdd.USDD_USDD_2_0_TOKEN_ETHEREUM;
        address join = Addresses.Usdd.USDT_JOIN_JOIN_PSM_USDT_A_AUTHGEMJOIN_THE_APPROVAL_TARGET;
        address usdt = Addresses.Usdd.USDT_TETHER_USD_THE_PSM_GEM_6_DECIMALS;
        _requireCode(psm);
        _requireCode(usdd);
        _requireCode(join);
        _requireCode(usdt);
        IUsddPsm p = IUsddPsm(psm);
        assertEq(p.usdd(), usdd, "USDD wiring");
        assertEq(p.gemJoin(), join, "Join wiring");
        assertEq(p.sellEnabled(), 1, "sell enabled");
        address user = address(0xA11CE);
        uint256 amount = 100e6;
        address whale = vm.envOr("FORK_USDT_WHALE", address(0));
        require(whale != address(0), "configured USDT whale required");
        vm.prank(whale);
        ILegacyTransfer(usdt).transfer(user, amount);
        uint256 supplyBefore = IERC20Supply(usdd).totalSupply();
        vm.startPrank(user);
        ILegacyTransfer(usdt).approve(join, amount);
        p.sellGem(user, amount);
        vm.stopPrank();
        assertEq(IERC20(usdd).balanceOf(user), amount * 1e12, "USDD minted");
        assertEq(IERC20Supply(usdd).totalSupply() - supplyBefore, amount * 1e12, "supply delta");
        assertEq(IERC20(usdt).balanceOf(user), 0, "USDT spent");
    }
}
