// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IZamaWrapper {
    function underlying() external view returns (address);
    function rate() external view returns (uint256);
    function inferredTotalSupply() external view returns (uint256);
    function confidentialBalanceOf(address) external view returns (bytes32);
    function wrap(address to, uint256 amount) external;
}

contract ZamaForkTest is ProtocolTestBase {
    function test_fork_zama_wrap_usdc() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address wrapper = Addresses.Zama.CONFIDENTIAL_USDC_CUSDC;
        address usdc = Addresses.Tokens.USDC_ETHEREUM;
        _requireCode(wrapper);
        _requireCode(usdc);
        IZamaWrapper w = IZamaWrapper(wrapper);
        assertEq(w.underlying(), usdc, "underlying wiring");
        address user = address(0xA11CE);
        uint256 amount = 100e6;
        bytes32 slot = keccak256(abi.encode(user, uint256(9)));
        vm.store(usdc, slot, bytes32(amount));
        uint256 supplyBefore = w.inferredTotalSupply();
        uint256 lockedBefore = IERC20(usdc).balanceOf(wrapper);
        vm.startPrank(user);
        IERC20(usdc).approve(wrapper, amount);
        w.wrap(user, amount);
        vm.stopPrank();
        assertEq(IERC20(usdc).balanceOf(user), 0, "USDC spent");
        assertEq(IERC20(usdc).balanceOf(wrapper) - lockedBefore, amount, "USDC locked");
        assertEq(w.inferredTotalSupply() - supplyBefore, amount / w.rate(), "inferred supply delta");
        assertTrue(w.confidentialBalanceOf(user) != bytes32(0), "confidential handle minted");
    }
}
