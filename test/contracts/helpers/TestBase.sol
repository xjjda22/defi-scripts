// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Minimal cheatcode surface used by these tests. Declared locally so the project
/// needs no `lib/forge-std` dependency.
interface Vm {
    function readFile(string calldata path) external view returns (string memory);
    function projectRoot() external view returns (string memory);
    function parseJsonUint(string calldata json, string calldata key) external pure returns (uint256);
    function toString(uint256 value) external pure returns (string memory);
    function prank(address sender) external;
    function expectRevert(bytes calldata revertData) external;
    function store(address target, bytes32 slot, bytes32 value) external;
    function load(address target, bytes32 slot) external view returns (bytes32);

    // Fork + fixture surface, added for the real-protocol fork tests.
    function createSelectFork(string calldata url) external returns (uint256);
    function createSelectFork(string calldata url, uint256 blockNumber) external returns (uint256);
    function envOr(string calldata name, string calldata defaultValue) external returns (string memory);
    function envOr(string calldata name, uint256 defaultValue) external returns (uint256);
    function envOr(string calldata name, address defaultValue) external returns (address);
    function deal(address token, address to, uint256 give) external;
    function deal(address to, uint256 give) external;
    function skip(bool skipTest) external;

    // Per-test flow surface for the protocol suite.
    function startPrank(address sender) external;
    function stopPrank() external;
    function warp(uint256 newTimestamp) external;
    function roll(uint256 newHeight) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData) external;
}

Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

/// Just enough ERC-20 for the flash receivers: mint, approve and transferFrom.
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

/// Plain require-based assertions; a revert is a failing test.
contract TestBase {
    function assertEq(uint256 a, uint256 b, string memory err) internal pure {
        require(a == b, err);
    }

    function assertEq(int256 a, int256 b, string memory err) internal pure {
        require(a == b, err);
    }

    function assertEq(address a, address b, string memory err) internal pure {
        require(a == b, err);
    }

    function assertEq(string memory a, string memory b, string memory err) internal pure {
        require(keccak256(bytes(a)) == keccak256(bytes(b)), err);
    }

    function assertTrue(bool condition, string memory err) internal pure {
        require(condition, err);
    }
}
