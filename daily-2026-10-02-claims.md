# Daily defi-scripts claims — 2026-10-02 (Friday, Malaysia / Asia/Kuala_Lumpur)

## Meta
- **Research date:** 2026-10-02 (MYT / UTC+8)
- **X lists: not scanned.** X MCP has no list endpoints; no X list scrape was attempted. Public sources only (crypto news, security feeds, protocol blogs, DefiLlama APIs for corroboration after a dated news claim). X `search_news` was used only as discovery; every qualifying row below cites a dated public URL.
- **Research window:** **2026-09-25 through 2026-10-02 inclusive** (Malaysia date).
- **Repo baseline:** https://github.com/xjjda22/defi-scripts @ `7d1aba1` (local `/workspace/defi-scripts` on latest main). PR #7 shipped ether.fi / Sentora / Kelp / Bedrock / Swell / Renzo / Puffer — **Keyrock and Magic Eden from 2026-09-29 research were NOT shipped** and remain BUILD if still in-window.
- **HARD RULE:** a protocol that only appears on DefiLlama top-TVL / mover / trending with **no dated news/security/blog claim in-window does NOT qualify**.
- AI-generated roundups and sources dated before 2026-09-25 are excluded.
- DefiLlama: per-candidate `GET /protocol/<slug>` HTTP 200 checks below; window hacks include Fake GIWA Bridge (2026-09-27), SKYDAO (2026-09-30), NEAR Intents (2026-10-01).

---

## A) QUALIFYING NEW BUILD TARGETS

Ranked by (1) source strength / independent corroboration, then (2) magnitude / novelty. Repo cannot already answer these with an existing dedicated monitor.

### 1. Variational — ~23% perp DEX volume; September volume **>$48B**; 30d ~**$50B** / OI ~**$1.07B**; 32% VAR airdrop
- **Protocol name:** Variational (Omni perps)
- **DefiLlama slug:** `variational` (HTTP 200, name=Variational, category=Derivatives, chains=Off Chain; `currentChainTvls` empty — use `SMOKE_MIN_TVL_USD=0`; dimensions map to `variational-omni` for derivatives/OI)
- **Checkable claim:** The Block Data & Insights (**2026-09-30**): Variational made up ~**23%** of all perp DEX volume (record share the day it published VAR tokenomics); September volume so far **>$48B** (~**60%** above August); 30-day volume ~**$50B** with ~**$1.07B** OI (~47× turnover); **32%** of VAR supply for genesis airdrop (fully unlocked at Q4 TGE); **150K** points/week until TGE.
- **Source URL + date:** https://www.theblock.co/newsletters/data-and-insights/2026-09-30-data-passive-base-417118 — **2026-09-30** (CryptoBriefing tokenomics piece is **2026-09-23**, out of window — do not use as primary)
- **Why BUILD:** Dated numeric volume/OI/airdrop claims; verified slug; no `variational` scripts. Peers Hyperliquid/Lighter already covered.
- **Suggested npm scripts:** `analytics:variational:perps` + `simulate:variational:smoke` (`DEFILLAMA_SLUG=variational`, `SMOKE_MIN_TVL_USD=0`)

### 2. Drift — DFX recovery claims after ~**$295M** April incident; pool ~**3.11M USDT**; **299.5M** DFX supply
- **Protocol name:** Drift
- **DefiLlama slug:** `drift` (HTTP 200, name=Drift; non-staking TVL ≈ **$335M**; fees API 24h ≈ $59K / 30d ≈ $1.22M)
- **Checkable claim:** CryptoBriefing / TokenPost (**2026-10-01**): Drift Foundation opened DFX claims/redemptions for verified April 1 losses (~**$295M**). Fixed supply **299.5M** DFX (1 DFX per verified USDT lost). Recovery Pool holds ~**3.1–3.11M USDT** (redemption ≈ **0.0104 USDT**/DFX at launch). Tether commitment up to **127.5M USDT** + partners up to **20M USDT**. Claims window through **2028-01-01**; unclaimed DFX burned.
- **Source URL + date:**
  - https://cryptobriefing.com/drift-dfx-recovery-token-claims-april-exploit/ — **2026-10-01**
  - https://www.tokenpost.com/news/technology/26196 — **2026-10-01**
- **Why BUILD:** Dated recovery-token / pool / supply numbers; verified slug; no `drift` scripts (Solana TVL recovery pieces alone would be chain-level).
- **Suggested npm scripts:** `analytics:drift:perps` + `simulate:drift:smoke` (optional `DEFILLAMA_FEES=1`)

### 3. Pharaoh Exchange — record 30d volume ~**$2.866B** and fees ~**$2.48M** on Avalanche
- **Protocol name:** Pharaoh Exchange
- **DefiLlama slug:** `pharaoh-exchange` (HTTP 200, name=Pharaoh Exchange; Avalanche TVL ≈ **$47.4M** non-staking; fees 30d ≈ **$2.48M**; DEX volume 30d ≈ **$2.87B**)
- **Checkable claim:** CryptoBriefing (**2026-10-01**): busiest month on record — ~**$2.866B** 30-day volume and ~**$2.48M** 30-day fees (DefiLlama); cumulative DEX volume **>$34B**; lifetime fees **>$32M**; TVL ~**$47–53M**; V2→V3 migration closes **2026-10-31**.
- **Source URL + date:** https://cryptobriefing.com/pharaoh-exchange-record-monthly-volume-fees/ — **2026-10-01**
- **Why BUILD:** Strong dated volume+fees claim; verified parent slug; no Pharaoh scripts (sibling slugs `pharaoh-v3` / `pharaoh-dlmm` exist on Llama — prefer parent `pharaoh-exchange` to match the article).
- **Suggested npm scripts:** `analytics:pharaoh:dex` + `simulate:pharaoh:smoke` (`DEFILLAMA_FEES=1` / `SMOKE_FEES=1`)

### 4. HyperLend — institutional Aviya facility; protocol market size **>$800M**
- **Protocol name:** HyperLend
- **DefiLlama slug:** `hyperlend` (HTTP 200, name=HyperLend; Hyperliquid L1 TVL ≈ **$399M** + borrowed ≈ **$208M**; fees 30d ≈ **$1.23M**). Sibling `hyperlend-pooled` also 200.
- **Checkable claim:** GlobeNewswire / Stockhouse press (**2026-09-30**): Hyperion DeFi + Anchorage + HyperLend launch first institutional credit facility on HyperLend’s Aviya Finance (staked HYPE in Anchorage custody). HyperLend stated **over $800 Million in market size**. Also: **150 million HYPE** staked outside Labs/Foundation representing **over $10 billion** in staked assets.
- **Source URL + date:** https://stockhouse.com/news/press-releases/2026/09/30/hyperion-defi-anchorage-digital-and-hyperlend-together-announce-the-first — **2026-09-30**
- **Why BUILD:** Prior research lacked in-window dated news; this press release supplies checkable market-size claim + verified slug; no HyperLend scripts.
- **Suggested npm scripts:** `analytics:hyperlend:lending` + `simulate:hyperlend:smoke` (optional `DEFILLAMA_FEES=1`)

### 5. Fables — Robinhood Chain DEX; ~**$45M** deposits; **>$2B** cumulative volume; TGE **2026-10-20**; max circ **75M**
- **Protocol name:** Fables
- **DefiLlama slug:** `fables` (HTTP 200, name=Fables, category=Dexs; Robinhood Chain TVL ≈ **$45.4M**; DEX volume 30d ≈ **$2.00B**; fees 30d ≈ **$3.89M**)
- **Checkable claim:** PANews (**2026-09-30**): FABLES TGE planned **2026-10-20** with ve(3,3); points extended to Oct 19; max circulating supply at TGE **75 million** (team share not circulating); platform has **52** markets, about **$45 million** deposits, and **over $2 billion** cumulative trading volume on Robinhood Chain.
- **Source URL + date:** https://www.panews.io/articles/01a0f277-bfed-723b-af07-8d537ac49956 — **2026-09-30**
- **Why BUILD:** Prior SKIP (out-of-window TGE chatter) now has in-window dated deposits/volume/supply claims + verified slug.
- **Suggested npm scripts:** `analytics:fables:dex` + `simulate:fables:smoke` (`DEFILLAMA_FEES=1`)

### 6. Keyrock — Arc Morpho curator vault **$74.99M** (TokenPost Sep 28) — unshipped from 2026-09-29
- **Protocol name:** Keyrock (Risk Curator)
- **DefiLlama slug:** `keyrock` (HTTP 200, name=Keyrock, category=Risk Curators; Ethereum TVL ≈ **$7.2M** — Arc vault may not yet be fully in Llama series)
- **Checkable claim:** TokenPost (**2026-09-28**): Arc cirBTC/USDC Morpho market allocations include **$74.99M** in **Keyrock Prime USDC** (Galaxy USDC **$76.62M**); market size **$176.71M**, borrowings **$18.86M**, liquidity **$157.85M**.
- **Source URL + date:** https://www.tokenpost.com/news/business/25020 — **2026-09-28**
- **Why BUILD:** Still in window; PR #7 did not ship Keyrock; Risk Curators pattern like Steakhouse/Sentora.
- **Suggested npm scripts:** `analytics:keyrock:curator` + `simulate:keyrock:smoke`

### 7. Ostium — recovery portal for **$23.75M** OLP drain; **3,321** wallets repaid in full; **345** choose
- **Protocol name:** Ostium
- **DefiLlama slug:** `ostium` (HTTP 200, name=Ostium, category=Derivatives; Arbitrum TVL ≈ **$8.6M**; fees 30d ≈ **$51K**)
- **Checkable claim:** The Crypto Times (**2026-10-01**; portal opened Wed **2026-09-30**): OLP Recovery Plan repays **3,321** of **3,666** wallets in full (losses ≤ **$1,000**); remaining **345** elect by Oct 30 between **$1,000** flat or pro-rata; confirmed drain **23,752,746 USDC**; initial recovery funding **649,967.55 USDC** (~**2.7%** of loss).
- **Source URL + date:** https://www.cryptotimes.io/2026/10/01/ostium-23-75m-hack-recovery-3321-wallets-repaid-345-lps-face-1000-choice/ — **2026-10-01**
- **Why BUILD:** Dated exploit/recovery numerics; verified slug; no Ostium scripts.
- **Suggested npm scripts:** `analytics:ostium:perps` + `simulate:ostium:smoke`

### 8. Magic Eden — Limit Break Payment Processor V2 exploit; whitehat rescue **>$5.7M** NFTs — unshipped from 2026-09-29
- **Protocol name:** Magic Eden
- **DefiLlama slug:** `magic-eden` (HTTP 200, name=Magic Eden, category=NFT Marketplace; use `SMOKE_MIN_TVL_USD=0` — non-staking TVL tiny vs Solana staking series)
- **Checkable claim:** Limit Break Payment Processor V2 exploit began **2026-09-24**; Decrypt (**2026-09-25**) reports whitehat rescue of **23,155** NFTs worth **>$5.7M** and **660 WETH** unrecovered; Bitzo / 5NFT (**2026-09-27**) cite Revoke.cash minimum theft **≥$2.8M** across Ethereum/Polygon/Base/Arbitrum/ApeChain.
- **Source URL + date:**
  - https://decrypt.co/379342/magic-eden-old-ethereum-nft-listings-exposed-exploit — **2026-09-25**
  - https://bitzo.com/2026/09/magic-eden-limit-break-v2-legacy-approvals-exploit — **2026-09-27**
- **Why BUILD:** Still in window; PR #7 did not ship Magic Eden; landscape `analytics:nft:markets` does not pin Magic Eden.
- **Suggested npm scripts:** `analytics:magiceden:nft` + `simulate:magiceden:smoke` (`SMOKE_MIN_TVL_USD=0`)

---

## B) ALREADY COVERED (dated claim in window; repo already answers)

| Protocol | Claim (short) | Source date | Why COVERED |
| --- | --- | --- | --- |
| ether.fi | Exits EigenLayer; card 46% rev; Q2 gross profit figures | 2026-09-28 CoinDesk | `analytics:etherfi:neobank` (PR #7) |
| Kelp / Bedrock / Swell / Renzo / Puffer | LRT Q2 profit cohort **$953,350** | 2026-09-28 CoinDesk | dedicated restaking monitors (PR #7) |
| Sentora Curator | Morpho vaults **>$1.1B**; PYUSD ~**$425M** / RLUSD ~**$414M**; Sep 30 outflows after MetaMask incident; Aave V4 50% rev-share ARFC | 2026-09-25 Portals; 2026-09-30 CryptoBriefing / Altcoin Buzz | `analytics:sentora:curator` |
| Steakhouse Financial | Prime Instant Base **$444.37M**; named largest Morpho curator vs Sentora | 2026-09-25 Portals; 2026-09-30 CryptoBriefing | `analytics:steakhouse:curator` |
| Upshift | Sentora USD Earn **$94.41M** | 2026-09-25 Portals | `analytics:upshift:allocator` |
| Circle Bitcoin / Arc Morpho | cirBTC market **$176.71M** / borrowings **$18.86M** | 2026-09-28 TokenPost | `analytics:btc:wrap-trail` + circle/arc |
| Arc Chain | DeFi TVL ~**$482–494M** post-mainnet | late-Sep TokenPost / X-corroborated public flashes | `analytics:arc:chain` |
| Circle (stable) | 24h revenue **$7.35M** | 2026-09-26 BlockBeats | `analytics:circle:stable` |
| NEAR Intents | **$3.8M** Omni exploit Oct 1; earlier froze **$503K** / blocked **>$50M** Bitget laundering | 2026-10-01 CoinDesk / The Block; 2026-09-29 CoinDesk | `analytics:near:intents` |
| Hyperliquid | Perp peer in Variational/The Block; HYPE OI ATH context | 2026-09-30 The Block | `analytics:hyperliquid:perps` |
| Lighter | Named as prior airdrop-playbook peer | 2026-09-30 The Block | `analytics:lighter:perps` |
| Ethena | USDe supply ~**$5B**; Base USDe ~**$393M** | 2026-09-30 The Block | `analytics:ethena:monitor` |
| Morpho | ~**$3.9B** of Base TVL; hosts Sentora/Steakhouse/Keyrock vaults | 2026-09-30 The Block | `analytics:morpho:optimizer` |
| Sky | USDS supply **>$10B** after **+$237M** 24h | 2026-09-30 CryptoBriefing | `analytics:sky:rates` |
| Lido | MetaMask staking incident → ETH staking exits / reward warnings | 2026-10-01 CoinDesk | `analytics:lido:staking` |
| Aave | syrupUSDC-on-Arc ARFC (Maple); FlashLoopAdapter custom-module drain ~**$305K** (not Aave core) | 2026-09-29 Merkle.Press; 2026-10-02 CryptoTimes | `analytics:aave:markets` |
| Spark | named in prior TokenPost BTC/USDC facility context (still in window) | 2026-09-28 TokenPost | `analytics:spark:lend` |
| Meteora DLMM | Cycle 2 **$700K+** USDC | 2026-09-23 Solana Compass (in window) | `analytics:meteora:dex` |
| pump.fun | 24h rev **$1.96M** | 2026-09-26 BlockBeats | `analytics:pumpfun:launchpad` |
| Bitget / Payy / Meter / Drop / Astroport / THORChain | prior-window exploits still dated in lookback | 2026-09-23–28 | existing monitors |
| DeepBook / Jito / Sanctum / Kamino / Jupiter Lend / NAVI / Suilend / USD AI / Kuru / Raydium / BisonFi / PumpSwap / DFDV / Polymarket / EigenLayer | prior dated claims still inside 7-day window | 2026-09-20–25 | existing monitors |

---

## C) SKIPPED

### Rechecked priors — still no qualifying in-window claim / path
| Item | Reason |
| --- | --- |
| Maple | Official Memo `datePublished` **2026-09-17** still out of window. Merkle.Press **2026-09-29** Aave syrupUSDC-on-Arc ARFC has **no Maple TVL/AUM/fees numeric claim** → skip (slug `maple` exists for a future dated metric claim) |
| Unit | Bridge slug `unit` HTTP 200 (~$0.7B+ TVL) but **no in-window Unit-named dated news claim** |
| JustLend | Slug `justlend` HTTP 200 (~$7.2B) but KuCoin snapshot **2026-09-08** and ~$3.84B flashes ~**2026-09-22/23** are **out of window** |
| Milk Road Swap / Soneium DEX / MegaETH AMM | Still **no verified DefiLlama slugs** (`milk-road`, `soneium`, `megaeth` → 400) |
| Symbiotic | CoinDesk restaking piece mentions without in-window Symbiotic numeric claim |
| Galaxy Digital curator | TokenPost names Galaxy USDC **$76.62M**; `/protocol/galaxy-digital` → **400** |

### No slug / wrong type / landscape / unreliable
| Item | Reason |
| --- | --- |
| FlashLoopAdapter | Custom Aave-linked Safe module drain ~**$305K** (CryptoTimes **2026-10-02**) — not a Llama protocol slug |
| SKYDAO | Llama hacks **2026-09-30** (~$183K); no `/protocol/skydao` slug and no dated news write-up found |
| Fake GIWA Bridge / DYORSWAP | Social-engineering fake L2 (**2026-09-27**); not a clean protocol TVL drain |
| Duelbits | Hot-wallet ~$7M; not a DeFi TVL slug monitor |
| Limit Break (standalone) | No `/protocol/limit-break`; covered via Magic Eden BUILD |
| Base / Solana / Robinhood Chain TVL ATH pieces | **Chain-level**, not protocol BUILD |
| Tokenized stocks **$20.9B** DEX volume / Uniswap share | Multi-venue landscape; Uniswap already covered |
| Papertrade / Venice.ai / VestExchange | Launch/token chatter without verified Llama slug + checkable DeFi metric |
| CoW Swap TWAP-to-EOA | Feature launch (**2026-09-30**); no new volume/TVL claim → existing `analytics:cowswap:dex` sufficient |
| Aerodrome multi-chain fee projection | Existing `analytics:aerodrome:dex` |

---

## Counts
- **BUILD targets:** **8**
- **Already covered (table):** **25+**
- **Skipped:** named above (movers without news + no-slug / out-of-window / landscape)

## Top BUILD one-liners (rank order)
1. **Variational** (`variational`) — The Block 2026-09-30: ~23% perp DEX vol; Sep **>$48B**; 30d ~**$50B** / OI ~**$1.07B**; 32% airdrop.
2. **Drift** (`drift`) — CryptoBriefing/TokenPost 2026-10-01: DFX claims after ~**$295M** loss; pool ~**3.11M USDT**.
3. **Pharaoh Exchange** (`pharaoh-exchange`) — CryptoBriefing 2026-10-01: 30d vol ~**$2.866B**, fees ~**$2.48M**.
4. **HyperLend** (`hyperlend`) — Press 2026-09-30: institutional Aviya facility; market size **>$800M**.
5. **Fables** (`fables`) — PANews 2026-09-30: ~**$45M** deposits, **>$2B** cum vol; TGE Oct 20 / 75M max circ.
6. **Keyrock** (`keyrock`) — TokenPost 2026-09-28: Keyrock Prime USDC **$74.99M** on Arc (unshipped).
7. **Ostium** (`ostium`) — CryptoTimes 2026-10-01: **$23.75M** recovery; **3,321** wallets repaid.
8. **Magic Eden** (`magic-eden`) — Decrypt/Bitzo: Limit Break exploit; **>$5.7M** rescue / **≥$2.8M** stolen (unshipped).

## Suggested next build pass
Ship all eight BUILD rows (no daily cap). Prefer `DEFILLAMA_FEES=1` for Pharaoh, Fables, Drift, HyperLend. Variational + Magic Eden: `SMOKE_MIN_TVL_USD=0`. Keyrock smoke may show <<$75M until Arc curator TVL is indexed — still ship the curator monitor.
