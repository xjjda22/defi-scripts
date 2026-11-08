// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {TestBase, vm} from "../../helpers/TestBase.sol";

/// Shared harness for the per-protocol fork tests: one fork per test, a skip
/// instead of a failure when the RPC env var is absent, and a code check for
/// every address taken from the generated book.
abstract contract ProtocolTestBase is TestBase {
    /// Selects a fork in-process. Returns false (and marks the test skipped)
    /// when the RPC env var is unset, so a no-RPC run reports SKIP, not FAIL.
    function _fork(string memory rpcEnv, uint256 chainId) internal returns (bool) {
        // FORK_RPC_URL is the local Anvil override; the intended chain is still checked.
        string memory url = vm.envOr("FORK_RPC_URL", vm.envOr(rpcEnv, string("")));
        if (bytes(url).length == 0) {
            vm.skip(true);
            return false;
        }
        uint256 blockNo = vm.envOr("FORK_BLOCK", uint256(0));
        if (blockNo == 0) {
            string memory pins = vm.readFile(string.concat(vm.projectRoot(), "/data/fork-blocks.json"));
            blockNo = vm.parseJsonUint(pins, string.concat(".chainsById.", vm.toString(chainId), ".blockNumber"));
        }
        require(blockNo > 0, "missing fork pin: observe this chain first");
        vm.createSelectFork(url, blockNo);
        require(block.chainid == chainId, "chain id");
        return true;
    }

    /// Receiver checks may select another configured chain explicitly. Address overrides
    /// remain the caller's responsibility; a protocol name never selects a chain.
    function _forkConfigured(uint256 defaultChainId) internal returns (bool) {
        uint256 chainId = vm.envOr("FORK_CHAIN_ID", defaultChainId);
        string memory pins = vm.readFile(string.concat(vm.projectRoot(), "/data/fork-blocks.json"));
        string memory rpcEnv = vm.parseJsonString(
            pins, string.concat(".chainsById.", vm.toString(chainId), ".rpcEnv")
        );
        return _fork(rpcEnv, chainId);
    }

    /// A book address is only usable if something is deployed there.
    function _requireCode(address target) internal view {
        require(target.code.length > 0, "no code");
    }
}
