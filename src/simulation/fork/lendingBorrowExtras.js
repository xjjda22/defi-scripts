/**
 * Extra lending borrow flows for Curvance (Monad) and Euler EVK (Ethereum).
 * Invoked from vaultFlows when FORK_ACTION=borrow.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { CURVANCE } = require("../../catalog/contracts");
const { impersonateFunded, formatUnits, finish } = require("./runtime");

const GAS = { gasLimit: 3_000_000n };
const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];

// Curvance WMON|USDC market on Monad. https://docs.curvance.com/app/protocol-overview/monad-contract-addresses
const CURVANCE_CUSDC = "0x8EE9FC28B8Da872c38A496e9dDB9700bb7261774";
const CURVANCE_USDC = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
const CTOKEN_ABI = [
  ...ERC,
  "function asset() view returns (address)",
  "function marketManager() view returns (address)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function depositAsCollateral(uint256 assets, address receiver) returns (uint256)",
  "function postCollateral(uint256 amount)",
  "function borrow(uint256 assets, address receiver) returns (uint256)",
  "function debtBalance(address account) view returns (uint256)",
  "function debtBalanceUpdated(address account) returns (uint256)",
  "function collateralPosted(address account) view returns (uint256)",
];
const MM_ABI = [
  "function debtCaps(address) view returns (uint256)",
  "function collateralCaps(address) view returns (uint256)",
  "function actionsPaused(address) view returns (bool,bool,bool)",
  "function MIN_LOAN_SIZE() view returns (uint256)",
];

async function curvanceBorrow(base) {
  const provider = getProvider(base.chain);
  const cWmon = new ethers.Contract(CURVANCE.vault, CTOKEN_ABI, provider);
  const cUsdc = new ethers.Contract(CURVANCE_CUSDC, CTOKEN_ABI, provider);
  const managerAddr = await cWmon.marketManager();
  if (managerAddr.toLowerCase() !== CURVANCE.marketManager.toLowerCase()) {
    return finish({ ...base, ok: false, error: `cWMON marketManager ${managerAddr} != ${CURVANCE.marketManager}` });
  }
  const usdcAsset = await cUsdc.asset();
  if (usdcAsset.toLowerCase() !== CURVANCE_USDC.toLowerCase()) {
    return finish({ ...base, ok: false, error: `cUSDC asset ${usdcAsset} != ${CURVANCE_USDC}` });
  }
  const mm = new ethers.Contract(managerAddr, MM_ABI, provider);
  const [, , borrowPaused] = await mm.actionsPaused(CURVANCE_CUSDC);
  if (borrowPaused) return finish({ ...base, ok: false, key: "paused=borrow", error: "Curvance USDC borrowing paused" });
  const debtCap = await mm.debtCaps(CURVANCE_CUSDC);
  if (debtCap === 0n) return finish({ ...base, ok: false, error: "Curvance debtCaps(cUSDC)=0" });

  const collateral = ethers.parseEther(process.env.FORK_COLLATERAL || "100");
  const borrowAmt = ethers.parseUnits(process.env.FORK_AMOUNT || "50", 6);
  const signer = await impersonateFunded(base.chain, "WMON", CURVANCE.asset, collateral);
  const user = await signer.getAddress();
  const wmon = new ethers.Contract(CURVANCE.asset, ERC, signer);
  const cWmonWrite = new ethers.Contract(CURVANCE.vault, CTOKEN_ABI, signer);
  const cUsdcWrite = new ethers.Contract(CURVANCE_CUSDC, CTOKEN_ABI, signer);
  const usdc = new ethers.Contract(CURVANCE_USDC, ERC, provider);

  await (await wmon.approve(CURVANCE.vault, collateral)).wait();
  // depositAsCollateral posts shares as collateral in one call when available; fall back to deposit+postCollateral.
  let posted;
  try {
    await (await cWmonWrite.depositAsCollateral(collateral, user, GAS)).wait();
    posted = await cWmonWrite.collateralPosted(user);
  } catch {
    await (await cWmonWrite.deposit(collateral, user, GAS)).wait();
    const shares = await cWmonWrite.balanceOf(user);
    await (await cWmonWrite.postCollateral(shares, GAS)).wait();
    posted = await cWmonWrite.collateralPosted(user);
  }
  if (posted === 0n) return finish({ ...base, ok: false, error: "No Curvance collateral posted" });

  const usdcBefore = await usdc.balanceOf(user);
  const debtBefore = await cUsdc.debtBalance(user);
  const receipt = await (await cUsdcWrite.borrow(borrowAmt, user, GAS)).wait();
  const usdcAfter = await usdc.balanceOf(user);
  const debtAfter = await cUsdcWrite.debtBalanceUpdated.staticCall(user);
  const got = usdcAfter - usdcBefore;
  const ok = got === borrowAmt && debtAfter > debtBefore;
  return finish({
    ...base,
    ok,
    key: `collPosted=${posted} borrowed=${formatUnits(got, 6)}USDC debt=${formatUnits(debtBefore, 6)}->${formatUnits(debtAfter, 6)}`,
    detail: `Curvance WMON|USDC: posted ${posted} cWMON shares as collateral, borrowed ${formatUnits(borrowAmt, 6)} USDC\nUSDC ${formatUnits(usdcBefore, 6)} -> ${formatUnits(usdcAfter, 6)}, debt ${formatUnits(debtBefore, 6)} -> ${formatUnits(debtAfter, 6)}\ntx ${receipt.hash}`,
    error: ok ? null : "Curvance borrow did not credit USDC / raise debt",
  });
}

// Euler K3 Capital Prime: eWETH-? + eUSDC. https://github.com/euler-xyz/euler-labels/blob/master/1/products.json
const EVC = "0x0C9a3dd6b8F28529d72d7f9cE918D493519EE383";
const EULER_WETH_VAULT = "0xD8b27CF359b7D15710a5BE299AF6e7Bf904984C2";
const EULER_USDC_VAULT = "0x797DD80692c3b2dAdabCe8e30C07fDE5307D48a9";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const EVC_ABI = [
  "function enableCollateral(address account, address vault)",
  "function enableController(address account, address vault)",
  "function isCollateralEnabled(address account, address vault) view returns (bool)",
  "function isControllerEnabled(address account, address vault) view returns (bool)",
  "function getCollaterals(address account) view returns (address[])",
  "function getControllers(address account) view returns (address[])",
  "function batch((address targetContract, address onBehalfOfAccount, uint256 value, bytes data)[] items) payable returns (bytes[] results)",
];
const EVAULT_ABI = [
  ...ERC,
  "function asset() view returns (address)",
  "function deposit(uint256 amount, address receiver) returns (uint256)",
  "function borrow(uint256 amount, address receiver) returns (uint256)",
  "function debtOf(address account) view returns (uint256)",
  "function cash() view returns (uint256)",
  "function LTVBorrow(address collateral) view returns (uint16)",
  "function EVC() view returns (address)",
];

async function eulerBorrow(base) {
  const provider = getProvider(base.chain);
  const wethVault = new ethers.Contract(EULER_WETH_VAULT, EVAULT_ABI, provider);
  const usdcVault = new ethers.Contract(EULER_USDC_VAULT, EVAULT_ABI, provider);
  if ((await wethVault.asset()).toLowerCase() !== WETH.toLowerCase()) {
    return finish({ ...base, ok: false, error: "Euler WETH vault asset mismatch" });
  }
  if ((await usdcVault.asset()).toLowerCase() !== USDC.toLowerCase()) {
    return finish({ ...base, ok: false, error: "Euler USDC vault asset mismatch" });
  }
  if ((await usdcVault.EVC()).toLowerCase() !== EVC.toLowerCase()) {
    return finish({ ...base, ok: false, error: "Euler USDC vault EVC mismatch" });
  }
  const ltv = await usdcVault.LTVBorrow(EULER_WETH_VAULT);
  if (ltv === 0) return finish({ ...base, ok: false, error: "LTVBorrow(WETH vault)=0 on USDC vault" });
  const cash = await usdcVault.cash();
  const borrowAmt = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  if (cash < borrowAmt) return finish({ ...base, ok: false, error: `USDC vault cash ${cash} < borrow ${borrowAmt}` });

  const collateral = ethers.parseEther(process.env.FORK_COLLATERAL || "1");
  const signer = await impersonateFunded(base.chain, "WETH", WETH, collateral);
  const user = await signer.getAddress();
  const weth = new ethers.Contract(WETH, ERC, signer);
  const usdc = new ethers.Contract(USDC, ERC, provider);
  const evc = new ethers.Contract(EVC, EVC_ABI, signer);
  const wethVaultWrite = new ethers.Contract(EULER_WETH_VAULT, EVAULT_ABI, signer);
  const usdcVaultWrite = new ethers.Contract(EULER_USDC_VAULT, EVAULT_ABI, signer);

  await (await weth.approve(EULER_WETH_VAULT, collateral)).wait();
  await (await wethVaultWrite.deposit(collateral, user, GAS)).wait();
  await (await evc.enableCollateral(user, EULER_WETH_VAULT, GAS)).wait();
  await (await evc.enableController(user, EULER_USDC_VAULT, GAS)).wait();
  if (!(await evc.isCollateralEnabled(user, EULER_WETH_VAULT))) {
    return finish({ ...base, ok: false, error: "enableCollateral failed" });
  }
  if (!(await evc.isControllerEnabled(user, EULER_USDC_VAULT))) {
    return finish({ ...base, ok: false, error: "enableController failed" });
  }

  const usdcBefore = await usdc.balanceOf(user);
  const debtBefore = await usdcVault.debtOf(user);
  const receipt = await (await usdcVaultWrite.borrow(borrowAmt, user, GAS)).wait();
  const usdcAfter = await usdc.balanceOf(user);
  const debtAfter = await usdcVault.debtOf(user);
  const got = usdcAfter - usdcBefore;
  const ok = got === borrowAmt && debtAfter > debtBefore && (await evc.isControllerEnabled(user, EULER_USDC_VAULT));
  return finish({
    ...base,
    ok,
    key: `ltv=${ltv} borrowed=${formatUnits(got, 6)}USDC debt=${formatUnits(debtBefore, 6)}->${formatUnits(debtAfter, 6)}`,
    detail: `Euler K3 Prime: deposit ${formatUnits(collateral, 18)} WETH, EVC.enableCollateral + enableController, borrow ${formatUnits(borrowAmt, 6)} USDC\nUSDC ${formatUnits(usdcBefore, 6)} -> ${formatUnits(usdcAfter, 6)}, debt ${formatUnits(debtBefore, 6)} -> ${formatUnits(debtAfter, 6)}, LTVBorrow=${ltv}\ntx ${receipt.hash}`,
    error: ok ? null : "Euler EVC borrow did not credit USDC / raise debt",
  });
}

module.exports = { curvanceBorrow, eulerBorrow };
