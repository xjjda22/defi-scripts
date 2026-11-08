// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IAxelarGasService {
    function payNativeGasForContractCall(
        address sender,
        string calldata chain,
        string calldata address_,
        bytes calldata payload,
        address refund
    ) external payable;
    function implementation() external view returns (address);
}

interface IAxelarGateway {
    function callContract(string calldata chain, string calldata address_, bytes calldata payload) external;
}

contract AxelarNetworkForkTest is ProtocolTestBase {
    function test_fork_axelar_send_message() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address gateway = Addresses.Axelar.AXELARGATEWAY_ETHEREUM;
        address gasService = Addresses.Axelar.AXELARGASSERVICE_ETHEREUM;
        address destination = Addresses.Axelar.INTERCHAIN_TOKEN_SERVICE_POLYGON_MESSAGE_DESTINATION;
        _requireCode(gateway);
        _requireCode(gasService);
        _requireCode(IAxelarGasService(gasService).implementation());
        address user = address(0xA11CE);
        uint256 fee = 0.01 ether;
        vm.deal(user, fee);
        bytes memory payload = abi.encodePacked("axelar fork test");
        uint256 before = gasService.balance;
        vm.startPrank(user);
        IAxelarGasService(gasService).payNativeGasForContractCall{value: fee}(
            user, "Polygon", "0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C", payload, user
        );
        IAxelarGateway(gateway).callContract("Polygon", "0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C", payload);
        vm.stopPrank();
        assertEq(gasService.balance - before, fee, "native gas paid");
    }
}
