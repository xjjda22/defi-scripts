// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import * as Addresses from "../_shared/Addresses.sol";

interface IERC20MetadataLike {
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
}

/// Bedrock uniETH read-only invariants on a mainnet fork. The address is the
/// discovery result for the one top-200 row that was EVM-forkable with no
/// address in the book; it is now in `src/catalog/contracts.js` → BOOK and the
/// generated `Addresses.BedrockUnieth` library.
///
/// uniETH is a TransparentUpgradeableProxy. `getCode` alone would accept any
/// proxy with a fallback, so the test also checks the EIP-1967 implementation
/// slot against the documented implementation and requires that implementation
/// to have code. A mint/deposit fork test is a separate follow-up (W1): this
/// closes the address gap with a live, non-transferable read.
contract BedrockUniETHForkTest is ProtocolTestBase {
    function test_fork_bedrock_unieth_read() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;

        address unieth = Addresses.BedrockUnieth.UNIETH_PROXY;
        address expectedImpl = Addresses.BedrockUnieth.UNIETH_IMPLEMENTATION_EIP_1967;
        _requireCode(unieth);

        assertEq(IERC20MetadataLike(unieth).symbol(), "uniETH", "symbol");
        assertEq(IERC20MetadataLike(unieth).decimals(), 18, "decimals");
        assertTrue(IERC20MetadataLike(unieth).totalSupply() > 0, "totalSupply");

        bytes32 implSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        address impl = address(uint160(uint256(vm.load(unieth, implSlot))));
        assertEq(impl, expectedImpl, "eip1967 implementation");
        _requireCode(impl);

        bytes32 adminSlot = bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1);
        address admin = address(uint160(uint256(vm.load(unieth, adminSlot))));
        assertEq(admin, Addresses.BedrockUnieth.UNIETH_PROXY_ADMIN_EIP_1967, "eip1967 admin");
        _requireCode(admin);
    }
}
