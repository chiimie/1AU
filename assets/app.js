/* Solar Sail (1AU) - dati letti da Base Sepolia, simulatore, faucet e staking.
   Lo stesso file serve le tre pagine: ogni parte parte solo se nella pagina ci sono i suoi elementi. */
(function () {
  'use strict';

  var CFG = {
    chainId: 84532,
    chainHex: '0x14a34',
    rpcs: ['https://base-sepolia-rpc.publicnode.com', 'https://sepolia.base.org'],
    explorer: 'https://sepolia.basescan.org',
    coin: '0x8b297faf7Dd374E2aB97e352E0dfF76bFEc2A057',
    helper: '0x42987FecE61dd1BC922d2C012F9315fA38c274a0',
    adapter: '0x30F9ae10eB9F489Fe319c7aa7f501B096B1437Ab',
    hub: '0xAe615eD3D342072Cc1Abd249aD87d6415079F51A',
    poolV2: '0xd5D8D3a58bF9B677ee332DAe917E9817CF7e657F',
    poolV3: '0x4598349e86B082625C5426C9Aa8653EBF1831454',
    airdrop: '0x0099f69fFe4A5d8950D24e452baDA49740bCf9df',
    logRounds: 21,
    faucetMinEth: 500000000000000n,
    faucetMaxClaims: 800n
  };
  var COIN_ABI = [
    'function epoch() view returns (uint256)', 'function speed() view returns (uint256)',
    'function totalSupply() view returns (uint256)', 'function balanceOf(address) view returns (uint256)',
    'function faucetAmount() view returns (uint256)', 'function faucetBalance() view returns (uint256)',
    'function stakingTotal() view returns (uint256)', 'function totalActive() view returns (uint256)',
    'function pendingNext() view returns (uint256)', 'function owed() view returns (uint256)',
    'function totalBurned() view returns (uint256)', 'function totalMinted() view returns (uint256)',
    'function lastUpdate() view returns (uint256)', 'function lastClaimEpoch(address) view returns (uint256)',
    'function claimsEpoch() view returns (uint256)', 'function claimsCount() view returns (uint256)',
    'function stakers(address) view returns (uint256 active, uint256 pending, uint256 leaving, uint256 debt, uint256 earned, uint64 pendingEpoch, uint64 leaveEpoch, uint64 stakeTime)',
    'function pendingRewards(address) view returns (uint256)',
    'function claimFaucet() returns (uint256)', 'function stake(uint256)', 'function requestUnstake(uint256)',
    'function withdraw()', 'function claimRewards() returns (uint256)'
  ];
  var ADAPTER_ABI = [
    'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)',
    'function getRoundData(uint80) view returns (uint80, int256, uint256, uint256, uint80)'
  ];
  var S = { speed: 0, supply: 0n, pool: 0n, owed: 0n, active: 0n, staked: 0n, epoch: 0n, lastUpdate: 0 };

  var $ = function (id) { return document.getElementById(id); };
  var has = function (id) { return !!$(id); };
  var tok = function (x) { return Number(x) / 1e18; };
  var compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 });
  var whole = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
  function fmt(x) { return compact.format(x); }
  function setText(id, t, title) { var e = $(id); if (!e) return; e.textContent = t; if (title) e.title = title; }
  function on(id, ev, fn) { var e = $(id); if (e) e.addEventListener(ev, fn); }

  /* ---------------- regole (come nel contratto) ---------------- */
  /* tempesta (oltre 600): burn = 3,6% x d / (d + 110) del pool V2;
     calma (sotto 600): si restituisce il debito (bruciati - coniati dal lancio): debito x [d / (d + 100)] / (0,601 x 90),
     diviso 60% pool, 30% staking, 10% detentori dopo il premio dello 0,5%. A 600 esatti non succede nulla. */
  function plan(speedKms, pool, owed, active) {
    var sp = Math.min(speedKms, 2000), p = tok(pool), o = tok(owed);
    if (sp > 600) {
      var x = sp - 600, rate = 0.036 * x / (x + 110);
      return { storm: true, rate: rate, burn: p * rate, bounty: p * rate * 0.005 };
    }
    var y = 600 - sp, m = Math.min(o, o * (y / (y + 100)) / (0.601 * 90)), rest = m * 0.995;
    return { storm: false, mint: m, share: o > 0 ? m / o : 0, pool: rest * 0.6, staking: active > 0n ? rest * 0.3 : 0,
             stakingIf: rest * 0.3, holders: rest * 0.1, bounty: m * 0.005, owed: o, stakedNow: active > 0n };
  }
  function stateOf(kms) { return kms > 600 ? 'storm' : kms >= 426 ? 'breeze' : 'calm'; }

  /* ---------------- rete ---------------- */
  var rpcIdx = 0, provider, coin, adapter;
  function connectRead() {
    provider = new ethers.JsonRpcProvider(CFG.rpcs[rpcIdx], CFG.chainId, { staticNetwork: true });
    coin = new ethers.Contract(CFG.coin, COIN_ABI, provider);
    adapter = new ethers.Contract(CFG.adapter, ADAPTER_ABI, provider);
  }
  async function withRetry(fn) {
    try { return await fn(); } catch (e) {
      rpcIdx = (rpcIdx + 1) % CFG.rpcs.length; connectRead();
      return fn();
    }
  }

  async function loadState() {
    var r = await withRetry(function () {
      return Promise.all([coin.epoch(), coin.speed(), coin.totalSupply(), coin.balanceOf(CFG.poolV2), coin.faucetAmount(),
        coin.stakingTotal(), coin.totalActive(), coin.owed(), coin.lastUpdate(), coin.pendingNext(),
        coin.claimsEpoch(), coin.claimsCount(), coin.faucetBalance()]);
    });
    S.epoch = r[0]; S.speed = Number(r[1]) / 10; S.supply = r[2]; S.pool = r[3];
    S.staked = r[5]; S.active = r[6]; S.lastUpdate = Number(r[8]); S.joining = r[9];
    S.owed = r[7];
    S.claimsToday = r[10] === r[0] ? r[11] : 0n;

    setText('speed', S.speed.toFixed(1));
    var st = stateOf(S.speed), el = $('state');
    if (el) { el.className = 'state ' + st; el.textContent = st === 'storm' ? 'Solar storm' : st === 'breeze' ? 'Fresh breeze' : 'Calm'; }
    if (has('gaugeFill')) $('gaugeFill').style.width = Math.max(2, Math.min(100, (S.speed - 250) / 7)) + '%';
    realStorm = S.speed > 600; applyWind();
    setText('sDay', String(S.epoch));
    setText('sSupply', fmt(tok(S.supply)), whole.format(tok(S.supply)) + ' 1AU');
    setText('sPool', fmt(tok(S.pool)), whole.format(tok(S.pool)) + ' 1AU');
    setText('sFaucet', whole.format(tok(r[4])));
    setText('fAmt', whole.format(tok(r[4])));
    setText('sFaucetGo', whole.format(tok(r[4])));
    setText('sStaked', fmt(tok(S.staked)));
    setText('sOwed', fmt(tok(S.owed)) + ' 1AU', whole.format(tok(S.owed)) + ' 1AU');
    setText('fSpeed', S.speed.toFixed(1) + ' km/s');
    setText('fClaims', String(S.claimsToday) + ' / 800');
    setText('fLeft', fmt(tok(r[12])) + ' 1AU');
    var p = plan(S.speed, S.pool, S.owed, S.active);
    setText('todayEffect', p.storm ? 'Storm: burn ' + (p.rate * 100).toFixed(2) + '% of pool' : p.mint > 0 ? 'Give back ' + fmt(p.mint) + ' 1AU' : 'Calm, nothing owed yet');
    stakingStats();
    simulate();
  }

  /* statistiche della pagina staking: quanto prende lo staking in un giorno tipico e per ogni 1AU */
  function stakingStats() {
    if (!has('kActive')) return;
    setText('kActive', fmt(tok(S.active)) + ' 1AU');
    setText('kJoining', fmt(tok(S.joining || 0n)) + ' 1AU');
    var typical = plan(426, S.pool, S.owed, 1n);
    setText('kDaily', S.owed > 0n ? fmt(typical.staking) + ' 1AU' : 'None yet');
    if (S.owed === 0n) {
      setText('kPer', 'After the first storm');
      setText('kPerNote', 'nothing has been burned yet, so nothing is owed back');
    } else if (S.active > 0n) {
      var perMillion = typical.staking / tok(S.active) * 1e6;
      setText('kPer', whole.format(perMillion) + ' 1AU');
      setText('kPerNote', 'per 1,000,000 staked, on a typical 426 km/s day');
    } else {
      setText('kPer', 'All of it');
      setText('kPerNote', 'nobody is staking yet: the first staker takes the whole 30%');
    }
  }

  async function loadLog() {
    if (!has('bars')) return;
    var last = await withRetry(function () { return adapter.latestRoundData(); });
    var latest = Number(last[0]), from = Math.max(1, latest - CFG.logRounds + 1), ids = [];
    for (var i = from; i <= latest; i++) ids.push(i);
    var rows = await Promise.all(ids.map(function (id) {
      return adapter.getRoundData(id).then(function (x) { return { id: id, v: Number(x[1]) / 10, t: Number(x[3]) }; }).catch(function () { return null; });
    }));
    rows = rows.filter(Boolean);
    var box = $('bars'); box.textContent = '';
    var max = Math.max(700, Math.max.apply(null, rows.map(function (r) { return r.v; })) + 40);
    box.style.setProperty('--st', (600 / max * 100).toFixed(2));
    rows.forEach(function (r) {
      var b = document.createElement('div');
      b.className = 'bar ' + (r.v > 600 ? 'storm' : 'calm');
      b.style.height = (r.v / max * 100) + '%';
      b.title = new Date(r.t * 1000).toUTCString() + ' — ' + r.v.toFixed(1) + ' km/s';
      var s = document.createElement('span'); s.textContent = Math.round(r.v); b.appendChild(s);
      box.appendChild(b);
    });
    setText('logNote', rows.length + ' reading' + (rows.length === 1 ? '' : 's') + ' of SOLAR_WIND on Base so far. One bar per published round; the dashed line is the storm threshold.');
  }

  /* ---------------- conto alla rovescia alla prossima lettura (10:30 UTC) ---------------- */
  function tick() {
    var now = new Date(), next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 30));
    if (next <= now) next = new Date(next.getTime() + 86400000);
    var d = Math.floor((next - now) / 1000), h = Math.floor(d / 3600), m = Math.floor(d % 3600 / 60);
    var t = h + 'h ' + String(m).padStart(2, '0') + 'm';
    setText('countdown', t, 'Every day at 10:30 UTC');
    setText('fNext', t, 'Every day at 10:30 UTC');
    setText('kNext', t, 'Every day at 10:30 UTC');
  }

  /* ---------------- simulatore ---------------- */
  function simulate() {
    if (!has('simWind')) return;
    var v = Number($('simWind').value);
    $('simOut').textContent = v + ' km/s';
    if (!S.supply) return;
    var p = plan(v, S.pool, S.owed, S.active), out = $('simRes'), cells;
    if (p.storm) {
      cells = [
        ['Day type', 'Solar storm', 'no mint today', 'hl storm'],
        ['Burned from the V2 pool', fmt(p.burn) + ' 1AU', (p.rate * 100).toFixed(2) + '% of the pool', 'hl storm'],
        ['Pool price', '+' + ((1 / (1 - p.rate) - 1) * 100).toFixed(2) + '%', 'same ETH, fewer coins', ''],
        ['Owed back afterwards', fmt(p.owed + p.burn * 0.995) + ' 1AU', 'returned on calm days', '']
      ];
    } else if (p.owed === 0) {
      cells = [
        ['Day type', v === 600 ? 'Neutral' : 'Calm', 'no storm has burned anything yet', 'hl'],
        ['Given back', '0 1AU', 'nothing is owed', ''],
        ['Your balance', 'unchanged', 'wallets never burn', ''],
        ['Try', 'above 600 km/s', 'to see a storm', '']
      ];
    } else {
      cells = [
        ['Given back today', fmt(p.mint) + ' 1AU', (p.share * 100).toFixed(2) + '% of what is owed', 'hl'],
        ['To the V2 pool (60%)', fmt(p.pool) + ' 1AU', 'deepens the pool', ''],
        ['To stakers (30%)', fmt(p.stakingIf) + ' 1AU', p.stakedNow ? 'split by stake' : 'only when someone stakes', ''],
        ['To holders (10%)', fmt(p.holders) + ' 1AU', 'every wallet grows', '']
      ];
    }
    out.textContent = '';
    cells.forEach(function (c) {
      var d = document.createElement('div'); d.className = 'r ' + c[3];
      var a = document.createElement('span'); a.textContent = c[0];
      var b = document.createElement('b'); b.textContent = c[1];
      var s = document.createElement('small'); s.textContent = c[2];
      d.appendChild(a); d.appendChild(b); d.appendChild(s); out.appendChild(d);
    });
  }

  /* ---------------- indirizzi ---------------- */
  function addresses() {
    var ul = $('addrs'); if (!ul) return;
    var list = [['1AU coin', CFG.coin], ['Uniswap V2 pool (mint & burn)', CFG.poolV2], ['Uniswap V3 pool', CFG.poolV3],
      ['SOLAR_WIND feed (Chainlink-compatible)', CFG.adapter], ['Opsikom hub', CFG.hub], ['Publish-and-update helper', CFG.helper], ['Airdrop wallet', CFG.airdrop]];
    list.forEach(function (r) {
      var li = document.createElement('li'), s = document.createElement('span'), a = document.createElement('a');
      s.textContent = r[0]; a.href = CFG.explorer + '/address/' + r[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = r[1];
      li.appendChild(s); li.appendChild(a); ul.appendChild(li);
    });
  }

  /* ---------------- portafoglio (faucet e staking) ---------------- */
  var account = null, signerCoin = null, user = {};
  function msg(t, kind) { var m = $('wMsg'); if (!m) return; m.textContent = t || ''; m.className = 'msg' + (kind ? ' ' + kind : ''); }
  function short(a) { return a.slice(0, 6) + '…' + a.slice(-4); }
  function dis(id, v) { var e = $(id); if (e) e.disabled = v; }

  async function ensureChain() {
    var id = await window.ethereum.request({ method: 'eth_chainId' });
    if (parseInt(id, 16) === CFG.chainId) return;
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CFG.chainHex }] });
    } catch (e) {
      if (e && e.code === 4902) {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{
          chainId: CFG.chainHex, chainName: 'Base Sepolia', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://sepolia.base.org'], blockExplorerUrls: [CFG.explorer] }] });
      } else throw e;
    }
  }

  async function connect() {
    if (!window.ethereum) { msg('No wallet found. Install a browser wallet such as MetaMask or Coinbase Wallet.', 'err'); return; }
    try {
      var accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
      await ensureChain();
      account = ethers.getAddress(accs[0]);
      var bp = new ethers.BrowserProvider(window.ethereum);
      signerCoin = new ethers.Contract(CFG.coin, COIN_ABI, await bp.getSigner());
      setText('connect', 'Connected');
      setText('wAddr', short(account), account);
      msg('');
      await refreshUser();
    } catch (e) { msg(niceErr(e), 'err'); }
  }

  function when(ts) { return new Date(ts * 1000).toUTCString().replace(':00 GMT', ' UTC'); }

  async function refreshUser() {
    if (!account) return;
    var r = await withRetry(function () {
      return Promise.all([coin.balanceOf(account), provider.getBalance(account), coin.stakers(account), coin.pendingRewards(account),
        coin.lastClaimEpoch(account), coin.epoch(), coin.claimsEpoch(), coin.claimsCount(), coin.lastUpdate()]);
    });
    user = { bal: r[0], eth: r[1], st: r[2], rew: r[3], lastClaim: r[4], epoch: r[5], cEpoch: r[6], cCount: r[7], lastUpdate: Number(r[8]) };
    var st = user.st;
    setText('wBal', whole.format(tok(user.bal)));
    setText('wEth', (Number(user.eth) / 1e18).toFixed(5));
    setText('wEarning', whole.format(tok(st.active)));
    setText('wJoining', whole.format(tok(st.pending)));
    setText('wLeaving', whole.format(tok(st.leaving)));
    setText('wRew', whole.format(tok(user.rew)));

    // faucet
    if (has('claimFaucet')) {
      var today = user.cEpoch === user.epoch ? user.cCount : 0n;
      var claimed = user.epoch > 0n && user.lastClaim >= user.epoch;
      var canClaim = user.epoch > 0n && !claimed && today < CFG.faucetMaxClaims && user.eth >= CFG.faucetMinEth;
      dis('claimFaucet', !canClaim);
      setText('claimFaucet', claimed ? 'Claimed today — back after 10:30 UTC' : today >= CFG.faucetMaxClaims ? 'Sold out today — back after 10:30 UTC' : 'Claim today\'s 1AU');
      if (user.eth < CFG.faucetMinEth) msg('This wallet needs at least 0.0005 Base Sepolia ETH to use the faucet.');
    }

    // staking
    if (has('stakeBtn')) {
      dis('stakeBtn', user.bal === 0n);
      dis('unstakeBtn', st.active + st.pending === 0n);
      var unlocked = st.leaving > 0n && user.epoch > st.leaveEpoch && user.lastUpdate >= Number(st.stakeTime) + 86400;
      dis('withdrawBtn', !unlocked);
      setText('withdrawBtn', st.leaving > 0n && !unlocked ? 'Unlocks at a later update' : 'Withdraw');
      dis('claimBtn', user.rew === 0n);
      var info = '';
      if (st.pending > 0n) info += 'Your new stake starts earning at the second daily update after you joined. ';
      if (st.leaving > 0n) info += unlocked ? 'Your coins are unlocked: you can withdraw them now. '
        : 'Leaving coins unlock at the first daily update after ' + when(Number(st.stakeTime) + 86400) + '. ';
      setText('wInfo', info);
      if (user.eth === 0n) msg('This wallet needs a little Base Sepolia ETH for gas.');
    }
  }

  function amountOr(fallback) {
    var v = ($('stakeAmt') ? $('stakeAmt').value : '').replace(/,/g, '').trim();
    if (!v) return fallback;
    try { return ethers.parseUnits(v, 18); } catch (e) { return null; }
  }

  async function send(label, fn) {
    if (!signerCoin) return connect();
    try {
      await ensureChain();
      msg(label + ': confirm in your wallet…');
      var tx = await fn();
      msg(label + ': waiting for Base…');
      await tx.wait();
      msg(label + ' done.', 'ok');
      await Promise.all([refreshUser(), loadState()]);
    } catch (e) { msg(niceErr(e), 'err'); }
  }

  function niceErr(e) {
    var t = (e && (e.reason || e.shortMessage || e.message)) || 'Something went wrong';
    if (/user rejected|denied/i.test(t)) return 'Request cancelled in the wallet.';
    if (/wallets only/i.test(t)) return 'The faucet works from a regular wallet (EOA), not from a smart-contract wallet.';
    return t.replace(/^execution reverted:?\s*/i, '').replace(/^1AU: /, '');
  }

  function bindWallet() {
    on('connect', 'click', connect);
    on('claimFaucet', 'click', function () { send('Faucet', function () { return signerCoin.claimFaucet(); }); });
    on('stakeMax', 'click', function () { if (user.bal) $('stakeAmt').value = ethers.formatUnits(user.bal, 18); });
    on('stakeBtn', 'click', function () {
      var a = amountOr(user.bal);
      if (!a || a <= 0n) return msg('Enter an amount to stake.', 'err');
      send('Stake', function () { return signerCoin.stake(a); });
    });
    on('unstakeBtn', 'click', function () {
      var a = amountOr(user.st ? user.st.active + user.st.pending : 0n);
      if (!a || a <= 0n) return msg('Enter an amount.', 'err');
      send('Leave request', function () { return signerCoin.requestUnstake(a); });
    });
    on('withdrawBtn', 'click', function () { send('Withdraw', function () { return signerCoin.withdraw(); }); });
    on('claimBtn', 'click', function () { send('Claim rewards', function () { return signerCoin.claimRewards(); }); });
    on('addToken', 'click', function () {
      if (!window.ethereum) return msg('No wallet found.', 'err');
      window.ethereum.request({ method: 'wallet_watchAsset', params: { type: 'ERC20', options: { address: CFG.coin, symbol: '1AU', decimals: 18 } } })
        .catch(function (e) { msg(niceErr(e), 'err'); });
    });
    if (window.ethereum && window.ethereum.on) {
      window.ethereum.on('accountsChanged', function () { if (account) connect(); });
      window.ethereum.on('chainChanged', function () { if (account) refreshUser(); });
    }
  }

  /* ---------------- vento solare (animazione) ----------------
     Calma: strisce dorate che vanno alla velocita' del vento reale.
     Tempesta (vera, o mostrata col pulsante): brillamento sul bordo del Sole, una nube di plasma (espulsione di massa
     coronale) che parte dal Sole e attraversa lo schermo gonfiandosi, con il fronte sfrangiato, e particelle rosse veloci. */
  var windFactor = 1, realStorm = false, preview = false, stormOn = false;
  function applyWind() {
    stormOn = realStorm || preview;
    windFactor = stormOn ? Math.max(760, S.speed || 0) / 426 : Math.max(0.4, (S.speed || 426) / 426);
    var hero = document.querySelector('.hero'); if (hero) hero.classList.toggle('stormy', stormOn);
    var b = $('stormBtn');
    if (b) {
      b.hidden = realStorm;
      b.textContent = preview ? 'Back to today\'s wind' : 'See what a solar storm looks like';
      b.setAttribute('aria-pressed', preview ? 'true' : 'false');
    }
    setText('stormNote', realStorm ? 'A solar storm is blowing right now: the Sun has thrown out a cloud of plasma and the coin burns from the pool.'
      : preview ? 'Example at 760 km/s: a flare on the Sun and a cloud of plasma racing towards Earth.' : '');
  }
  function isLight() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'light';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  }
  function windCanvas() {
    var c = $('wind'); if (!c) return;
    var ctx = c.getContext('2d'), parts = [], W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var cme = null, nextCme = 0, flare = 0, clock = 0;
    function size() {
      W = c.clientWidth; H = c.clientHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(320, W * H / 4200));
      parts = []; for (var i = 0; i < n; i++) parts.push(seed({}, true));
    }
    function seed(p, any) {
      p.x = any ? Math.random() * W : -20 - Math.random() * 100;
      p.y = H * (0.5 + (Math.random() - 0.5) * 1.1);
      p.v = 0.6 + Math.random() * 1.8; p.len = 14 + Math.random() * 60; p.a = 0.18 + Math.random() * 0.5;
      p.w = Math.random() < 0.18 ? 1.8 : 1; p.drift = (Math.random() - 0.5) * 0.12;
      return p;
    }
    /* nube di plasma: un guscio di filamenti che si allarga dal centro del Sole (a sinistra, a meta' altezza) */
    function newCme() {
      var fil = [];
      for (var i = 0; i < 150; i++) fil.push({ a: (Math.random() - 0.5) * 1.5, d: Math.random(), w: 0.6 + Math.random() * 2.2,
        k: Math.random() * 6.28, len: 0.04 + Math.random() * 0.12 });
      return { r: Math.max(240, W * 0.12), fil: fil, born: clock };
    }
    function drawSunFlare(sx, sy, power) {
      if (power <= 0) return;
      var R = 70 + 90 * power, g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
      g.addColorStop(0, 'rgba(255,255,255,' + (0.95 * power) + ')');
      g.addColorStop(0.35, 'rgba(255,236,170,' + (0.7 * power) + ')');
      g.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, R, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(255,248,220,' + (0.8 * power) + ')'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(sx + 18, sy - 6, 26 + 16 * (1 - power), Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    }
    function drawCme(o, light) {
      var cx = 0, cy = H * 0.5, life = (clock - o.born) / 6000;
      if (life > 1) return false;
      o.r = Math.max(240, W * 0.12) + life * (W + 260);
      var fade = life < 0.08 ? life / 0.08 : life > 0.8 ? (1 - life) / 0.2 : 1;
      // alone diffuso dietro il fronte
      var halo = ctx.createRadialGradient(cx, cy, o.r * 0.55, cx, cy, o.r * 1.04);
      halo.addColorStop(0, 'rgba(255,170,90,0)');
      halo.addColorStop(0.75, (light ? 'rgba(255,140,60,' : 'rgba(255,190,110,') + (0.16 * fade) + ')');
      halo.addColorStop(1, 'rgba(229,48,74,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, o.r * 1.04, -0.85, 0.85); ctx.lineTo(cx, cy); ctx.fill();
      // filamenti del fronte, sfrangiati e turbolenti
      for (var i = 0; i < o.fil.length; i++) {
        var f = o.fil[i], ang = f.a + Math.sin(clock / 700 + f.k) * 0.02;
        var rr = o.r * (0.9 + 0.1 * f.d) + Math.sin(f.k + clock / 300 + f.a * 9) * 12;
        var x1 = cx + Math.cos(ang) * rr, y1 = cy + Math.sin(ang) * rr * 1.15;
        var x0 = cx + Math.cos(ang) * rr * (1 - f.len), y0 = cy + Math.sin(ang) * rr * (1 - f.len) * 1.15;
        var hot = f.d > 0.55;
        var g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, 'rgba(255,220,160,0)');
        g.addColorStop(0.7, (hot ? (light ? 'rgba(255,120,40,' : 'rgba(255,250,235,') : 'rgba(255,160,80,') + (0.85 * fade) + ')');
        g.addColorStop(1, 'rgba(229,48,74,' + (0.7 * fade) + ')');
        ctx.strokeStyle = g; ctx.lineWidth = f.w;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + Math.sin(f.k + clock / 250) * 6, (y0 + y1) / 2, x1, y1); ctx.stroke();
      }
      return true;
    }
    var running = true, last = 0;
    function frame(t) {
      if (!running) return;
      var dt = Math.min(48, t - last || 16) / 16; last = t; clock += dt * 16;
      ctx.clearRect(0, 0, W, H);
      var light = isLight();
      if (stormOn) {
        if (!cme && clock >= nextCme) { cme = newCme(); flare = 1; nextCme = clock + 6600; }
        if (cme && !drawCme(cme, light)) cme = null;
        if (flare > 0) { drawSunFlare(Math.min(250, W * 0.18), H * 0.5, flare); flare = Math.max(0, flare - 0.012 * dt); }
      } else { cme = null; flare = 0; nextCme = clock + 400; }
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i], f = windFactor;
        p.x += p.v * f * 2.2 * dt; p.y += p.drift * dt + (stormOn ? Math.sin(clock / 400 + p.v * 9) * 0.25 : 0);
        if (p.x - p.len > W) seed(p, false);
        var g = ctx.createLinearGradient(p.x - p.len * f, p.y, p.x, p.y);
        g.addColorStop(0, 'rgba(255,200,120,0)');
        g.addColorStop(1, stormOn ? 'rgba(255,' + (light ? 70 : 110) + ',120,' + p.a + ')' : light ? 'rgba(214,128,20,' + p.a + ')' : 'rgba(255,214,150,' + p.a + ')');
        ctx.strokeStyle = g; ctx.lineWidth = p.w;
        ctx.beginPath(); ctx.moveTo(p.x - p.len * f, p.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      requestAnimationFrame(frame);
    }
    size(); window.addEventListener('resize', size);
    if (reduce) { frame(0); running = false; return; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { var was = running; running = e.isIntersecting; if (running && !was) requestAnimationFrame(frame); });
      }).observe(c);
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- tema chiaro / scuro ---------------- */
  function theme() {
    var b = $('themeBtn'); if (!b) return;
    function label() { b.setAttribute('aria-label', isLight() ? 'Switch to dark' : 'Switch to light'); }
    b.addEventListener('click', function () {
      var next = isLight() ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('1au-theme', next); } catch (e) {}
      label();
    });
    label();
  }
  function stormButton() {
    var b = $('stormBtn'); if (!b) return;
    b.addEventListener('click', function () { preview = !preview; applyWind(); });
  }

  function reveal() {
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .08 });
    document.querySelectorAll('.head,.stat,.rule,.facts div,.sim,.alloc,.tok-copy,.go,.addrs,.faq details,.log,.step,.panel').forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  }

  /* ---------------- avvio ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    windCanvas(); tick(); setInterval(tick, 30000); addresses(); reveal(); theme(); stormButton();
    on('simWind', 'input', simulate);
    if (!window.ethers) { setText('state', 'offline'); return; }
    connectRead(); bindWallet();
    loadState().catch(function () { setText('state', 'no data'); });
    loadLog().catch(function () { setText('logNote', 'Could not read the wind log right now.'); });
    setInterval(function () { loadState().catch(function () {}); if (account) refreshUser().catch(function () {}); }, 60000);
  });
})();
