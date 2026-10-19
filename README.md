# Solar Sail (1AU)

A meme coin on Base that moves with the real solar wind.

Every day at 10:30 UTC the 24-hour mean speed of the solar wind (NOAA SWPC, spacecraft at L1) is signed by four
independent [Opsikom](https://opsikom.com) operators and published on chain. The coin updates in the same transaction:

- **Above 600 km/s: storm.** Coins are burned from the Uniswap V2 pool: 3.6% × d ÷ (d + 110 km/s), where d is how far the wind is above 600 (700 km/s: 1.71%).
- **Below 600 km/s: give back.** Calm days return what storms burned, counted from launch: the calmer the wind, the bigger the share (426 km/s: 1.17% of what is owed), split 60% V2 pool, 30% stakers, 10% holders.
- Minted can never exceed burned, so the supply never grows past launch.
- Wallet balances never go down. No trading fees. No team allocation.

Supply: **149,597,870,700 1AU**, the distance from the Earth to the Sun in metres.

## Test network

Everything runs on **Base Sepolia** (chain ID 84532). Test coins have no value. The contract is a draft and has not been audited.

| Contract | Address |
|---|---|
| 1AU coin | [`0x8b297faf7Dd374E2aB97e352E0dfF76bFEc2A057`](https://sepolia.basescan.org/address/0x8b297faf7Dd374E2aB97e352E0dfF76bFEc2A057) |
| Uniswap V2 pool | [`0xd5D8D3a58bF9B677ee332DAe917E9817CF7e657F`](https://sepolia.basescan.org/address/0xd5D8D3a58bF9B677ee332DAe917E9817CF7e657F) |
| Uniswap V3 pool | [`0x4598349e86B082625C5426C9Aa8653EBF1831454`](https://sepolia.basescan.org/address/0x4598349e86B082625C5426C9Aa8653EBF1831454) |
| SOLAR_WIND feed (Chainlink-compatible) | [`0x30F9ae10eB9F489Fe319c7aa7f501B096B1437Ab`](https://sepolia.basescan.org/address/0x30F9ae10eB9F489Fe319c7aa7f501B096B1437Ab) |

## The website

Static files, no build step: `index.html`, `assets/style.css`, `assets/app.js`. It reads live data from Base Sepolia,
has a wind simulator, and lets you use the faucet and staking with a browser wallet.
To publish with GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root.
