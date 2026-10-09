/**
 * Attach a signer to a provider.
 * ethers Wallet.connect works. Anvil's JsonRpcSigner refuses connect(); it is already
 * bound to the fork provider, so the fork path keeps that signer.
 */
function signerOn(wallet, provider) {
  if (!wallet) throw new Error("missing wallet");
  if (wallet.provider) {
    try {
      const connected = wallet.connect(provider);
      if (connected) return connected;
    } catch {
      return wallet;
    }
  }
  return wallet.connect(provider);
}

module.exports = { signerOn };
