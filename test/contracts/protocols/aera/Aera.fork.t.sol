// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IAeraToken {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
}

interface IAeraVault {
    function provisioner() external view returns (address);
    function feeCalculator() external view returns (address);
    function balanceOf(address) external view returns (uint256);
}

interface IAeraCalculator {
    function isVaultPaused(address) external view returns (bool);
    function convertTokenToUnits(address, address, uint256) external view returns (uint256);
}

interface IAeraProvisioner {
    struct Request {
        uint8 requestType;
        address user;
        address receiver;
        uint256 units;
        uint256 tokens;
        uint256 solverTip;
        uint256 deadline;
        uint256 maxPriceAge;
    }
    function tokensDetails(address) external view returns (bool, bool, bool, bool);
    function requestDeposit(address, uint256, uint256, uint256, uint256, uint256, bool) external returns (bytes32);
    function getRequestHash(address, Request calldata) external view returns (bytes32);
    function asyncRequestHashes(bytes32) external view returns (bool);
    function refundRequest(address, Request calldata) external;
}

contract AeraForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_aera_request_refund() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("BASE_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("BASE_RPC_URL", 8453)) return;
        address target = Addresses.Aera.GTUSDA_MULTIDEPOSITORVAULT;
        address provisioner = Addresses.Aera.PROVISIONERV2_GTUSDA_PROVISIONER;
        address calculator = Addresses.Aera.PRICEANDFEECALCULATOR_GTUSDA_FEECALCULATOR;
        address usdc = Addresses.Tokens.USDC_BASE;
        _requireCode(target);
        _requireCode(provisioner);
        _requireCode(calculator);
        _requireCode(usdc);
        assertEq(IAeraVault(target).provisioner(), provisioner, "provisioner wiring");
        assertEq(IAeraVault(target).feeCalculator(), calculator, "calculator wiring");
        require(!IAeraCalculator(calculator).isVaultPaused(target), "vault paused");
        (bool enabled,,,) = IAeraProvisioner(provisioner).tokensDetails(usdc);
        require(enabled, "async deposits disabled");
        address user = address(uint160(uint256(keccak256("w1b Aera depositor"))));
        _fund(usdc, user);
        uint256 units = IAeraCalculator(calculator).convertTokenToUnits(target, usdc, 100e6) * 97 / 100;
        require(units > 0, "zero minimum units");
        IAeraProvisioner.Request memory request = IAeraProvisioner.Request({
            requestType: 0,
            user: user,
            receiver: user,
            units: units,
            tokens: 100e6,
            solverTip: 0,
            deadline: block.timestamp + 3600,
            maxPriceAge: 3600
        });
        uint256 beforeBalance = IAeraToken(usdc).balanceOf(provisioner);
        vm.startPrank(user);
        IAeraToken(usdc).approve(provisioner, 100e6);
        bytes32 returnedHash =
            IAeraProvisioner(provisioner).requestDeposit(usdc, 100e6, units, 0, request.deadline, 3600, false);
        vm.stopPrank();
        bytes32 hash = IAeraProvisioner(provisioner).getRequestHash(usdc, request);
        require(returnedHash == hash && IAeraProvisioner(provisioner).asyncRequestHashes(hash), "request stored");
        assertEq(IAeraToken(usdc).balanceOf(user), 0, "USDC spent");
        assertEq(IAeraToken(usdc).balanceOf(provisioner) - beforeBalance, 100e6, "request escrow");
        vm.warp(request.deadline + 1);
        vm.prank(user);
        IAeraProvisioner(provisioner).refundRequest(usdc, request);
        require(!IAeraProvisioner(provisioner).asyncRequestHashes(hash), "hash cleared");
        assertEq(IAeraToken(usdc).balanceOf(user), 100e6, "USDC refund");
        assertEq(IAeraToken(usdc).balanceOf(provisioner), beforeBalance, "escrow restored");
        assertEq(IAeraVault(target).balanceOf(user), 0, "no solver credit asserted");
        emit log_named_uint("USDC escrowed then refunded", 100e6);
        emit log_named_uint("minimum units requested", units);
    }

    function _fund(address usdc, address user) private {
        // Existing EXTRA_WHALES.base.USDC from runtime.js (or WHALES.base.USDC).
        address whale = vm.envOr("FORK_USDC_WHALE", address(0));
        require(whale != address(0), "configured Base USDC whale required");
        require(IAeraToken(usdc).balanceOf(whale) >= 100e6, "USDC whale balance");
        vm.prank(whale);
        require(IAeraToken(usdc).transfer(user, 100e6), "whale transfer");
        assertEq(IAeraToken(usdc).balanceOf(user), 100e6, "funded USDC");
    }
}
