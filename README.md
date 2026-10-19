# Solar Sail (1AU)

A meme coin on Base that moves with the real solar wind.

Every day at 10:30 UTC the 24-hour mean speed of the solar wind (NOAA SWPC, spacecraft at L1) is signed by four
independent [Opsikom](https://opsikom.com) operators and published on chain. The coin updates in the same transaction:

- **Up to 600 km/s: mint.** 0.035% of the supply × (wind ÷ 426)², split 60% to the Uniswap V2 pool, 30% to stakers, 10% to holders.
- **Above 600 km/s: storm.** No mint; 0.5% of the V2 pool is burned, plus 0.1% for every 10 km/s more, up to 3%.
- **Brake.** If net growth over the last 365 days passes 10%, holders stop receiving and the rest fades to zero at 15%.
- Wallet balances never go down. No trading fees. No team allocation.

Supply: **149,597,870,700 1AU**, the distance from the Earth to the Sun in metres.

## Test network

Everything runs on **Base Sepolia** (chain ID 84532). Test coins have no value. The contract is a draft and has not been audited.

| Contract | Address |
|---|---|
| 1AU coin | [`0x96bDE263a3745b5F3559265BC62CfeC7e9EBBC08`](https://sepolia.basescan.org/address/0x96bDE263a3745b5F3559265BC62CfeC7e9EBBC08) |
| Uniswap V2 pool | [`0x08830B494A66b6212917Cdc1303b85781d906B22`](https://sepolia.basescan.org/address/0x08830B494A66b6212917Cdc1303b85781d906B22) |
| Uniswap V3 pool | [`0x93EF74df387675Ecc8126b39FA39dD66df8bdca2`](https://sepolia.basescan.org/address/0x93EF74df387675Ecc8126b39FA39dD66df8bdca2) |
| SOLAR_WIND feed (Chainlink-compatible) | [`0x30F9ae10eB9F489Fe319c7aa7f501B096B1437Ab`](https://sepolia.basescan.org/address/0x30F9ae10eB9F489Fe319c7aa7f501B096B1437Ab) |

## The website

Static files, no build step: `index.html`, `assets/style.css`, `assets/app.js`. It reads live data from Base Sepolia,
has a wind simulator, and lets you use the faucet and staking with a browser wallet.
To publish with GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root.
