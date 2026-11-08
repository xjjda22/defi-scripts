// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IRestrictedToken, INestVault} from "./interfaces/IRestrictedToken.sol";

/// API-only-seven read-only exception: Nest deposits require fresh Predicate compliance attestations.
/// Check circulating supply, precision, identity and concrete (non-proxy) token runtime.
/// These are NOT mint/deposit or redemption tests.
contract PlumeVaultsForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_plume_vaults_supply_invariants() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        _checkToken(Addresses.PlumeVaults.NALPHA_SHARE_TOKEN, "nALPHA");
        _checkToken(Addresses.PlumeVaults.NBASIS_SHARE_TOKEN, "nBASIS");
        address vault = Addresses.PlumeVaults.NALPHA_USDC_NESTVAULT;
        _requireCode(vault);
        _requireCode(Addresses.Usdc.USDC);
        assertEq(INestVault(vault).asset(), Addresses.Usdc.USDC, "Nest USDC implementation wiring");
        uint256 assets = INestVault(vault).totalAssets();
        assertTrue(assets > 1e6, "live Nest assets");
        emit log_named_uint("nALPHA vault total assets (read-only)", assets);
    }

    function _assertConcreteToken(address token) internal view {
        bytes memory runtime = token.code;
        require(runtime.length > 2, "token runtime");
        uint256 metadataLength =
            uint256(uint8(runtime[runtime.length - 2])) * 256 + uint256(uint8(runtime[runtime.length - 1]));
        require(metadataLength + 2 < runtime.length, "Solidity metadata bounds");
        uint256 executableLength = runtime.length - metadataLength - 2;
        for (uint256 pc; pc < executableLength;) {
            uint8 opcode = uint8(runtime[pc]);
            require(opcode != 0xf4, "unexpected DELEGATECALL proxy");
            // PUSH immediates are data, not instructions.
            pc += opcode >= 0x60 && opcode <= 0x7f ? uint256(opcode) - 0x5f + 1 : 1;
        }
    }

    function _checkToken(address token, string memory expectedSymbol) internal {
        _requireCode(token);
        // These share tokens are concrete 7,959-byte deployments, NOT proxies.
        // Prove the executable runtime contains no DELEGATECALL instead of
        // incorrectly requiring an EIP-1967 implementation slot on an ERC-20.
        _assertConcreteToken(token);
        IRestrictedToken t = IRestrictedToken(token);
        assertEq(t.symbol(), expectedSymbol, "implementation token identity");
        assertEq(uint256(t.decimals()), 6, "token precision");
        uint256 supply = t.totalSupply();
        assertTrue(supply > 10 ** 6, "circulating supply above one token");
        emit log_named_uint(expectedSymbol, supply);
    }
}
