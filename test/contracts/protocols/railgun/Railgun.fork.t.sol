// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

struct RailgunToken {
    uint8 tokenType;
    address tokenAddress;
    uint256 tokenSubID;
}

struct RailgunPreimage {
    bytes32 npk;
    RailgunToken token;
    uint120 value;
}

struct RailgunCiphertext {
    bytes32[3] encryptedBundle;
    bytes32 shieldKey;
}

struct RailgunShieldRequest {
    RailgunPreimage preimage;
    RailgunCiphertext ciphertext;
}

interface IRailgunWallet {
    function shield(RailgunShieldRequest[] calldata requests) external;
    function shieldFee() external view returns (uint120);
    function treasury() external view returns (address);
    function nextLeafIndex() external view returns (uint256);
    function getFee(uint136 amount, bool inclusive, uint120 feeBP)
        external
        view
        returns (uint120 noteValue, uint120 fee);
    function hashLeftRight(bytes32 left, bytes32 right) external view returns (bytes32);
}

contract RailgunForkTest is ProtocolTestBase {
    function test_fork_railgun_shield_usdc() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address wallet = Addresses.Railgun.RAILGUNSMARTWALLET_ETHEREUM_PROXY_EIP_1967;
        address usdc = Addresses.Railgun.USDC_THE_SHIELDED_TOKEN;
        address treasury = Addresses.Railgun.RAILGUN_TREASURY_RECEIVES_THE_SHIELD_DEDUCTION;
        _requireCode(wallet);
        _requireCode(usdc);
        IRailgunWallet w = IRailgunWallet(wallet);
        assertEq(w.treasury(), treasury, "treasury wiring");
        uint256 amount = 10e6;
        (uint120 noteValue, uint120 fee) = w.getFee(uint136(amount), true, w.shieldFee());
        RailgunShieldRequest[] memory requests = _request(w, usdc, noteValue);
        address user = address(0xA11CE);
        _dealUsdc(usdc, user, amount);
        uint256 walletBefore = IERC20(usdc).balanceOf(wallet);
        uint256 treasuryBefore = IERC20(usdc).balanceOf(treasury);
        uint256 leafBefore = w.nextLeafIndex();
        vm.startPrank(user);
        IERC20(usdc).approve(wallet, amount);
        w.shield(requests);
        vm.stopPrank();
        uint256 walletDelta = IERC20(usdc).balanceOf(wallet) - walletBefore;
        uint256 treasuryDelta = IERC20(usdc).balanceOf(treasury) - treasuryBefore;
        assertTrue(walletDelta > 0, "wallet custody increased");
        assertTrue(treasuryDelta > 0 && treasuryDelta <= fee, "treasury fee increased");
        assertTrue(walletDelta < amount, "wallet received post-fee value");
        assertEq(w.nextLeafIndex(), leafBefore + 1, "leaf index delta");
        assertTrue(IERC20(usdc).balanceOf(user) < amount, "USDC spent");
    }

    function _request(IRailgunWallet w, address usdc, uint120 value)
        private
        returns (RailgunShieldRequest[] memory requests)
    {
        bytes32 master = w.hashLeftRight(bytes32(uint256(1)), bytes32(uint256(2)));
        bytes32 random = w.hashLeftRight(bytes32(uint256(3)), bytes32(uint256(4)));
        bytes32 npk = w.hashLeftRight(master, random);
        RailgunPreimage memory preimage = RailgunPreimage(npk, RailgunToken(0, usdc, 0), value);
        RailgunCiphertext memory ciphertext = RailgunCiphertext([bytes32(0), bytes32(0), bytes32(0)], bytes32(0));
        requests = new RailgunShieldRequest[](1);
        requests[0] = RailgunShieldRequest(preimage, ciphertext);
    }

    function _dealUsdc(address token, address user, uint256 amount) private {
        bytes32 slot = keccak256(abi.encode(user, uint256(9)));
        vm.store(token, slot, bytes32(amount));
    }
}
