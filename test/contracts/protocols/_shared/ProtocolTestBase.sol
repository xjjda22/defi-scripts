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
        string memory url = vm.envOr(rpcEnv, string(""));
        if (bytes(url).length == 0) {
            vm.skip(true);
            return false;
        }
        uint256 blockNo = vm.envOr("FORK_BLOCK", uint256(0));
        if (blockNo == 0) vm.createSelectFork(url);
        else vm.createSelectFork(url, blockNo);
        require(block.chainid == chainId, "chain id");
        return true;
    }

    /// A book address is only usable if something is deployed there.
    function _requireCode(address target) internal view {
        require(target.code.length > 0, "no code");
    }
}
