// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

struct DelegationRequest {
    address delegate;
    int256 amount;
}

interface ICooler {
    function collateralToken() external view returns (address);
    function debtToken() external view returns (address);
    function accountCollateral(address) external view returns (uint128);
    function addCollateral(uint128 amount, address onBehalfOf, DelegationRequest[] calldata requests) external;
}

contract CoolerLoansForkTest is ProtocolTestBase {
    function test_fork_cooler_loans_add_gohm_collateral() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address cooler = Addresses.CoolerLoans.COOLER_V2_MONOCOOLER;
        address gohm = Addresses.CoolerLoans.GOHM;
        _requireCode(cooler);
        _requireCode(gohm);
        assertEq(ICooler(cooler).collateralToken(), gohm, "gOHM wiring");
        address user = address(0xA11CE);
        uint256 amount = 1 ether;
        address whale = vm.envOr("FORK_GOHM_WHALE", address(0));
        require(whale != address(0), "configured gOHM whale required");
        vm.prank(whale);
        IERC20(gohm).transfer(user, amount);
        vm.startPrank(user);
        IERC20(gohm).approve(cooler, amount);
        ICooler(cooler).addCollateral(uint128(amount), user, new DelegationRequest[](0));
        vm.stopPrank();
        assertEq(uint256(ICooler(cooler).accountCollateral(user)), amount, "collateral posted");
        assertEq(IERC20(gohm).balanceOf(user), 0, "gOHM spent");
    }
}
