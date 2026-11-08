// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IConditionalTokens {
    function getOutcomeSlotCount(bytes32 conditionId) external view returns (uint256);
    function payoutDenominator(bytes32 conditionId) external view returns (uint256);
    function getCollectionId(bytes32 parentCollectionId, bytes32 conditionId, uint256 indexSet)
        external
        view
        returns (bytes32);
    function getPositionId(address collateralToken, bytes32 collectionId) external view returns (uint256);
    function balanceOf(address owner, uint256 positionId) external view returns (uint256);
    function splitPosition(
        address collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata partition,
        uint256 amount
    ) external;
}

contract PolymarketForkTest is ProtocolTestBase {
    bytes32 private constant CONDITION_ID = 0x3755ab22543a2545516f41fcf1c7828a132ef009301a4c1fdccff79cb1057d4a;

    function test_fork_polymarket_split_position() public {
        if (!_fork("POLYGON_RPC_URL", 137)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address ctf = Addresses.Polymarket.CONDITIONALTOKENS_GNOSIS_CTF_POLYMARKET_DEPLOYMENT;
        address usdc = Addresses.Polymarket.USDC_USDC_E_THE_CTF_COLLATERAL;
        _requireCode(ctf);
        _requireCode(usdc);
        IConditionalTokens c = IConditionalTokens(ctf);
        uint256 slots = c.getOutcomeSlotCount(CONDITION_ID);
        uint256 denominator = c.payoutDenominator(CONDITION_ID);
        assertTrue(slots == 2, "binary condition");
        assertEq(denominator, 0, "condition unresolved");
        address user = address(0xA11CE);
        uint256 amount = 10e6;
        _dealUsdc(usdc, user, amount);
        uint256[] memory partition = new uint256[](2);
        partition[0] = 1;
        partition[1] = 2;
        bytes32 yesCollection = c.getCollectionId(bytes32(0), CONDITION_ID, 1);
        bytes32 noCollection = c.getCollectionId(bytes32(0), CONDITION_ID, 2);
        uint256 yesId = c.getPositionId(usdc, yesCollection);
        uint256 noId = c.getPositionId(usdc, noCollection);
        vm.startPrank(user);
        IERC20(usdc).approve(ctf, amount);
        c.splitPosition(usdc, bytes32(0), CONDITION_ID, partition, amount);
        vm.stopPrank();
        assertEq(c.balanceOf(user, yesId), amount, "YES position");
        assertEq(c.balanceOf(user, noId), amount, "NO position");
        assertEq(IERC20(usdc).balanceOf(user), 0, "USDC spent");
    }

    /// Polygon USDC.e is a proxy whose balance mapping differs from Ethereum USDC. This mirrors
    /// src/simulation/fork/runtime.js: probe the small standard mapping-slot range in the isolated
    /// fork, verify it through balanceOf, and keep only the slot that the token actually reads.
    function _dealUsdc(address token, address user, uint256 amount) private {
        for (uint256 slot = 0; slot < 32; slot++) {
            bytes32 soliditySlot = keccak256(abi.encode(user, slot));
            vm.store(token, soliditySlot, bytes32(amount));
            if (IERC20(token).balanceOf(user) == amount) return;
            bytes32 vyperSlot = keccak256(abi.encode(slot, user));
            vm.store(token, vyperSlot, bytes32(amount));
            if (IERC20(token).balanceOf(user) == amount) return;
        }
        revert("USDC balance slot not found");
    }
}
