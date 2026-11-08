// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {ICcipRouter, ICcipRegistry, ILink} from "./interfaces/ICcip.sol";

/// Actual CCIP source-chain LINK lock and message enqueue. DON delivery is not tested.
contract CcipForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_ccip_send() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        ICcipRouter router = ICcipRouter(Addresses.Ccip.ROUTER);
        ILink link = ILink(Addresses.Tokens.LINK_ETHEREUM);
        address registry = Addresses.Ccip.TOKENADMINREGISTRY;
        address pool = Addresses.Ccip.LINK_LOCKRELEASETOKENPOOL;
        _requireCode(address(router));
        _requireCode(address(link));
        _requireCode(registry);
        _requireCode(pool);
        assertEq(ICcipRegistry(registry).getPool(address(link)), pool, "LINK pool implementation wiring");
        uint64 baseSelector = 15971525489660198786;
        address onRamp = router.getOnRamp(baseSelector);
        _requireCode(onRamp);
        assertEq(onRamp, Addresses.Ccip.ONRAMP_ETHEREUM_LANES_INCL_BASE, "Base lane wiring");
        address user = address(uint160(uint256(keccak256("ccip user"))));
        {
            // runtime.js EXTRA_WHALES.ethereum.LINK; runner supplies the existing holder.
            address whale = vm.envOr("FORK_LINK_WHALE", address(0));
            require(whale != address(0) && link.balanceOf(whale) >= 1 ether, "LINK whale");
            vm.prank(whale);
            require(link.transfer(user, 1 ether), "LINK funding transfer");
        }
        ICcipRouter.TokenAmount[] memory amounts = new ICcipRouter.TokenAmount[](1);
        amounts[0] = ICcipRouter.TokenAmount(address(link), 1 ether);
        // EVMExtraArgsV1: token-only transfer to an EOA, zero receiver gas.
        ICcipRouter.Message memory message = ICcipRouter.Message(
            abi.encode(user), "", amounts, address(0), abi.encodePacked(bytes4(0x97a657c9), abi.encode(uint256(0)))
        );
        uint256 fee = router.getFee(baseSelector, message);
        require(fee > 0, "quoted fee");
        vm.deal(user, fee);
        uint256 poolBefore = link.balanceOf(pool);
        vm.startPrank(user);
        require(link.approve(address(router), 1 ether), "LINK approve");
        bytes32 id = router.ccipSend{value: fee}(baseSelector, message);
        vm.stopPrank();
        require(id != bytes32(0), "CCIP message id");
        assertEq(link.balanceOf(user), 0, "LINK spent");
        assertEq(link.balanceOf(pool) - poolBefore, 1 ether, "LINK locked delta");
        assertEq(user.balance, 0, "exact fee spent");
        emit log_named_uint("LINK locked", link.balanceOf(pool) - poolBefore);
        emit log_named_uint("ETH fee paid", fee);
    }
}
