// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

struct DolomiteAccount {
    address owner;
    uint256 number;
}

struct DolomiteValue {
    bool sign;
    uint256 value;
}

interface IDolomiteMargin {
    function getMarketIdByTokenAddress(address) external view returns (uint256);
    function getAccountWei(DolomiteAccount calldata, uint256) external view returns (DolomiteValue memory);
}

interface IDolomiteRouter {
    function depositWei(
        uint256 isolationModeMarketId,
        uint256 toAccountNumber,
        uint256 marketId,
        uint256 amountWei,
        uint8 eventFlag
    ) external;
    function withdrawWei(
        uint256 isolationModeMarketId,
        uint256 fromAccountNumber,
        uint256 marketId,
        uint256 amountWei,
        uint8 balanceCheckFlag
    ) external;
}

contract DolomiteForkTest is ProtocolTestBase {
    function test_fork_dolomite_supply_usdc() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address margin = Addresses.Dolomite.DOLOMITEMARGIN;
        address router = Addresses.Dolomite.DEPOSITWITHDRAWALROUTER;
        address usdc = Addresses.Dolomite.USDC;
        _requireCode(margin);
        _requireCode(router);
        _requireCode(usdc);
        uint256 marketId = IDolomiteMargin(margin).getMarketIdByTokenAddress(usdc);
        address user = address(0xA11CE);
        uint256 amount = 100e6;
        bytes32 slot = keccak256(abi.encode(user, uint256(9)));
        vm.store(usdc, slot, bytes32(amount));
        DolomiteAccount memory account = DolomiteAccount(user, 0);
        uint256 before = _positive(IDolomiteMargin(margin).getAccountWei(account, marketId).value);
        vm.startPrank(user);
        IERC20(usdc).approve(router, amount);
        IDolomiteRouter(router).depositWei(0, 0, marketId, amount, 0);
        vm.stopPrank();
        uint256 credited = _positive(IDolomiteMargin(margin).getAccountWei(account, marketId).value);
        assertTrue(credited > before, "Dolomite account credited");
        assertEq(IERC20(usdc).balanceOf(user), 0, "USDC spent");
    }

    function _positive(uint256 value) private pure returns (uint256) {
        return value;
    }
}
