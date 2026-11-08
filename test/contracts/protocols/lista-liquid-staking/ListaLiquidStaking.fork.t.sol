// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IListaStakeManager, ISlisBNB, IVmLogs} from "./interfaces/IListaLiquidStaking.sol";

/// BNB -> slisBNB mint. The 7-day unbond queue and any withdrawal are not exercised.
contract ListaLiquidStakingForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_lista_liquid_staking_deposit() public {
        if (!_fork("BSC_RPC_URL", 56)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address manager = Addresses.ListaLiquidStaking.LISTASTAKEMANAGER;
        address slisBnb = Addresses.ListaLiquidStaking.SLISBNB;
        _requireCode(manager);
        _requireCode(slisBnb);
        assertTrue(!IListaStakeManager(manager).paused(), "manager paused");
        assertEq(uint256(ISlisBNB(slisBnb).decimals()), 18, "slisBNB decimals");

        address user = address(uint160(uint256(keccak256("w2a lista staker"))));
        uint256 amount = 0.1 ether;
        vm.deal(user, 1 ether);
        uint256 beforeShares = ISlisBNB(slisBnb).balanceOf(user);
        uint256 beforeSupply = ISlisBNB(slisBnb).totalSupply();
        IVmLogs(address(vm)).recordLogs();
        vm.prank(user);
        IListaStakeManager(manager).deposit{value: amount}();

        uint256 minted = ISlisBNB(slisBnb).balanceOf(user) - beforeShares;
        assertTrue(minted > 0, "slisBNB minted");
        assertEq(ISlisBNB(slisBnb).totalSupply() - beforeSupply, minted, "supply delta equals mint");
        assertEq(user.balance, 0.9 ether, "user BNB spent");

        // Bind the mint Transfer to the measured balance delta: the mint is the only share
        // movement and its amount is exactly `minted`.
        bytes32 topic = keccak256("Transfer(address,address,uint256)");
        IVmLogs.Log[] memory logs = IVmLogs(address(vm)).getRecordedLogs();
        uint256 matched;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter != slisBnb) continue;
            if (logs[i].topics.length != 3 || logs[i].topics[0] != topic) continue;
            if (logs[i].topics[1] != bytes32(0)) continue; // mint only
            if (logs[i].topics[2] != bytes32(uint256(uint160(user)))) continue;
            matched++;
            assertEq(abi.decode(logs[i].data, (uint256)), minted, "Transfer mint equals measured delta");
        }
        assertEq(matched, 1, "exactly one mint Transfer");
        emit log_named_uint("slisBNB minted", minted);
        emit log_named_uint("BNB deposited", amount);
    }
}
