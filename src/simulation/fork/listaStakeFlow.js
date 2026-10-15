/**
 * Lista liquid staking on BSC: deposit() BNB → slisBNB.
 * Addresses: https://docs.bsc.lista.org/for-developer/liquid-staking-slisbnb/smart-contract
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { impersonateAccount } = require("../../utils/impersonate");
const { LISTA_STAKE } = require("../../catalog/contracts");
const { requireFork, formatUnits, finish } = require("./runtime");

const MANAGER_ABI = ["function deposit() payable"];
const ERC = ["function balanceOf(address) view returns (uint256)"];

async function run() {
  const chain = "bsc";
  const protocol = process.env.FORK_PROTOCOL || "lista";
  const action = process.env.FORK_ACTION || "stake";
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const base = { protocol, action, chain, block: ctx.forkBlock };
  try {
    const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.1");
    const signer = await impersonateAccount(ethers.Wallet.createRandom().address, chain);
    const user = await signer.getAddress();
    const provider = getProvider(chain);
    const slis = new ethers.Contract(LISTA_STAKE.slisBNB, ERC, provider);
    const before = await slis.balanceOf(user);
    const manager = new ethers.Contract(LISTA_STAKE.manager, MANAGER_ABI, signer);
    const receipt = await (await manager.deposit({ value, gasLimit: 1_500_000n })).wait();
    const after = await slis.balanceOf(user);
    const minted = after - before;
    const ok = minted > 0n;
    return finish({
      ...base,
      ok,
      key: `slisBNB=${formatUnits(before, 18)}->${formatUnits(after, 18)}`,
      detail: `deposited ${formatUnits(value, 18)} BNB via ListaStakeManager.deposit()\nslisBNB ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\ntx ${receipt.hash}`,
      error: ok ? null : "slisBNB was not minted",
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
