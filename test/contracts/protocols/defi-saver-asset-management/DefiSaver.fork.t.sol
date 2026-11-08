// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IDfsRegistry {
    function getAddr(bytes4) external view returns (address);
}

interface IDfsToken {
    function deposit() external payable;
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface IDfsAavePool {
    struct ReserveData {
        uint256 configuration;
        uint128 liquidityIndex;
        uint128 currentLiquidityRate;
        uint128 variableBorrowIndex;
        uint128 currentVariableBorrowRate;
        uint128 currentStableBorrowRate;
        uint40 lastUpdateTimestamp;
        uint16 id;
        address aTokenAddress;
        address stableDebtTokenAddress;
        address variableDebtTokenAddress;
        address interestRateStrategyAddress;
        uint128 accruedToTreasury;
        uint128 unbacked;
        uint128 isolationModeTotalDebt;
    }
    function getReserveData(address) external view returns (ReserveData memory);
    function ADDRESSES_PROVIDER() external view returns (address);
}

interface IDfsRecipeExecutor {
    struct Recipe {
        string name;
        bytes[] callData;
        bytes32[] subData;
        bytes4[] actionIds;
        uint8[][] paramMapping;
    }
    function executeRecipe(Recipe calldata) external payable;
}

/// Local delegatecall receiver fixture, NOT a replacement RecipeExecutor or Aave implementation.
/// The primitive under test is the real DFS recipe dispatch into its registered AaveV3Supply.
/// Production DSProxy factory creation/authorization is deliberately outside this primitive.
contract DfsDelegatecallFixture {
    address private immutable owner;

    constructor(address owner_) {
        owner = owner_;
    }

    function execute(address target, bytes calldata data) external {
        require(msg.sender == owner, "fixture owner");
        (bool ok, bytes memory result) = target.delegatecall(data);
        if (!ok) {
            assembly { revert(add(result, 32), mload(result)) }
        }
    }
}

contract DefiSaverForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_defisaver_supply_recipe() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("ETHEREUM_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address registry = Addresses.DefiSaverAssetManagement.DFSREGISTRY;
        // Resolve the current implementation from the book-anchored DFSRegistry.
        // The static RECIPEEXECUTOR entry is stale at the pinned W1 block.
        address executor = IDfsRegistry(registry).getAddr(bytes4(keccak256("RecipeExecutor")));
        address pool = Addresses.Aave.V3_POOL;
        address weth = Addresses.Tokens.WETH_ETHEREUM;
        _requireCode(registry);
        _requireCode(executor);
        _requireCode(pool);
        _requireCode(weth);
        _requireCode(IDfsRegistry(registry).getAddr(bytes4(keccak256("AaveV3Supply"))));
        IDfsAavePool.ReserveData memory reserve = IDfsAavePool(pool).getReserveData(weth);
        _requireCode(reserve.aTokenAddress);
        address market = IDfsAavePool(pool).ADDRESSES_PROVIDER();
        _requireCode(market);
        address user = address(uint160(uint256(keccak256("w1b DFS recipe owner"))));
        DfsDelegatecallFixture wallet = new DfsDelegatecallFixture(user);
        vm.deal(user, 1 ether);
        vm.startPrank(user);
        IDfsToken(weth).deposit{value: 1 ether}();
        IDfsToken(weth).approve(address(wallet), 1 ether);
        vm.stopPrank();
        uint256 beforeShares = IDfsToken(reserve.aTokenAddress).balanceOf(address(wallet));
        vm.prank(user);
        wallet.execute(executor, abi.encodeCall(IDfsRecipeExecutor.executeRecipe, (_recipe(user, reserve.id, market))));
        uint256 minted = IDfsToken(reserve.aTokenAddress).balanceOf(address(wallet)) - beforeShares;
        require(minted >= 1 ether - 2 && minted <= 1 ether + 2, "real Aave receipt delta");
        assertEq(IDfsToken(weth).balanceOf(user), 0, "owner WETH spent");
        assertEq(IDfsToken(weth).balanceOf(address(wallet)), 0, "wallet WETH supplied");
        emit log_named_uint("DFS recipe WETH supplied", 1 ether);
        emit log_named_uint("wallet aWETH minted", minted);
    }

    function _recipe(address user, uint16 reserveId, address market)
        private
        pure
        returns (IDfsRecipeExecutor.Recipe memory recipe)
    {
        recipe.name = "W1b single AaveV3Supply primitive";
        recipe.callData = new bytes[](1);
        // Same Params tuple as specialFlows.js: amount, from, assetId, enableAsColl,
        // useDefaultMarket, useOnBehalf, market, onBehalf.
        recipe.callData[0] = abi.encode(uint256(1 ether), user, reserveId, true, false, false, market, address(0));
        recipe.subData = new bytes32[](0);
        recipe.actionIds = new bytes4[](1);
        recipe.actionIds[0] = bytes4(keccak256("AaveV3Supply"));
        recipe.paramMapping = new uint8[][](1);
        recipe.paramMapping[0] = new uint8[](8);
    }
}
