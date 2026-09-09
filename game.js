// ===================== SIEGE DUEL (local hotseat or online, dual view) =====================

const GRID_COLS = 15, GRID_ROWS = 9;
// Each battlefield theme has its own path layout, not just a different palette.
const MAP_WAYPOINTS = {
  warzone: [ [0,1],[11,1],[11,4],[3,4],[3,7],[14,7] ],
  winter:  [ [0,7],[11,7],[11,4],[3,4],[3,1],[14,1] ],
  desert:  [ [14,1],[3,1],[3,4],[11,4],[11,7],[0,7] ],
  forest:  [ [0,1],[6,1],[6,7],[9,7],[9,1],[14,1] ],
};
let WAYPOINTS = MAP_WAYPOINTS.warzone;
const MATCH_SECONDS = 360;
const DEFENSE_START_COINS = 200;
const OFFENSE_START_COINS = 100;
const OFFENSE_TRICKLE_PER_SEC = 3.0;
const DEFENSE_TRICKLE_PER_SEC = 5.9;
const MAX_LIVES = 100;

const TOWER_TYPES = {
  machinegun: { key:'machinegun', name:'Machine Gun', cost:50, hp:108, range:2.3, fireRate:5.5, damage:5, splash:0, slow:0, color:'#66ccff', dark:'#2d6f8f', projSpeed:16, desc:'Rapid fire, low damage per shot — great value against weak swarms. Upgrades add Double Shot, then Critical Hits.',
    abilities:[ {}, {doubleShot:true}, {doubleShot:true, critChance:0.25, critMult:3} ] },
  cannon: { key:'cannon', name:'Cannon', cost:85, hp:185, range:2.6, fireRate:1.0, damage:29, splash:1.1, slow:0, color:'#ffaa33', dark:'#8a5a1a', projSpeed:9, desc:'Splash damage hits multiple clustered enemies. Upgrades add Knockback, then Cluster Shrapnel.',
    abilities:[ {}, {knockback:0.35}, {knockback:0.35, clusterCount:3, clusterFrac:0.35} ] },
  sniper: { key:'sniper', name:'Sniper', cost:130, hp:280, range:4.6, fireRate:0.65, damage:72, splash:0, slow:0, piercesShield:true, color:'#dd3355', dark:'#7a1f30', projSpeed:26, desc:'Huge single-target damage and ignores enemy shields entirely. Upgrades add instant reload on kill, then Pierce.',
    abilities:[ {}, {headshotRefund:true}, {headshotRefund:true, pierceFrac:0.5} ] },
  rocket: { key:'rocket', name:'Rocket', cost:160, hp:345, range:3.0, fireRate:0.55, damage:50, splash:1.7, slow:0, color:'#ff5522', dark:'#8a2f12', projSpeed:7.5, desc:'Heavy splash damage, best against groups. Upgrades add a burning DoT, then a bigger blast that stuns.',
    abilities:[ {}, {burnFrac:0.25, burnDuration:3}, {burnFrac:0.25, burnDuration:3, carpetMult:1.6, stunDuration:0.4} ] },
  frost: { key:'frost', name:'Frost Ray', cost:75, hp:162, range:2.5, fireRate:1.6, damage:4, splash:0, slow:0.5, slowDur:1.6, color:'#7ff5ee', dark:'#2f7a75', projSpeed:18, desc:'Low damage, but slows anything it hits. Upgrades add a periodic AoE slow pulse, then a chance to fully freeze.',
    abilities:[ {}, {nova:true, novaInterval:3, novaSlow:0.35, novaDuration:1.2}, {nova:true, novaInterval:3, novaSlow:0.35, novaDuration:1.2, freezeChance:0.22, freezeDuration:1.0} ] },
  tesla: { key:'tesla', name:'Tesla Coil', cost:145, hp:315, range:2.8, fireRate:1.2, damage:19, splash:0, slow:0, chain:3, chainRadius:1.9, color:'#c9a8ff', dark:'#5b3a8a', projSpeed:30, desc:'Lightning arcs between nearby enemies, hitting several at once. Upgrades widen the chain, then add Overload bursts.',
    abilities:[ {}, {extraChain:2, extraChainRadius:0.4}, {extraChain:2, extraChainRadius:0.4, overloadEvery:4, overloadMult:2.5} ] },
  flamethrower: { key:'flamethrower', name:'Flamethrower', cost:100, hp:216, range:1.7, fireRate:0, damage:11, splash:0, slow:0, isAura:true, color:'#ff8844', dark:'#8a3a18', desc:'Continuously damages everything in its short range. Upgrades add a lingering burn, then Ignite Spread on kill.',
    abilities:[ {}, {auraBurnOnExit:true, burnDuration:2}, {auraBurnOnExit:true, burnDuration:2, igniteSpread:true, igniteRadius:1.3} ] },
  artillery: { key:'artillery', name:'Artillery', cost:180, hp:390, range:5.0, fireRate:0.35, damage:84, splash:1.0, slow:0, color:'#98a84a', dark:'#3a4a1a', projSpeed:8, desc:'Very slow, very long range, devastating splash. Upgrades add a second shell, then a huge burning blast.',
    abilities:[ {}, {doubleBarrage:true}, {doubleBarrage:true, carpetMult:1.8, carpetBurn:true} ] },
  poison: { key:'poison', name:'Toxic Turret', cost:95, hp:205, range:2.4, fireRate:1.3, damage:4, splash:0, slow:0, color:'#8fdd3a', dark:'#3f6b1a', projSpeed:14, desc:'Applies a lingering poison DoT. Upgrades spread it to nearby enemies, then add stacking poison + a death cloud.',
    poisonDps:7, poisonDuration:3,
    abilities:[ {}, {poisonSpreadRadius:1.2}, {poisonSpreadRadius:1.2, poisonStack:true, killCloud:true} ] },
};
const LEVEL_MULT = [ {dmg:1,range:1,rate:1,cost:1}, {dmg:1.7,range:1.12,rate:1.2,cost:1.25}, {dmg:2.6,range:1.25,rate:1.4,cost:2.0} ];
// Shared "leveled up" look: a colored glow ring + slight size bump, so towers, monsters, and the
// Commander all visibly change in the same language as they gain levels.
function tierGlowColor(level, maxLevel){
  if(level>=maxLevel) return '#ffd23f';
  if(level>1) return '#9fc6ff';
  return null;
}
function drawTierRing(cx, cy, radius, color){
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,radius,0,Math.PI*2);
  ctx.strokeStyle=color; ctx.lineWidth=2.5; ctx.globalAlpha=0.85; ctx.stroke();
  ctx.globalAlpha=0.25; ctx.lineWidth=5; ctx.stroke();
  ctx.restore();
}
// The sprite itself gets recolored and starts glowing as it levels up, so an upgraded unit
// actually looks different at a glance, not just "has a ring around it".
function tierSpriteFilter(level, maxLevel){
  if(level>=maxLevel) return 'saturate(1.8) brightness(1.3) hue-rotate(20deg) drop-shadow(0 0 7px #ffd23f) drop-shadow(0 0 3px #fff3c0)';
  if(level>1) return 'saturate(1.4) brightness(1.18) hue-rotate(-14deg) drop-shadow(0 0 6px #9fc6ff)';
  return 'none';
}

const TOWER_ATTACK_RANGE = 1.3;
const ENEMY_TYPES = {
  grunt:    { name:'Grunt', hp:52, speed:1.55, livesLost:5, cost:10, endBonus:15, towerDps:13, color:'#8bcf5a', dark:'#3f6b28',
    desc:'Balanced all-rounder with no special tricks.' },
  runner:   { name:'Runner', hp:27, speed:3.4, livesLost:3, cost:10, endBonus:15, towerDps:8, color:'#ffdd55', dark:'#8a7a1f',
    desc:'Very fast but fragile — rushes past slow defenses.' },
  tank:     { name:'Tank', hp:185, speed:1.05, livesLost:12, cost:30, endBonus:30, towerDps:33, color:'#a9713f', dark:'#5a3c1f',
    slamDamage:28, slamInterval:3, slamRadius:1.5,
    desc:'Tough, and considerably faster than it looks. Periodically slams the nearest tower for a burst of bonus damage.' },
  juggernaut: { name:'Juggernaut', hp:340, speed:0.5, livesLost:20, cost:130, endBonus:40, towerDps:28, color:'#8a95a3', dark:'#3a3f47',
    slamDamage:26, slamInterval:4.5, slamRadius:1.8,
    desc:'A rung above Tank — serious health and a heavier slam, but slow to arrive.' },
  shield:   { name:'Shield Bot', hp:68, shieldHp:55, speed:1.2, livesLost:6, cost:30, endBonus:15, towerDps:17, color:'#5599dd', dark:'#274a70',
    desc:'Has a shield that must be fully depleted before its real health takes damage. Snipers ignore shields entirely.' },
  healer:   { name:'Medic Bot', hp:62, speed:1.4, livesLost:5, cost:40, endBonus:15, towerDps:11, color:'#55dd88', dark:'#1f7a44', healRadius:2.2, healPct:0.06, healInterval:1.4,
    desc:'Heals nearby monsters over time. A priority target for defense.' },
  bomber:   { name:'Bomber', hp:80, speed:1.9, livesLost:18, cost:20, endBonus:45, towerDps:23, color:'#ff6644', dark:'#8a2f18',
    explodeDamage:55, explodeRadius:1.8,
    desc:'Explodes on death, dealing a big burst of damage to all nearby towers.' },
  splitter: { name:'Splitter', hp:72, speed:1.45, livesLost:6, cost:30, endBonus:15, towerDps:14, color:'#cc66ff', dark:'#5a2680', splitInto:'splitling', splitCount:2,
    desc:'Splits into two Splitlings when destroyed, doubling the trouble.' },
  splitling:{ name:'Splitling', hp:22, speed:2.2, livesLost:3, cost:0, endBonus:15, towerDps:8, color:'#e2aaff', dark:'#5a2680',
    desc:'A fragile fragment left behind by a destroyed Splitter.' },
  broodcarrier: { name:'Brood Carrier', hp:95, speed:1.15, livesLost:10, cost:60, endBonus:20, towerDps:12, color:'#8a7a3a', dark:'#3a3018', splitInto:'grunt', splitCount:3,
    desc:'A tough carrier that bursts into 3 Grunts when destroyed — kill it fast before it multiplies.' },
  ravager:  { name:'Ravager', hp:410, speed:1.15, livesLost:22, cost:109, endBonus:45, towerDps:55, color:'#7a3fb0', dark:'#2a1040',
    desc:'Faster and hits harder than Juggernaut, with no slam — a mobile heavy threat that closes in fast.' },
  warlord:  { name:'The Warlord', hp:1500, speed:0.6, livesLost:30, cost:200, endBonus:60, towerDps:38, isBoss:true, reinforceInterval:6.5, color:'#a3242e', dark:'#3a0d0d',
    slamDamage:40, slamInterval:4.5, slamRadius:2.2,
    desc:'Boss-tier HP, periodic tower slams, and occasional Grunt reinforcements.' },
};
const MONSTER_SHOP = ['grunt','runner','tank','shield','bomber','splitter','broodcarrier','juggernaut'];
// Monster type upgrades: a one-time purchase that permanently boosts every future spawn of that
// type for the rest of the match (mirrors how tower upgrades work, but applies to the whole type
// instead of one placed tower). Kept modest so a maxed-out monster type doesn't outweigh a maxed tower.
const MONSTER_LEVEL_MULT = [ {hp:1, dmg:1, speed:1}, {hp:1.25, dmg:1.55, speed:1.05}, {hp:1.5, dmg:2.1, speed:1.1} ];
const MONSTER_UPGRADE_COST_MULT = [null, 3.5, 6];
function monsterUpgradeCost(key){
  const lvl = monsterLevels[key]||1;
  if(lvl>=3) return null;
  return Math.round(ENEMY_TYPES[key].cost * MONSTER_UPGRADE_COST_MULT[lvl]);
}

const ABILITIES = {
  overclock: { key:'overclock', name:'Overclock', desc:'+60% speed, 4s', cost:30 },
  medic: { key:'medic', name:'Field Medic', desc:'Heal your monsters', cost:40 },
  nuke: { key:'nuke', name:'Nuclear Bomb', desc:'Free, one-time use per match. Instantly kills every monster and your Commander on the field, and blasts every tower for 50% of its max HP (towers already below half health are destroyed outright).', cost:0 },
};
const DEFENSE_ABILITIES = {
  medic: { key:'medic', name:'Field Medic', desc:'Heal your towers', cost:40 },
  nuke: { key:'nuke', name:'Nuclear Bomb', desc:'Free, one-time use per match. Instantly kills every monster and the enemy Commander on the field, and blasts every one of your towers for 50% of its max HP (towers already below half health are destroyed outright).', cost:0 },
};

const COMMANDER_BASE = { hp:220, damage:29, fireRate:1.15, range:2.0, speed:2.0, respawnTime:12, xpPerLevel:170, maxLevel:4 };
// Kept off every map's path and away from the corner — a cramped bottom-left corner spawn was
// hard to reach/tap on small/tablet screens (verified clear of all 4 battlefield paths).
const COMMANDER_HOME_CELL = [2, 5];

// ===================== AUDIO =====================
let muted = false;
// Several tracks that rotate so the battle music doesn't feel like the same loop the whole match.
const MUSIC_TRACKS = ['assets/music_battle.mp3','assets/music_battle2.mp3','assets/music_battle3.mp3'].map(src=>{
  const a = new Audio(src); a.volume = 0.32; return a;
});
let currentMusicIdx = 0;
MUSIC_TRACKS.forEach((a,i)=>{
  a.addEventListener('ended', ()=>{
    if(phase!=='playing') return;
    let next = i;
    if(MUSIC_TRACKS.length>1) while(next===i) next = Math.floor(Math.random()*MUSIC_TRACKS.length);
    currentMusicIdx = next;
    const na = MUSIC_TRACKS[next]; na.currentTime = 0; na.muted = muted; na.play().catch(()=>{});
  });
});
const sfxExplosionAudio = new Audio('assets/sfx_explosion.mp3'); sfxExplosionAudio.volume = 0.5;
const sfxVictoryAudio = new Audio('assets/sfx_victory.mp3'); sfxVictoryAudio.volume = 0.6;
const sfxDefeatAudio = new Audio('assets/sfx_defeat.mp3'); sfxDefeatAudio.volume = 0.6;
function playSample(a){ if(muted) return; try{ a.currentTime = 0; a.play().catch(()=>{}); }catch(e){} }
function playMusic(){
  MUSIC_TRACKS.forEach(a=>a.pause());
  currentMusicIdx = Math.floor(Math.random()*MUSIC_TRACKS.length);
  const a = MUSIC_TRACKS[currentMusicIdx];
  a.currentTime = 0; a.muted = muted; a.play().catch(()=>{});
}
function stopMusic(){ MUSIC_TRACKS.forEach(a=>a.pause()); }
// Toggling mute hard-mutes every <audio> element directly AND zeroes a master gain node that
// every gun/monster/commander sound routes through. Zeroing gain (rather than relying solely on
// AudioContext.suspend/resume) is bulletproof across browsers — suspend/resume timing has known
// quirks on some mobile Safari versions, but a GainNode's value takes effect immediately no
// matter what state the context is in.
function setMuted(m){
  muted = m;
  MUSIC_TRACKS.forEach(a=> a.muted = m);
  sfxExplosionAudio.muted = m; sfxVictoryAudio.muted = m; sfxDefeatAudio.muted = m;
  masterGain.gain.value = m ? 0 : 1;
  if(m){ if(actx.state==='running') actx.suspend(); }
  else if(actx.state==='suspended') actx.resume();
}

const actx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = actx.createGain(); masterGain.gain.value = 1; masterGain.connect(actx.destination);
function beep(freq, dur, type, vol, sweepTo){
  if(muted) return;
  const osc = actx.createOscillator(); const gain = actx.createGain();
  osc.type = type||'square'; osc.frequency.setValueAtTime(freq, actx.currentTime);
  if(sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, actx.currentTime+dur);
  gain.gain.setValueAtTime(vol||0.12, actx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime+dur);
  osc.connect(gain); gain.connect(masterGain);
  osc.start(); osc.stop(actx.currentTime+dur);
}
const sfxBuffers = {};
function loadSfxBuffer(name, path){
  fetch(path).then(r=>r.arrayBuffer()).then(buf=>actx.decodeAudioData(buf)).then(decoded=>{ sfxBuffers[name]=decoded; }).catch(()=>{});
}
function playBuffer(name, vol, rate){
  if(muted) return;
  const buf = sfxBuffers[name]; if(!buf) return;
  const src = actx.createBufferSource(); src.buffer = buf;
  src.playbackRate.value = rate || 1;
  const gain = actx.createGain(); gain.gain.value = vol!=null ? vol : 0.5;
  src.connect(gain); gain.connect(masterGain);
  src.start();
}
['gun_rapid','gun_cannon','gun_laser','gun_rocket','gun_electric','gun_fire','gun_toxic','gun_ice','monster_growl_small','monster_growl_heavy','monster_boss_roar','monster_soft','monster_hiss','commander_attack','commander_hurt','commander_respawn'].forEach(n=>loadSfxBuffer(n, `assets/sfx_${n}.mp3`));
const TOWER_FIRE_SFX = {
  machinegun: ()=>playBuffer('gun_rapid', 0.35, 0.95+Math.random()*0.1),
  cannon: ()=>playBuffer('gun_cannon', 0.5),
  sniper: ()=>playBuffer('gun_laser', 0.45, 1.1),
  rocket: ()=>playBuffer('gun_rocket', 0.5),
  frost: ()=>playBuffer('gun_ice', 0.4),
  tesla: ()=>playBuffer('gun_electric', 0.4),
  flamethrower: ()=>playBuffer('gun_fire', 0.3),
  artillery: ()=>playBuffer('gun_cannon', 0.55, 0.75),
  poison: ()=>playBuffer('gun_toxic', 0.4),
};
function sfxHit(dmg){ (dmg>=15?beep(110,0.14,'sawtooth',0.14):beep(260,0.06,'square',0.09)); }
function sfxEnemyDeath(){ beep(340,0.08,'square',0.1,120); }
function sfxPlace(){ beep(500,0.06,'sine',0.12); setTimeout(()=>beep(760,0.08,'sine',0.12),50); }
function sfxUpgrade(){ [520,660,880].forEach((f,i)=>setTimeout(()=>beep(f,0.09,'sine',0.12),i*60)); }
function sfxSell(){ beep(500,0.1,'sine',0.1,260); }
function sfxDestroyed(){ playSample(sfxExplosionAudio); }
function sfxCoin(){ beep(1500,0.05,'sine',0.06); setTimeout(()=>beep(1900,0.05,'sine',0.05),40); }
function sfxCommanderFire(){ playBuffer('commander_attack', 0.35, 0.95+Math.random()*0.1); }
function sfxCommanderDown(){ playBuffer('commander_hurt', 0.5); }
function sfxCommanderRespawn(){ playBuffer('commander_respawn', 0.5); }
function sfxLevelUp(){ [660,880,1100,1320].forEach((f,i)=>setTimeout(()=>beep(f,0.1,'sine',0.14),i*70)); }
function sfxSlam(){ beep(130,0.24,'sawtooth',0.19,55); }
const MONSTER_SPAWN_SFX = {
  grunt: ()=>playBuffer('monster_growl_small', 0.4, 1.0),
  runner: ()=>playBuffer('monster_growl_small', 0.35, 1.3),
  tank: ()=>playBuffer('monster_growl_heavy', 0.45, 0.85),
  juggernaut: ()=>playBuffer('monster_growl_heavy', 0.5, 0.9),
  shield: ()=>playBuffer('monster_growl_small', 0.4, 0.9),
  healer: ()=>playBuffer('monster_soft', 0.4, 1.0),
  bomber: ()=>playBuffer('monster_hiss', 0.4, 1.0),
  splitter: ()=>playBuffer('monster_growl_small', 0.35, 1.2),
  broodcarrier: ()=>playBuffer('monster_growl_heavy', 0.4, 1.1),
  ravager: ()=>playBuffer('monster_growl_heavy', 0.45, 1.25),
  warlord: ()=>playBuffer('monster_boss_roar', 0.55, 1.0),
};

// ===================== SPRITES =====================
const imgCache = {};
function loadImg(path){ if(!imgCache[path]){ const i = new Image(); i.src = path; imgCache[path] = i; } return imgCache[path]; }
Object.keys(TOWER_TYPES).forEach(k=> loadImg(`assets/${k}.png`));
Object.keys(ENEMY_TYPES).forEach(k=> loadImg(`assets/${k}.png`));
loadImg('assets/commander.png');

// ===================== STATE =====================
let defenseCoins = DEFENSE_START_COINS, offenseCoins = OFFENSE_START_COINS, lives = MAX_LIVES, timeLeft = MATCH_SECONDS;
let phase = 'idle';
let winner = null, winReason = null;
let towers = [], enemies = [], projectiles = [], effects = [];
let selectedTowerType = null, selectedTowerId = null;
let commander = null;
let commanderSelected = false;
let overclockTimer = 0;
let nukeUsed = false;
let defenseNukeUsed = false;
let nukeFallTimer = 0; // counts down while the bomb-drop animation plays; detonates at 0
const NUKE_FALL_DURATION = 0.85;
let monsterLevels = {};
Object.keys(ENEMY_TYPES).forEach(k=> monsterLevels[k]=1);
let pathCellSet = new Set();
let pathPixelWaypoints = [], pathSegLengths = [], pathTotal = 0;
let cellSize = 40;
let smokeParticles = [];
let nextId = 1;
let gameSpeedMult = 1;

// ===================== NETWORKING =====================
let netMode = 'local'; // 'local' | 'host' | 'remote'
let myRole = null;     // 'defense' | 'offense' (only meaningful when netMode !== 'local')
let ws = null;
let netRoomCode = null;
let lastSnapshotTime = 0;
const SNAPSHOT_HZ = 15;
let inOnlineMatch = false;     // true from the moment both players connect until the room is left
let lastSnapshotReceivedAt = 0; // remote-side watchdog: last time a snapshot actually arrived
const SNAPSHOT_TIMEOUT_MS = 6000;
// Generic "have I heard anything at all from my peer" watchdog, used by BOTH host and remote to
// notice a dead connection and trigger a reconnect — unlike lastSnapshotReceivedAt (remote-only,
// snapshot-only), this counts any inbound traffic (snapshot, action, or heartbeat).
let lastPeerHeardAt = 0;
let reconnecting = false;
let reconnectAttempts = 0;
let reconnectDeadline = 0;
const MAX_RECONNECT_MS = 25000; // give up and show Connection Lost after this long of trying
let lastHeartbeatSentAt = 0;
// Raw counters shown directly in the HUD (no DevTools needed) — lets a real-device failure be
// reported as "tx:47 / rx:0" instead of a screenshot, which pinpoints whether the host ever sent,
// the relay ever forwarded, or the remote ever received.
let snapshotsSent = 0;
let snapshotsReceived = 0;

function toFrac(x, y){ return [ x/(cellSize*GRID_COLS), y/(cellSize*GRID_ROWS) ]; }
function fromFrac(fx, fy){ return [ fx*cellSize*GRID_COLS, fy*cellSize*GRID_ROWS ]; }

// Once the relay is deployed to Render (or similar), put its wss:// URL here. Local LAN play
// (localhost / a 192.168.x.x or 10.x.x.x address) still uses the old same-machine relay on :8940
// automatically, so nothing changes for hotseat/LAN testing.
const DEPLOYED_RELAY_URL = 'wss://siege-duel.onrender.com';
function wsUrl(){
  const h = location.hostname;
  const isLocalNetwork = h==='localhost' || h==='127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
  if(isLocalNetwork || !DEPLOYED_RELAY_URL) return `ws://${h}:8940`;
  return DEPLOYED_RELAY_URL;
}

function connectRelay(room, role, statusEl){
  return new Promise((resolve, reject)=>{
    try{ ws = new WebSocket(wsUrl()); } catch(e){ reject(e); return; }
    ws.onopen = ()=>{ ws.send(JSON.stringify({type:'join', room, role})); };
    ws.onerror = ()=>{ statusEl.textContent = 'Could not reach the relay server. Is it running?'; };
    ws.onclose = (ev)=>{
      if(inOnlineMatch && netMode!=='local'){ attemptReconnect(`The connection dropped (code ${ev.code}).`); }
    };
    ws.onmessage = (ev)=>{
      let msg; try{ msg = JSON.parse(ev.data); }catch(e){ console.error('Bad message from relay:', e); return; }
      try{
        if(msg.type==='joined'){
          myRole = msg.role; netRoomCode = msg.room;
          statusEl.textContent = `Room ${msg.room} — waiting for the other player to join...`;
          resolve();
        } else if(msg.type==='error'){
          statusEl.textContent = msg.message;
          reject(new Error(msg.message));
        } else if(msg.type==='peer_joined'){
          lastSnapshotReceivedAt = performance.now();
          lastPeerHeardAt = performance.now();
          if(reconnecting){ endReconnect(true); }
          else if(!inOnlineMatch){ inOnlineMatch = true; beginOnlineMatch(); }
          // else: a redundant peer_joined while already in a live match (possible under real
          // network timing since the relay's own join handling can interleave two near-simultaneous
          // joins) — we're already set up correctly, so there's nothing to do.
        } else if(msg.type==='peer_left'){
          attemptReconnect('The other player disconnected.');
        } else if(msg.type==='snapshot'){
          lastSnapshotReceivedAt = performance.now();
          lastPeerHeardAt = performance.now();
          snapshotsReceived++;
          applySnapshot(msg.data);
        } else if(msg.type==='action'){
          lastPeerHeardAt = performance.now();
          applyAction(msg.name, msg.payload);
        } else if(msg.type==='hb'){
          lastPeerHeardAt = performance.now();
        }
      }catch(e){
        console.error('Failed to process message from relay:', msg.type, e);
      }
    };
  });
}

// A dropped connection (proxy hiccup, brief WiFi loss, a flaky initial handshake) doesn't have to
// end the match — a fresh WebSocket to the same room/role, and the relay's existing evict-on-join
// logic reseats us seamlessly. Only fall through to the full "Connection Lost" screen once retries
// have been exhausted, since that requires both players to redo everything from the lobby.
const quietStatusEl = { set textContent(v){} };
function attemptReconnect(reason){
  if(!inOnlineMatch || connectionLost) return;
  if(!el('gameOverOverlay').hidden) return;
  if(reconnecting){ return; } // already retrying
  reconnecting = true; reconnectAttempts = 0; reconnectDeadline = performance.now() + MAX_RECONNECT_MS;
  showReconnectBanner();
  window.__lastDisconnectReason = reason;
  tryReconnectOnce();
}
function tryReconnectOnce(){
  if(!reconnecting) return; // cancelled — peer_joined already came through
  reconnectAttempts++;
  updateReconnectBanner();
  if(ws){ try{ ws.close(); }catch(e){} ws=null; }
  connectRelay(netRoomCode, myRole, quietStatusEl).catch(()=>{});
  setTimeout(()=>{
    if(!reconnecting) return;
    if(performance.now() > reconnectDeadline){ endReconnect(false); return; }
    tryReconnectOnce();
  }, 3000);
}
function endReconnect(success){
  reconnecting = false;
  hideReconnectBanner();
  if(!success){ showPeerLeft(window.__lastDisconnectReason || 'Lost contact with the other player — check your connection.'); }
}
function showReconnectBanner(){
  const b = el('reconnectBanner'); if(b) b.hidden = false;
  updateReconnectBanner();
}
function hideReconnectBanner(){
  const b = el('reconnectBanner'); if(b) b.hidden = true;
}
function updateReconnectBanner(){
  const b = el('reconnectBanner'); if(b) b.textContent = `🔄 Reconnecting... (attempt ${reconnectAttempts})`;
}

function sendNet(obj){ if(ws && ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(obj)); }

let connectionLost = false;
function showPeerLeft(reason){
  if(!inOnlineMatch || connectionLost) return;
  if(!el('gameOverOverlay').hidden) return;
  connectionLost = true;
  inOnlineMatch = false;
  el('resultTitle').textContent = 'CONNECTION LOST';
  el('resultTitle').style.color = '#e74c3c';
  el('resultSub').textContent = reason || 'The other player disconnected.';
  el('rematchBtn').textContent = 'BACK TO MENU';
  el('leaveRoomBtn').style.display = 'none';
  el('gameOverOverlay').hidden = false;
  phase = 'ended';
  stopMusic();
}
// Safety net: reaching the lobby should never leave a reconnect retry loop running in the
// background (it self-stops via the `reconnecting` flag check, but belt-and-suspenders here
// costs nothing and guarantees a clean slate if that flag were ever left set by some other path).
function cancelReconnect(){ reconnecting = false; hideReconnectBanner(); }

// A backgrounded/locked tab gets its animation loop throttled hard by the browser (observed:
// a host tab not in the foreground can stop broadcasting for 20+ seconds), which is the most
// likely cause of an online match looking "frozen" to the other player. A screen wake lock keeps
// the device from auto-sleeping/dimming during a match; it has to be re-acquired after the tab
// is ever hidden (the browser releases it automatically), so we hook visibilitychange too.
let wakeLock = null;
async function requestWakeLock(){
  try{ if('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); }
  catch(e){ /* not supported / denied — not fatal, just can't help this device */ }
}
function releaseWakeLock(){
  if(wakeLock){ try{ wakeLock.release(); }catch(e){} wakeLock = null; }
}
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState==='visible' && phase==='playing') requestWakeLock();
});

function returnToLobby(){
  el('gameOverOverlay').hidden = true;
  cancelReconnect();
  if(ws){ try{ ws.close(); }catch(e){} ws=null; }
  netMode='local'; myRole=null; netRoomCode=null; connectionLost=false; inOnlineMatch=false;
  releaseWakeLock();
  el('globalBar').hidden = true; el('defenseHalf').hidden = true; el('offenseHalf').hidden = true;
  document.getElementById('speedBtn').style.display = '';
  el('startScreen').hidden = false;
  el('onlinePanel').style.display = 'none';
  el('modeRow').style.display = 'flex';
  el('onlineStatus').textContent = '';
}

function beginOnlineMatch(){
  snapshotsSent = 0; snapshotsReceived = 0;
  el('startScreen').hidden = true;
  el('globalBar').hidden = false;
  el('defenseHalf').hidden = (myRole!=='defense');
  el('offenseHalf').hidden = (myRole!=='offense');
  document.getElementById('speedBtn').style.display = (netMode==='remote') ? 'none' : '';
  el('netStat').hidden = false;
  actx.resume && actx.resume();
  requestWakeLock();
  buildShops(); resize(); refreshShopStates();
  if(netMode==='host'){ startMatch(); }
}

// Any state-changing action funnels through here. In local/host mode it applies immediately;
// in remote mode it's shipped to the host instead of touching local state (host is authoritative).
function applyAction(name, payload){
  if(name==='requestRematch'){ startMatch(); return; }
  if(phase!=='playing') return;
  if(name==='placeTower'){
    const { towerType, c, r } = payload;
    if(pathCellSet.has(c+','+r)) return;
    if(c<0||r<0||c>=GRID_COLS||r>=GRID_ROWS) return;
    if(towers.find(t=>t.c===c && t.r===r)) return;
    const cost = TOWER_TYPES[towerType].cost;
    if(defenseCoins < cost) return;
    defenseCoins -= cost; towers.push(new Tower(towerType, c, r));
    sfxPlace();
  } else if(name==='upgradeTower'){
    const t = towers.find(x=>x.id===payload.id); if(!t) return;
    const cost = t.upgradeCost(); if(cost===null||defenseCoins<cost) return;
    defenseCoins -= cost; t.totalSpent += cost; t.level++; sfxUpgrade();
  } else if(name==='sellTower'){
    const t = towers.find(x=>x.id===payload.id); if(!t) return;
    sfxSell(); defenseCoins += t.sellValue(); towers = towers.filter(x=>x!==t);
  } else if(name==='spawnMonster'){
    const m = ENEMY_TYPES[payload.key]; if(!m) return;
    if(offenseCoins < m.cost) return;
    offenseCoins -= m.cost; enemies.push(new Enemy(payload.key,1));
    if(MONSTER_SPAWN_SFX[payload.key]) MONSTER_SPAWN_SFX[payload.key]();
  } else if(name==='useAbility'){
    useAbilityLocal(payload.key);
  } else if(name==='useDefenseAbility'){
    useDefenseAbilityLocal(payload.key);
  } else if(name==='upgradeMonster'){
    upgradeMonsterLocal(payload.key);
  } else if(name==='moveCommander'){
    if(!commander) return;
    const [px,py] = fromFrac(payload.fx, payload.fy);
    commander.moveTo(px,py);
  } else if(name==='upgradeCommander'){
    if(!commander || commander.dead || commander.level>=COMMANDER_BASE.maxLevel) return;
    const cost = commanderUpgradeCost();
    if(offenseCoins<cost) return;
    offenseCoins -= cost; commander.gainXp(commander.xpToNext); sfxLevelUp();
  }
}

function buildSnapshot(){
  return {
    phase, winner, winReason, timeLeft, lives, defenseCoins, offenseCoins, overclockTimer, gameSpeedMult, monsterLevels, battlefieldTheme, nukeUsed, defenseNukeUsed,
    towers: towers.map(t=>({ id:t.id, type:t.type, level:t.level, hp:t.hp, maxHp:t.maxHp, totalSpent:t.totalSpent, c:t.c, r:t.r, angle:t.angle })),
    enemies: enemies.map(e=>{
      const [fx,fy] = toFrac(e.x,e.y);
      return { id:e.id, typeKey:e.typeKey, level:e.level, hp:e.hp, maxHp:e.maxHp, shieldHp:e.shieldHp, maxShield:e.maxShield, fx, fy, facing:e.facing, slowTimer:e.slowTimer, stunTimer:e.stunTimer, dotTimer:e.dotTimer, dotColor:e.dotColor };
    }),
    commander: commander ? (()=>{ const [fx,fy]=toFrac(commander.x,commander.y); return { hp:commander.hp, maxHp:commander.maxHp, level:commander.level, xp:commander.xp, dead:commander.dead, respawnTimer:commander.respawnTimer, fx, fy }; })() : null,
    projectiles: projectiles.map(p=>{ const [fx,fy]=toFrac(p.x,p.y); return { fx, fy, color:p.color, splash:p.splash>0 }; }),
    effects: effects.map(ef=>{
      if(ef.type==='chainline'){ const [fx1,fy1]=toFrac(ef.x1,ef.y1); const [fx2,fy2]=toFrac(ef.x2,ef.y2); return { type:ef.type, fx1, fy1, fx2, fy2, life:ef.life, maxLife:ef.maxLife, color:ef.color }; }
      if(ef.type==='flash' || ef.type==='bombfall'){ return { type:ef.type, life:ef.life, maxLife:ef.maxLife }; }
      const [fx,fy]=toFrac(ef.x,ef.y); return { type:ef.type, fx, fy, life:ef.life, maxLife:ef.maxLife, color:ef.color, rFrac:(ef.r||0)/cellSize };
    }),
  };
}

function applySnapshot(data){
  const wasPlaying = phase==='playing';
  phase = data.phase; winner = data.winner; winReason = data.winReason;
  timeLeft = data.timeLeft; lives = data.lives; defenseCoins = data.defenseCoins; offenseCoins = data.offenseCoins;
  overclockTimer = data.overclockTimer; gameSpeedMult = data.gameSpeedMult; monsterLevels = data.monsterLevels || monsterLevels;
  nukeUsed = !!data.nukeUsed; defenseNukeUsed = !!data.defenseNukeUsed;
  if(data.battlefieldTheme && data.battlefieldTheme!==battlefieldTheme){ applyBattlefieldTheme(data.battlefieldTheme); }

  towers = data.towers.map(t=>{
    const o = Object.assign({}, t);
    [o.x,o.y] = gridToPx(o.c, o.r);
    Object.setPrototypeOf(o, Tower.prototype);
    return o;
  });
  enemies = data.enemies.map(e=>{
    const o = Object.assign({}, e);
    [o.x,o.y] = fromFrac(o.fx, o.fy);
    o.def = ENEMY_TYPES[o.typeKey];
    Object.setPrototypeOf(o, Enemy.prototype);
    return o;
  });
  if(data.commander){
    const o = Object.assign({}, data.commander);
    [o.x,o.y] = fromFrac(o.fx, o.fy);
    Object.setPrototypeOf(o, Commander.prototype);
    commander = o;
  } else commander = null;
  projectiles = data.projectiles.map(p=>{
    const [x,y] = fromFrac(p.fx,p.fy);
    return { x, y, color:p.color, splash:p.splash?1:0, draw(){ ctx.save(); ctx.fillStyle=this.color; ctx.beginPath(); ctx.arc(this.x,this.y,this.splash?5:3,0,Math.PI*2); ctx.fill(); ctx.restore(); } };
  });
  effects = data.effects.map(ef=>{
    if(ef.type==='chainline'){ const [x1,y1]=fromFrac(ef.fx1,ef.fy1); const [x2,y2]=fromFrac(ef.fx2,ef.fy2); return { type:ef.type, x1,y1,x2,y2, life:ef.life, maxLife:ef.maxLife, color:ef.color }; }
    if(ef.type==='flash' || ef.type==='bombfall'){ return { type:ef.type, life:ef.life, maxLife:ef.maxLife }; }
    const [x,y]=fromFrac(ef.fx,ef.fy); return { type:ef.type, x, y, life:ef.life, maxLife:ef.maxLife, color:ef.color, r:ef.rFrac*cellSize };
  });

  el('defCoins').textContent = Math.round(defenseCoins);
  el('offCoins').textContent = Math.round(offenseCoins);
  const t = Math.max(0,timeLeft); const mm=Math.floor(t/60), ss=Math.floor(t%60);
  el('timerStat').textContent = `⏱ ${mm}:${ss.toString().padStart(2,'0')}`;
  refreshShopStates();
  if(selectedTowerId!=null) showInfoPanel();
  if(commanderSelected) showCommanderPanel();

  if(wasPlaying && phase==='ended') endMatch(winner, winReason);
  else if(!wasPlaying && phase==='playing'){
    el('gameOverOverlay').hidden = true; connectionLost = false; playMusic();
  }
}

const defCanvas = document.getElementById('defenseCanvas');
const offCanvas = document.getElementById('offenseCanvas');
const defCtx = defCanvas.getContext('2d');
const offCtx = offCanvas.getContext('2d');
let ctx = defCtx; // active context, swapped per render pass
const el = id => document.getElementById(id);

function buildThemeRow(){
  const row = el('themeRow'); if(!row) return;
  row.innerHTML = '';
  Object.keys(BATTLEFIELD_THEMES).forEach(key=>{
    const theme = BATTLEFIELD_THEMES[key];
    const sw = document.createElement('div');
    sw.className = 'themeSwatch' + (key===battlefieldTheme ? ' selected' : '');
    sw.dataset.key = key;
    sw.innerHTML = `<div class="emoji">${theme.icon}</div><div class="label2">${theme.name}</div>`;
    sw.addEventListener('click', ()=>{
      applyBattlefieldTheme(key);
      row.querySelectorAll('.themeSwatch').forEach(x=>x.classList.remove('selected'));
      sw.classList.add('selected');
    });
    row.appendChild(sw);
  });
}

let offsetX1=0, offsetY1=0, offsetX2=0, offsetY2=0;
function resize(){
  const defVisible = !el('defenseHalf').hidden, offVisible = !el('offenseHalf').hidden;
  const wrap1 = defCanvas.parentElement, wrap2 = offCanvas.parentElement;
  defCanvas.width = Math.max(1, wrap1.clientWidth); defCanvas.height = Math.max(1, wrap1.clientHeight);
  offCanvas.width = Math.max(1, wrap2.clientWidth); offCanvas.height = Math.max(1, wrap2.clientHeight);
  const cs1 = Math.min(defCanvas.width/GRID_COLS, defCanvas.height/GRID_ROWS);
  const cs2 = Math.min(offCanvas.width/GRID_COLS, offCanvas.height/GRID_ROWS);
  if(defVisible && offVisible) cellSize = Math.max(4, Math.min(cs1, cs2));
  else if(defVisible) cellSize = Math.max(4, cs1);
  else cellSize = Math.max(4, cs2);
  offsetX1 = (defCanvas.width - cellSize*GRID_COLS)/2; offsetY1 = (defCanvas.height - cellSize*GRID_ROWS)/2;
  offsetX2 = (offCanvas.width - cellSize*GRID_COLS)/2; offsetY2 = (offCanvas.height - cellSize*GRID_ROWS)/2;
  computePathPixels(); generateDecorations(); generateSmoke();
}
window.addEventListener('resize', resize);

function gridToPx(c,r){ return [ (c+0.5)*cellSize, (r+0.5)*cellSize ]; }
function computePathPixels(){
  pathPixelWaypoints = WAYPOINTS.map(([c,r])=>gridToPx(c,r));
  pathSegLengths = []; pathTotal = 0;
  for(let i=0;i<pathPixelWaypoints.length-1;i++){
    const [x1,y1]=pathPixelWaypoints[i], [x2,y2]=pathPixelWaypoints[i+1];
    const d = Math.hypot(x2-x1,y2-y1); pathSegLengths.push(d); pathTotal += d;
  }
}
function computePathCells(){
  pathCellSet = new Set();
  for(let i=0;i<WAYPOINTS.length-1;i++){
    let [c1,r1]=WAYPOINTS[i], [c2,r2]=WAYPOINTS[i+1];
    const dc=Math.sign(c2-c1), dr=Math.sign(r2-r1);
    let c=c1,r=r1; pathCellSet.add(c+','+r);
    while(c!==c2||r!==r2){ if(c!==c2)c+=dc; if(r!==r2)r+=dr; pathCellSet.add(c+','+r); }
  }
}
computePathCells();
// Switches both the look and the actual path for a battlefield theme; called on theme selection
// and whenever a networked snapshot reports the host picked a different theme.
function applyBattlefieldTheme(theme){
  battlefieldTheme = theme;
  WAYPOINTS = MAP_WAYPOINTS[theme];
  computePathCells();
  computePathPixels();
  generateDecorations();
}
function posAtDistance(dist){
  let d = Math.max(0, Math.min(dist, pathTotal)); let acc=0;
  for(let i=0;i<pathSegLengths.length;i++){
    if(d <= acc+pathSegLengths[i] || i===pathSegLengths.length-1){
      const t = pathSegLengths[i]>0 ? (d-acc)/pathSegLengths[i] : 0;
      const [x1,y1]=pathPixelWaypoints[i], [x2,y2]=pathPixelWaypoints[i+1];
      return { x:x1+(x2-x1)*Math.min(1,Math.max(0,t)), y:y1+(y2-y1)*Math.min(1,Math.max(0,t)) };
    }
    acc += pathSegLengths[i];
  }
  return pathPixelWaypoints.length ? {x:pathPixelWaypoints.at(-1)[0], y:pathPixelWaypoints.at(-1)[1]} : {x:0,y:0};
}

// ---- battlefield themes (cosmetic only — grid, path, waypoints, and all gameplay stay identical) ----
const BATTLEFIELD_THEMES = {
  warzone: { name:'War-Torn', icon:'💥', bgTop:'#3a2a20', bgMid:'#241c1a', bgBottom:'#1a1815', pathColor:'#4a4028',
    tileLight:'rgba(255,255,255,0.02)', tileDark:'rgba(0,0,0,0.05)', decorTypes:['crater','sandbag','barbwire','rubble'] },
  winter: { name:'Winter', icon:'❄️', bgTop:'#3a4a5c', bgMid:'#28323d', bgBottom:'#1a2128', pathColor:'#c9d8e3',
    tileLight:'rgba(255,255,255,0.07)', tileDark:'rgba(0,30,50,0.08)', decorTypes:['icecrack','snowdrift','pinetree','rubble'] },
  desert: { name:'Desert', icon:'🏜️', bgTop:'#8a6a3a', bgMid:'#6a4f28', bgBottom:'#4a361c', pathColor:'#dcc48a',
    tileLight:'rgba(255,230,180,0.05)', tileDark:'rgba(70,45,10,0.07)', decorTypes:['cactus','dune','bones','rubble'] },
  forest: { name:'Forest', icon:'🌲', bgTop:'#2a4530', bgMid:'#1c3320', bgBottom:'#142418', pathColor:'#6b5a3a',
    tileLight:'rgba(140,255,140,0.03)', tileDark:'rgba(0,40,0,0.07)', decorTypes:['tree','bush','mossyrock','rubble'] },
};
let battlefieldTheme = 'warzone';
buildThemeRow();

// ---- decor ----
function seededRand(seed){ const x=Math.sin(seed*9999)*10000; return x-Math.floor(x); }
let decorations = [];
function generateDecorations(){
  decorations = [];
  const decorTypes = BATTLEFIELD_THEMES[battlefieldTheme].decorTypes;
  for(let c=0;c<GRID_COLS;c++) for(let r=0;r<GRID_ROWS;r++){
    if(pathCellSet.has(c+','+r)) continue;
    const roll = seededRand(c*137+r*911);
    if(roll<0.10) decorations.push({c,r,type:decorTypes[0]});
    else if(roll<0.16) decorations.push({c,r,type:decorTypes[1]});
    else if(roll<0.20) decorations.push({c,r,type:decorTypes[2]});
    else if(roll<0.24) decorations.push({c,r,type:decorTypes[3]});
  }
}
function generateSmoke(){
  smokeParticles = [];
  const gridW = cellSize*GRID_COLS, gridH = cellSize*GRID_ROWS;
  for(let i=0;i<12;i++) smokeParticles.push({ x:Math.random()*gridW, y:Math.random()*gridH, r:14+Math.random()*26, spd:5+Math.random()*8, drift:(Math.random()-0.5)*6, phase:Math.random()*10 });
}
function drawDecoration(d){
  const [cx,cy] = gridToPx(d.c,d.r);
  ctx.save(); ctx.translate(cx,cy); const s = cellSize;
  if(d.type==='crater'){ ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0,s*0.08,s*0.32,s*0.2,0,0,Math.PI*2); ctx.fill(); }
  else if(d.type==='sandbag'){ ctx.fillStyle='#8a7a52'; for(let k=-1;k<=1;k++){ ctx.beginPath(); ctx.ellipse(k*s*0.22,s*0.12,s*0.16,s*0.1,0,0,Math.PI*2); ctx.fill(); } }
  else if(d.type==='barbwire'){ ctx.strokeStyle='rgba(120,120,110,0.55)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(-s*0.35,0); for(let k=0;k<6;k++){ ctx.lineTo(-s*0.35+k*(s*0.7/6),(k%2?-1:1)*s*0.08); } ctx.stroke(); }
  else if(d.type==='rubble'){ ctx.fillStyle='rgba(90,85,80,0.5)'; ctx.beginPath(); ctx.moveTo(-s*0.18,-s*0.08); ctx.lineTo(s*0.1,-s*0.16); ctx.lineTo(s*0.2,s*0.05); ctx.lineTo(-s*0.05,s*0.15); ctx.closePath(); ctx.fill(); }
  else if(d.type==='icecrack'){ ctx.strokeStyle='rgba(200,230,255,0.6)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(-s*0.3,-s*0.1); ctx.lineTo(-s*0.05,s*0.05); ctx.lineTo(-s*0.15,s*0.18); ctx.moveTo(-s*0.05,s*0.05); ctx.lineTo(s*0.2,-s*0.05); ctx.stroke(); }
  else if(d.type==='snowdrift'){ ctx.fillStyle='rgba(235,245,255,0.75)'; ctx.beginPath(); ctx.ellipse(0,s*0.1,s*0.3,s*0.16,0,0,Math.PI*2); ctx.fill(); }
  else if(d.type==='pinetree'){ ctx.fillStyle='#3a5a3a'; ctx.beginPath(); ctx.moveTo(0,-s*0.32); ctx.lineTo(s*0.2,s*0.02); ctx.lineTo(-s*0.2,s*0.02); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0,-s*0.18); ctx.lineTo(s*0.24,s*0.14); ctx.lineTo(-s*0.24,s*0.14); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#5a4530'; ctx.fillRect(-s*0.04,s*0.1,s*0.08,s*0.12); }
  else if(d.type==='cactus'){ ctx.fillStyle='#4a7a4a'; ctx.fillRect(-s*0.06,-s*0.28,s*0.12,s*0.42);
    ctx.fillRect(-s*0.2,-s*0.08,s*0.12,s*0.2); ctx.fillRect(s*0.08,-s*0.16,s*0.12,s*0.2); }
  else if(d.type==='dune'){ ctx.fillStyle='rgba(230,200,140,0.5)'; ctx.beginPath(); ctx.ellipse(0,s*0.1,s*0.34,s*0.14,0,0,Math.PI*2); ctx.fill(); }
  else if(d.type==='bones'){ ctx.strokeStyle='rgba(230,225,210,0.7)'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(-s*0.18,-s*0.12); ctx.lineTo(s*0.18,s*0.12); ctx.moveTo(-s*0.18,s*0.12); ctx.lineTo(s*0.18,-s*0.12); ctx.stroke(); }
  else if(d.type==='tree'){ ctx.fillStyle='#5a4530'; ctx.fillRect(-s*0.05,-s*0.02,s*0.1,s*0.2);
    ctx.fillStyle='#3a6a38'; ctx.beginPath(); ctx.arc(0,-s*0.14,s*0.22,0,Math.PI*2); ctx.fill(); }
  else if(d.type==='bush'){ ctx.fillStyle='#3f6b3a'; for(let k=-1;k<=1;k++){ ctx.beginPath(); ctx.arc(k*s*0.14,s*0.06,s*0.14,0,Math.PI*2); ctx.fill(); } }
  else if(d.type==='mossyrock'){ ctx.fillStyle='#5a5f52'; ctx.beginPath(); ctx.moveTo(-s*0.2,-s*0.05); ctx.lineTo(s*0.05,-s*0.16); ctx.lineTo(s*0.22,s*0.02); ctx.lineTo(s*0.02,s*0.16); ctx.lineTo(-s*0.18,s*0.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(90,140,80,0.5)'; ctx.beginPath(); ctx.ellipse(-s*0.02,-s*0.02,s*0.1,s*0.06,0,0,Math.PI*2); ctx.fill(); }
  ctx.restore();
}

// ===================== TOWER =====================
class Tower {
  constructor(type, c, r){
    this.id = nextId++; this.type=type; this.c=c; this.r=r;
    [this.x,this.y] = gridToPx(c,r);
    this.level=1; this.cooldown=0; this.angle=0;
    this.totalSpent = TOWER_TYPES[type].cost;
    this.maxHp = TOWER_TYPES[type].hp; this.hp = this.maxHp;
    this.novaTimer=0; this.shotCount=0;
  }
  get def(){ return TOWER_TYPES[this.type]; }
  get abilities(){ return this.def.abilities[this.level-1]; }
  get damage(){ return this.def.damage * LEVEL_MULT[this.level-1].dmg; }
  get range(){ return this.def.range * LEVEL_MULT[this.level-1].range; }
  get fireRate(){ return this.def.fireRate * LEVEL_MULT[this.level-1].rate; }
  get rangePx(){ return this.range*cellSize; }
  upgradeCost(){ if(this.level>=3) return null; return Math.round(this.def.cost*LEVEL_MULT[this.level].cost*0.65); }
  sellValue(){ return Math.round(this.totalSpent*0.6); }
  findTarget(){
    let target=null;
    for(const e of enemies){
      const d = Math.hypot(e.x-this.x, e.y-this.y);
      if(d<=this.rangePx && e.dist > (target?target.dist:-1)) target=e;
    }
    if(commander && !commander.dead){
      const d = Math.hypot(commander.x-this.x, commander.y-this.y);
      if(d<=this.rangePx) target=commander; // commander always takes priority when in range
    }
    return target;
  }
  update(dt){
    this.cooldown -= dt;
    const ab = this.abilities;
    if(this.def.isAura){
      let hitAny=false;
      for(const e of enemies){
        if(e.dead) continue;
        if(Math.hypot(e.x-this.x,e.y-this.y)<=this.rangePx){
          hitAny=true;
          this.angle = Math.atan2(e.y-this.y, e.x-this.x);
          e.hp -= this.damage*dt;
          if(ab.auraBurnOnExit) applyDot(e, this.damage*0.3, ab.burnDuration, '#ff8844', false);
          if(e.hp<=0 && !e.dead) killEnemy(e, ab.igniteSpread?{igniteRadius:ab.igniteRadius, igniteDps:this.damage*0.3}:null);
        }
      }
      if(hitAny && this.cooldown<=0){ this.cooldown=0.28; TOWER_FIRE_SFX.flamethrower(); }
      return;
    }
    if(ab.nova){
      this.novaTimer -= dt;
      if(this.novaTimer<=0){
        this.novaTimer = ab.novaInterval;
        for(const e of enemies){ if(Math.hypot(e.x-this.x,e.y-this.y)<=this.rangePx){ e.slowTimer=Math.max(e.slowTimer,ab.novaDuration); e.slowFactor=ab.novaSlow; } }
        effects.push({type:'hit', x:this.x, y:this.y, life:0.35, maxLife:0.35, color:'#7ff5ee', r:this.rangePx});
      }
    }
    const target = this.findTarget();
    if(target) this.angle = Math.atan2(target.y-this.y, target.x-this.x);
    if(target && this.cooldown<=0){
      this.cooldown = 1/this.fireRate; this.shotCount++;
      const isOverload = ab.overloadEvery && (this.shotCount % ab.overloadEvery===0);
      if(TOWER_FIRE_SFX[this.type]) TOWER_FIRE_SFX[this.type]();
      projectiles.push(new Projectile(this, target, isOverload));
      if(ab.doubleShot) projectiles.push(new Projectile(this, target, false));
      if(ab.doubleBarrage){
        const second = enemies.filter(e=>e!==target && Math.hypot(e.x-this.x,e.y-this.y)<=this.rangePx).sort((a,b)=>b.dist-a.dist)[0];
        if(second) projectiles.push(new Projectile(this, second, false));
      }
    }
  }
}

// ===================== PROJECTILE =====================
class Projectile {
  constructor(tower, target, isOverload){
    this.tower=tower; this.target=target; this.isOverload=isOverload;
    this.x=tower.x; this.y=tower.y;
    this.speed = tower.def.projSpeed*cellSize;
    this.damage = tower.damage; this.splash = tower.def.splash*cellSize;
    this.slow = tower.def.slow; this.slowDur = tower.def.slowDur;
    this.color = tower.def.color; this.dead=false;
    this.ab = tower.abilities;
    if(this.ab.carpetMult) this.splash *= this.ab.carpetMult;
  }
  update(dt){
    if(this.target.dead){ this.dead=true; return; }
    const dx=this.target.x-this.x, dy=this.target.y-this.y, d=Math.hypot(dx,dy), step=this.speed*dt;
    if(d<=step) this.hit(this.target.x,this.target.y);
    else { this.x += dx/d*step; this.y += dy/d*step; }
  }
  hit(x,y){
    this.dead = true;
    const ab=this.ab, tower=this.tower, def=tower.def;
    let dmg = this.damage;
    if(this.isOverload) dmg *= (ab.overloadMult||1);
    let isCrit = ab.critChance && Math.random()<ab.critChance;
    if(isCrit) dmg *= ab.critMult;
    effects.push({type:'hit', x, y, life:0.18, maxLife:0.18, color:isCrit?'#ffff33':this.color, r:this.splash>0?this.splash:14});
    sfxHit(dmg);
    const pierceShield = !!def.piercesShield;
    const targetIsCommander = this.target === commander;
    if(this.splash>0){
      for(const e of enemies){
        if(Math.hypot(e.x-x,e.y-y)<=this.splash){
          damageEnemy(e, dmg, pierceShield);
          if(ab.stunDuration) e.stunTimer=Math.max(e.stunTimer,ab.stunDuration);
          if(ab.burnFrac) applyDot(e, dmg*ab.burnFrac, ab.burnDuration, '#ff8844', false);
          if(ab.carpetBurn) applyDot(e, dmg*0.2, 2, '#ff8844', false);
          if(this.isOverload) e.stunTimer=Math.max(e.stunTimer,0.3);
        }
      }
      if(commander && !commander.dead && Math.hypot(commander.x-x,commander.y-y)<=this.splash) commander.takeDamage(dmg);
    } else if(targetIsCommander){
      const killed = commander.takeDamage(dmg);
      if(ab.headshotRefund && killed) tower.cooldown = 0;
    } else {
      const killed = damageEnemy(this.target, dmg, pierceShield);
      if(ab.headshotRefund && killed) tower.cooldown = 0;
      if(ab.freezeChance && Math.random()<ab.freezeChance) this.target.stunTimer = Math.max(this.target.stunTimer, ab.freezeDuration);
      if(ab.pierceFrac){
        const behind = enemies.find(e=>e!==this.target && !e.dead && Math.hypot(e.x-this.target.x,e.y-this.target.y)<=cellSize*1.5);
        if(behind) damageEnemy(behind, dmg*ab.pierceFrac, pierceShield);
      }
      if(def.poisonDps){
        const pd = def.poisonDps*LEVEL_MULT[tower.level-1].dmg;
        applyDot(this.target, pd, def.poisonDuration, '#8fdd3a', !!ab.poisonStack);
        if(ab.killCloud) this.target.dotKillCloud = {radius:1.3*cellSize, dps:pd};
        if(ab.poisonSpreadRadius){
          for(const e of enemies){ if(e!==this.target && !e.dead && Math.hypot(e.x-this.target.x,e.y-this.target.y)<=ab.poisonSpreadRadius*cellSize){ applyDot(e, pd*0.7, def.poisonDuration, '#8fdd3a', !!ab.poisonStack); } }
        }
      }
      if(ab.clusterCount){
        const nearby = enemies.filter(e=>e!==this.target && !e.dead && Math.hypot(e.x-x,e.y-y)<=cellSize*1.4).slice(0,ab.clusterCount);
        nearby.forEach(e=>{ damageEnemy(e, dmg*ab.clusterFrac, pierceShield); effects.push({type:'hit', x:e.x, y:e.y, life:0.12, maxLife:0.12, color:this.color, r:8}); });
      }
      if(ab.knockback) this.target.dist = Math.max(0, this.target.dist - ab.knockback*cellSize);
      if(this.isOverload) this.target.stunTimer = Math.max(this.target.stunTimer, 0.3);
    }
    if(this.slow>0){
      const targets = this.splash>0 ? enemies : [this.target];
      for(const e of targets){ if(this.splash>0 && Math.hypot(e.x-x,e.y-y)>this.splash) continue; e.slowTimer=Math.max(e.slowTimer,this.slowDur); e.slowFactor=this.slow; }
    }
    if(def.chain){
      let lastX=x,lastY=y,chDmg=dmg; let hitSet=new Set([this.target]);
      const chainCount = def.chain + (ab.extraChain||0);
      const chainRadiusPx = (def.chainRadius + (ab.extraChainRadius||0))*cellSize;
      for(let i=0;i<chainCount;i++){
        chDmg *= 0.6; let next=null, bestD=chainRadiusPx;
        for(const e of enemies){ if(hitSet.has(e)||e.dead) continue; const d=Math.hypot(e.x-lastX,e.y-lastY); if(d<=bestD){next=e;bestD=d;} }
        if(!next) break;
        damageEnemy(next, chDmg, pierceShield);
        if(this.isOverload) next.stunTimer = Math.max(next.stunTimer,0.3);
        effects.push({type:'chainline', x1:lastX,y1:lastY,x2:next.x,y2:next.y, life:0.15, maxLife:0.15, color:'#c9a8ff'});
        hitSet.add(next); lastX=next.x; lastY=next.y;
      }
    }
  }
  draw(){
    ctx.save();
    if(this.splash>0){ ctx.fillStyle=this.color; ctx.beginPath(); ctx.arc(this.x,this.y,5,0,Math.PI*2); ctx.fill(); }
    else { const ang=Math.atan2(this.target.y-this.y,this.target.x-this.x); ctx.translate(this.x,this.y); ctx.rotate(ang); ctx.fillStyle=this.color; ctx.fillRect(-6,-1.5,12,3); }
    ctx.restore();
  }
}

function applyDot(e, dps, duration, color, stack){
  if(e.dead) return;
  if(stack && e.dotTimer>0 && e.dotColor===color) e.dotDps += dps;
  else e.dotDps = Math.max(e.dotDps, dps);
  e.dotTimer = Math.max(e.dotTimer, duration); e.dotColor = color;
}
function killEnemy(e, igniteInfo){
  if(e.dead) return; e.dead = true;
  defenseCoins += Math.round(6 + e.maxHp*0.12);
  sfxEnemyDeath(); sfxCoin();
  if(e.def.splitInto){
    for(let i=0;i<e.def.splitCount;i++){
      const child = new Enemy(e.def.splitInto, e.scale);
      child.dist = Math.max(0, e.dist - i*14);
      const p = posAtDistance(child.dist); child.x=p.x; child.y=p.y;
      enemies.push(child);
    }
  }
  if(e.dotKillCloud){
    for(const other of enemies){ if(other!==e && !other.dead && Math.hypot(other.x-e.x,other.y-e.y)<=e.dotKillCloud.radius) applyDot(other, e.dotKillCloud.dps, 2, '#8fdd3a', false); }
    effects.push({type:'heal', x:e.x, y:e.y, life:0.4, maxLife:0.4, color:'#8fdd3a', r:e.dotKillCloud.radius});
  }
  if(igniteInfo && e.dotTimer>0){
    for(const other of enemies){ if(other!==e && !other.dead && Math.hypot(other.x-e.x,other.y-e.y)<=igniteInfo.igniteRadius*cellSize) applyDot(other, igniteInfo.igniteDps, 2, '#ff8844', false); }
  }
  if(e.def.explodeDamage){
    let hitAny=false;
    for(const t of towers){ if(Math.hypot(t.x-e.x,t.y-e.y)<=e.def.explodeRadius*cellSize){ t.hp -= e.def.explodeDamage*e.dmgMult; hitAny=true; } }
    effects.push({type:'hit', x:e.x, y:e.y, life:0.4, maxLife:0.4, color:'#ff6644', r:e.def.explodeRadius*cellSize});
    if(hitAny) sfxDestroyed();
  }
}
function damageEnemy(e, dmg, pierceShield){
  if(e.dead) return false;
  if(e.shieldHp>0 && !pierceShield){
    if(dmg<=e.shieldHp){ e.shieldHp-=dmg; return false; }
    dmg -= e.shieldHp; e.shieldHp=0;
  } else if(e.shieldHp>0 && pierceShield){ e.shieldHp = Math.max(0, e.shieldHp-dmg*0.5); }
  e.hp -= dmg;
  if(e.hp<=0 && !e.dead){ killEnemy(e,null); return true; }
  return false;
}

// ===================== ENEMY =====================
class Enemy {
  constructor(typeKey, scale, level){
    this.id = nextId++; this.typeKey=typeKey; this.def=ENEMY_TYPES[typeKey]; this.scale=scale||1;
    this.level = level || monsterLevels[typeKey] || 1;
    const lm = MONSTER_LEVEL_MULT[this.level-1];
    this.dmgMult = lm.dmg;
    this.maxHp = this.def.hp*this.scale*lm.hp; this.hp=this.maxHp;
    this.shieldHp = (this.def.shieldHp||0)*this.scale*lm.hp; this.maxShield=this.shieldHp;
    this.baseSpeed = this.def.speed*lm.speed;
    this.dist=0; this.dead=false; this.reachedEnd=false;
    this.slowTimer=0; this.slowFactor=0; this.stunTimer=0;
    this.dotDps=0; this.dotTimer=0; this.dotColor=null;
    this.healTimer = this.def.healInterval||0;
    this.reinforceTimer = this.def.reinforceInterval||0;
    this.slamTimer = this.def.slamInterval||0;
    this.facing = 1;
    const p = posAtDistance(0); this.x=p.x; this.y=p.y;
  }
  update(dt){
    if(this.dotTimer>0){ this.dotTimer-=dt; this.hp -= this.dotDps*dt; if(this.hp<=0 && !this.dead){ killEnemy(this,null); return; } }
    let spd = this.baseSpeed*cellSize;
    if(overclockTimer>0) spd *= 1.6;
    if(this.stunTimer>0){ this.stunTimer-=dt; spd=0; }
    else if(this.slowTimer>0){ this.slowTimer-=dt; spd *= (1-this.slowFactor); }
    const prevX = this.x;
    this.dist += spd*dt;
    const p = posAtDistance(this.dist); this.x=p.x; this.y=p.y;
    if(this.x - prevX > 0.5) this.facing = 1; else if(this.x - prevX < -0.5) this.facing = -1;
    if(this.dist>=pathTotal){
      this.reachedEnd=true; this.dead=true;
      if(phase==='playing') endMatch('offense', `A ${this.def.name} broke through the defenses!`);
      return;
    }
    if(this.def.healRadius){
      this.healTimer -= dt;
      if(this.healTimer<=0){
        this.healTimer = this.def.healInterval;
        for(const other of enemies){ if(!other.dead && Math.hypot(other.x-this.x,other.y-this.y)<=this.def.healRadius*cellSize) other.hp=Math.min(other.maxHp, other.hp+other.maxHp*this.def.healPct*this.dmgMult); }
        effects.push({type:'heal', x:this.x, y:this.y, life:0.4, maxLife:0.4, color:'#55dd88', r:this.def.healRadius*cellSize});
      }
    }
    if(this.def.isBoss){
      this.reinforceTimer -= dt;
      if(this.reinforceTimer<=0){ this.reinforceTimer=this.def.reinforceInterval; enemies.push(new Enemy('grunt',0.7)); }
    }
    if(this.def.slamInterval){
      this.slamTimer -= dt;
      if(this.slamTimer<=0){
        this.slamTimer = this.def.slamInterval;
        let hitAny=false;
        for(const t of towers){ if(Math.hypot(t.x-this.x,t.y-this.y)<=this.def.slamRadius*cellSize){ t.hp -= this.def.slamDamage*this.dmgMult; hitAny=true; } }
        if(hitAny){ effects.push({type:'hit', x:this.x, y:this.y, life:0.3, maxLife:0.3, color:'#ff3355', r:this.def.slamRadius*cellSize}); sfxSlam(); }
      }
    }
    if(this.def.towerDps){
      let dpsMult = 1;
      if(commander && !commander.dead && commander.hasAura && Math.hypot(commander.x-this.x,commander.y-this.y)<=commander.auraRadiusPx) dpsMult = 1.3;
      for(const t of towers){
        if(Math.hypot(t.x-this.x, t.y-this.y) <= TOWER_ATTACK_RANGE*cellSize){
          t.hp -= this.def.towerDps*dpsMult*this.dmgMult*dt;
          if(Math.random() < 0.15) effects.push({type:'hit', x:t.x, y:t.y, life:0.12, maxLife:0.12, color:this.def.color, r:6});
        }
      }
    }
  }
  draw(){
    const img = loadImg(`assets/${this.typeKey}.png`);
    const lvlScale = 1 + (this.level-1)*0.12;
    const s = cellSize*(this.def.isBoss?1.8:1.05)*lvlScale;
    const tierColor = tierGlowColor(this.level, 3);
    if(tierColor) drawTierRing(this.x, this.y, s*0.56, tierColor);
    ctx.save(); ctx.translate(this.x,this.y);
    if(this.facing<0) ctx.scale(-1,1);
    ctx.filter = tierSpriteFilter(this.level, 3);
    if(img.complete && img.naturalWidth){
      ctx.drawImage(img, -s/2, -s/2, s, s);
    } else {
      ctx.fillStyle=this.def.color; ctx.beginPath(); ctx.arc(0,0,s*0.4,0,Math.PI*2); ctx.fill();
    }
    ctx.filter = 'none';
    ctx.restore();
    ctx.save(); ctx.translate(this.x,this.y);
    const ringR = s*0.56;
    if(this.slowTimer>0 && this.stunTimer<=0){ ctx.strokeStyle='#7ff5ee'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,ringR,0,Math.PI*2); ctx.stroke(); }
    if(this.stunTimer>0){ ctx.strokeStyle='#bfefff'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(0,0,ringR,0,Math.PI*2); ctx.stroke(); }
    if(this.dotTimer>0){ ctx.strokeStyle=this.dotColor; ctx.lineWidth=2; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.arc(0,0,ringR*0.85,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
    if(overclockTimer>0){ ctx.strokeStyle='#ffdd33'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(0,0,ringR*1.15,0,Math.PI*2); ctx.stroke(); }
    ctx.restore();

    const barW = cellSize*(this.def.isBoss?1.4:0.6);
    const barY = this.y - s*0.62;
    ctx.fillStyle='#000'; ctx.fillRect(this.x-barW/2, barY, barW, 5);
    ctx.fillStyle = this.hp/this.maxHp>0.4?'#4caf50':'#e74c3c';
    ctx.fillRect(this.x-barW/2, barY, barW*Math.max(0,this.hp/this.maxHp), 5);
    if(this.maxShield>0){ ctx.fillStyle='rgba(143,208,255,0.9)'; ctx.fillRect(this.x-barW/2, barY-4, barW*Math.max(0,this.shieldHp/this.maxShield), 3); }
  }
}

// ===================== COMMANDER (offense's controllable hero) =====================
class Commander {
  constructor(){
    this.maxHp = COMMANDER_BASE.hp; this.hp = this.maxHp;
    this.level = 1; this.xp = 0;
    const home = gridToPx(...COMMANDER_HOME_CELL);
    this.x = home[0]; this.y = home[1];
    this.targetX = this.x; this.targetY = this.y;
    this.cooldown = 0; this.dead = false; this.respawnTimer = 0;
    this.slowTimer = 0; this.slowFactor = 0; this.stunTimer = 0;
    this.shieldHp = 0; this.dist = Infinity; this.auraTimer = 0;
  }
  get hasAura(){ return this.level>=3; }
  get auraRadiusPx(){ return 2.5*cellSize; }
  get damage(){ return COMMANDER_BASE.damage * (1 + 0.13*(this.level-1)); }
  get fireRate(){ return COMMANDER_BASE.fireRate * (1 + 0.09*(this.level-1)); }
  get range(){ return COMMANDER_BASE.range; }
  get xpToNext(){ return COMMANDER_BASE.xpPerLevel * this.level; }
  moveTo(x,y){ this.targetX=x; this.targetY=y; }
  gainXp(amount){
    if(this.level>=COMMANDER_BASE.maxLevel) return;
    this.xp += amount;
    while(this.xp >= this.xpToNext && this.level<COMMANDER_BASE.maxLevel){
      this.xp -= this.xpToNext; this.level++;
      this.maxHp = COMMANDER_BASE.hp*(1+0.18*(this.level-1));
      this.hp = this.maxHp;
      sfxLevelUp();
    }
  }
  takeDamage(dmg){
    if(this.dead) return false;
    this.hp -= dmg;
    if(this.hp<=0){ this.dead=true; this.respawnTimer=COMMANDER_BASE.respawnTime; sfxCommanderDown(); return true; }
    return false;
  }
  respawn(){
    this.dead=false; this.hp=this.maxHp;
    const home = gridToPx(...COMMANDER_HOME_CELL);
    this.x=home[0]; this.y=home[1]; this.targetX=this.x; this.targetY=this.y;
    sfxCommanderRespawn();
  }
  update(dt){
    if(this.dead){
      this.respawnTimer -= dt;
      if(this.respawnTimer<=0) this.respawn();
      return;
    }
    this.cooldown -= dt;
    let spd = COMMANDER_BASE.speed*cellSize;
    if(this.stunTimer>0){ this.stunTimer-=dt; spd=0; }
    else if(this.slowTimer>0){ this.slowTimer-=dt; spd*=(1-this.slowFactor); }
    const dx=this.targetX-this.x, dy=this.targetY-this.y, d=Math.hypot(dx,dy), step=spd*dt;
    if(d>step && d>0.01){ this.x += dx/d*step; this.y += dy/d*step; }
    else { this.x=this.targetX; this.y=this.targetY; }

    let target=null, bestD=this.range*cellSize;
    for(const t of towers){
      const dd = Math.hypot(t.x-this.x, t.y-this.y);
      if(dd<=bestD){ target=t; bestD=dd; }
    }
    if(target && this.cooldown<=0){
      this.cooldown = 1/this.fireRate;
      target.hp -= this.damage;
      sfxCommanderFire();
      effects.push({type:'chainline', x1:this.x,y1:this.y,x2:target.x,y2:target.y, life:0.15, maxLife:0.15, color:'#5599ff'});
      effects.push({type:'hit', x:target.x, y:target.y, life:0.2, maxLife:0.2, color:'#5599ff', r:16});
      if(target.hp<=0) this.gainXp(Math.round(22 + target.totalSpent*0.32));
    }

    if(this.hasAura){
      this.auraTimer -= dt;
      if(this.auraTimer<=0){
        this.auraTimer = 1.2;
        let healedAny=false;
        for(const e of enemies){ if(!e.dead && Math.hypot(e.x-this.x,e.y-this.y)<=this.auraRadiusPx){ e.hp=Math.min(e.maxHp, e.hp+e.maxHp*0.08); healedAny=true; } }
        if(healedAny) effects.push({type:'heal', x:this.x, y:this.y, life:0.4, maxLife:0.4, color:'#5599ff', r:this.auraRadiusPx});
      }
    }
  }
  draw(){
    if(this.dead) return;
    if(this.hasAura){
      ctx.save(); ctx.globalAlpha=0.08; ctx.fillStyle='#5599ff';
      ctx.beginPath(); ctx.arc(this.x,this.y,this.auraRadiusPx,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    const lvlScale = 1 + (this.level-1)*0.06;
    const img = loadImg('assets/commander.png');
    const s = cellSize*1.3*lvlScale;
    const tierColor = tierGlowColor(this.level, COMMANDER_BASE.maxLevel);
    if(tierColor) drawTierRing(this.x, this.y, s*0.56, tierColor);
    ctx.save(); ctx.translate(this.x,this.y);
    ctx.filter = tierSpriteFilter(this.level, COMMANDER_BASE.maxLevel);
    if(img.complete && img.naturalWidth) ctx.drawImage(img, -s/2, -s/2, s, s);
    ctx.filter = 'none';
    ctx.restore();
    const barW = cellSize*0.8;
    const barY = this.y - s*0.62;
    ctx.fillStyle='#000'; ctx.fillRect(this.x-barW/2, barY, barW, 6);
    ctx.fillStyle = this.hp/this.maxHp>0.4?'#5599ff':'#ff5555';
    ctx.fillRect(this.x-barW/2, barY, barW*Math.max(0,this.hp/this.maxHp), 6);
    ctx.fillStyle='#ffdd33'; ctx.font=`bold ${Math.max(10,Math.round(cellSize*0.32))}px sans-serif`; ctx.textAlign='center';
    ctx.fillText('Lv'+this.level, this.x, barY-4);
  }
}

// ===================== TOOLTIPS =====================
const tooltipEl = el('tooltip');
function attachTooltip(node, title, desc){
  node.addEventListener('mouseenter', ()=>{
    tooltipEl.innerHTML = `<b>${title}</b>${desc}`;
    tooltipEl.style.display = 'block';
  });
  node.addEventListener('mousemove', ev=>{
    const pad = 14;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    const maxW = 260, vw = window.innerWidth, vh = window.innerHeight;
    if(x + maxW > vw) x = ev.clientX - maxW - pad;
    if(y + 90 > vh) y = ev.clientY - 90 - pad;
    tooltipEl.style.left = x+'px'; tooltipEl.style.top = y+'px';
  });
  node.addEventListener('mouseleave', ()=>{ tooltipEl.style.display='none'; });
}

// ===================== SHOPS / UI =====================
function buildShops(){
  const towerShop = el('towerShop'); towerShop.innerHTML = '';
  Object.values(TOWER_TYPES).forEach(t=>{
    const btn = document.createElement('button');
    btn.className = 'shop-card'; btn.dataset.key = t.key;
    btn.innerHTML = `<img class="icon" src="assets/${t.key}.png"><div class="name">${t.name}</div><div class="cost">💰 ${t.cost}</div>`;
    btn.addEventListener('click', ()=>{
      if(phase!=='playing') return;
      selectedTowerType = selectedTowerType===t.key ? null : t.key;
      selectedTowerId = null; el('infoPanel').style.display='none';
      refreshShopStates();
    });
    attachTooltip(btn, t.name, t.desc);
    towerShop.appendChild(btn);
  });
  Object.values(DEFENSE_ABILITIES).forEach(a=>{
    const btn = document.createElement('button');
    btn.className = 'shop-card abilityItem'; btn.dataset.key = 'defAbility_'+a.key;
    const costLabel = a.cost>0 ? `💰 ${a.cost}` : '☢️ ONE-TIME';
    btn.innerHTML = `<div class="name">${a.name}</div><div class="cost">${costLabel}</div>`;
    btn.addEventListener('click', ()=> useDefenseAbility(a.key));
    attachTooltip(btn, a.name, a.desc);
    towerShop.appendChild(btn);
  });

  const monsterShop = el('monsterShop'); monsterShop.innerHTML = '';
  MONSTER_SHOP.forEach(key=>{
    const m = ENEMY_TYPES[key];
    const card = document.createElement('div');
    card.className = 'shop-card'; card.dataset.key = key; card.tabIndex = 0;
    card.innerHTML = `<img class="icon" src="assets/${key}.png"><div class="name">${m.name}</div><div class="cost">💰 ${m.cost}</div><button class="lvlBadge" data-key="${key}">Lv1 ▲</button>`;
    card.addEventListener('click', (ev)=>{
      if(ev.target.closest('.lvlBadge')) return;
      if(phase!=='playing') return;
      if(netMode==='remote'){ sendNet({type:'action', name:'spawnMonster', payload:{key}}); return; }
      if(offenseCoins < m.cost) return;
      offenseCoins -= m.cost; enemies.push(new Enemy(key,1));
      if(MONSTER_SPAWN_SFX[key]) MONSTER_SPAWN_SFX[key]();
    });
    const lvlBtn = card.querySelector('.lvlBadge');
    lvlBtn.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      if(phase!=='playing') return;
      if(netMode==='remote'){ sendNet({type:'action', name:'upgradeMonster', payload:{key}}); return; }
      upgradeMonsterLocal(key);
    });
    attachTooltip(card, m.name, m.desc);
    attachTooltip(lvlBtn, `${m.name} — Type Upgrade`, `Permanently boosts the HP, speed, and damage of every ${m.name} you spawn for the rest of the match. Gets pricier each tier — 3 tiers total.`);
    monsterShop.appendChild(card);
  });
  Object.values(ABILITIES).forEach(a=>{
    const btn = document.createElement('button');
    btn.className = 'shop-card abilityItem'; btn.dataset.key = 'ability_'+a.key;
    const costLabel = a.cost>0 ? `💰 ${a.cost}` : '☢️ ONE-TIME';
    btn.innerHTML = `<div class="name">${a.name}</div><div class="cost">${costLabel}</div>`;
    btn.addEventListener('click', ()=> useAbility(a.key, btn));
    attachTooltip(btn, a.name, a.desc);
    monsterShop.appendChild(btn);
  });
}
// Shared by both sides' Nuclear Bomb — the blast doesn't care who dropped it: every monster and
// the Commander die instantly, and every tower takes 50% of its own max HP in damage.
function detonateNuke(){
  towers.forEach(t=>{ t.hp -= t.maxHp*0.5; });
  enemies.forEach(e=>{ e.dead = true; e.hp = 0; });
  if(commander && !commander.dead){
    commander.dead = true; commander.hp = 0; commander.respawnTimer = COMMANDER_BASE.respawnTime;
    sfxCommanderDown();
  }
  effects.push({type:'flash', life:0.6, maxLife:0.6});
  effects.push({type:'hit', x:cellSize*GRID_COLS/2, y:cellSize*GRID_ROWS/2, life:0.5, maxLife:0.5, color:'#ffd23f', r:cellSize*GRID_COLS*0.55});
  sfxDestroyed();
}
// Starts the bomb-drop: a short falling animation plays first, and the actual blast (detonateNuke)
// fires when it lands — the visual and the real effect stay in sync for local and networked players.
function triggerNuke(){
  nukeFallTimer = NUKE_FALL_DURATION;
  effects.push({type:'bombfall', life:NUKE_FALL_DURATION, maxLife:NUKE_FALL_DURATION});
  beep(1300, NUKE_FALL_DURATION-0.05, 'sine', 0.16, 160);
}
function useAbilityLocal(key){
  if(phase!=='playing') return;
  if(key==='overclock'){
    if(offenseCoins < ABILITIES.overclock.cost) return;
    offenseCoins -= ABILITIES.overclock.cost; overclockTimer = 4;
  } else if(key==='medic'){
    if(offenseCoins < ABILITIES.medic.cost) return;
    offenseCoins -= ABILITIES.medic.cost;
    enemies.forEach(e=>{ if(!e.dead) e.hp = Math.min(e.maxHp, e.hp + e.maxHp*0.2); });
  } else if(key==='nuke'){
    if(nukeUsed) return;
    nukeUsed = true;
    triggerNuke();
  }
}
function useAbility(key){
  if(phase!=='playing') return;
  if(netMode==='remote') sendNet({type:'action', name:'useAbility', payload:{key}});
  else useAbilityLocal(key);
}
function useDefenseAbilityLocal(key){
  if(phase!=='playing') return;
  if(key==='medic'){
    if(defenseCoins < DEFENSE_ABILITIES.medic.cost) return;
    defenseCoins -= DEFENSE_ABILITIES.medic.cost;
    towers.forEach(t=>{ t.hp = Math.min(t.maxHp, t.hp + t.maxHp*0.2); });
  } else if(key==='nuke'){
    if(defenseNukeUsed) return;
    defenseNukeUsed = true;
    triggerNuke();
  }
}
function useDefenseAbility(key){
  if(phase!=='playing') return;
  if(netMode==='remote') sendNet({type:'action', name:'useDefenseAbility', payload:{key}});
  else useDefenseAbilityLocal(key);
}
function upgradeMonsterLocal(key){
  if(phase!=='playing') return;
  const cost = monsterUpgradeCost(key);
  if(cost===null || offenseCoins<cost) return;
  offenseCoins -= cost; monsterLevels[key] = (monsterLevels[key]||1)+1;
  sfxUpgrade();
}
function refreshShopStates(){
  document.querySelectorAll('#towerShop .shop-card:not(.abilityItem)').forEach(b=>{
    b.classList.toggle('selected', b.dataset.key===selectedTowerType);
    b.disabled = defenseCoins < TOWER_TYPES[b.dataset.key].cost;
  });
  const defMedicBtn = document.querySelector('[data-key="defAbility_medic"]');
  if(defMedicBtn) defMedicBtn.disabled = defenseCoins < DEFENSE_ABILITIES.medic.cost;
  const defNukeBtn = document.querySelector('[data-key="defAbility_nuke"]');
  if(defNukeBtn){
    defNukeBtn.disabled = defenseNukeUsed;
    const costEl = defNukeBtn.querySelector('.cost');
    if(costEl) costEl.textContent = defenseNukeUsed ? 'USED' : '☢️ ONE-TIME';
  }
  document.querySelectorAll('#monsterShop .shop-card:not(.abilityItem)').forEach(b=>{
    const key = b.dataset.key;
    b.classList.toggle('disabled', offenseCoins < ENEMY_TYPES[key].cost);
    const badge = b.querySelector('.lvlBadge');
    if(badge){
      const lvl = monsterLevels[key]||1;
      const cost = monsterUpgradeCost(key);
      if(cost===null){ badge.textContent = 'MAX'; badge.classList.add('maxed'); badge.classList.remove('disabled'); }
      else { badge.textContent = `Lv${lvl} ▲${cost}`; badge.classList.remove('maxed'); badge.classList.toggle('disabled', offenseCoins<cost); }
    }
  });
  const ocBtn = document.querySelector('[data-key="ability_overclock"]');
  if(ocBtn) ocBtn.disabled = offenseCoins < ABILITIES.overclock.cost;
  const mdBtn = document.querySelector('[data-key="ability_medic"]');
  if(mdBtn) mdBtn.disabled = offenseCoins < ABILITIES.medic.cost;
  const nukeBtn = document.querySelector('[data-key="ability_nuke"]');
  if(nukeBtn){
    nukeBtn.disabled = nukeUsed;
    const costEl = nukeBtn.querySelector('.cost');
    if(costEl) costEl.textContent = nukeUsed ? 'USED' : '☢️ ONE-TIME';
  }
}

// ---- input: defense canvas (place/select towers) ----
defCanvas.addEventListener('click', ev=>{
  if(phase!=='playing') return;
  const rect = defCanvas.getBoundingClientRect();
  const mx = ev.clientX-rect.left-offsetX1, my = ev.clientY-rect.top-offsetY1;
  const c = Math.floor(mx/cellSize), r = Math.floor(my/cellSize);
  const existing = towers.find(t=>t.c===c && t.r===r);
  if(existing){ selectedTowerId = existing.id; selectedTowerType=null; refreshShopStates(); showInfoPanel(); return; }
  if(selectedTowerType){
    if(pathCellSet.has(c+','+r)) return;
    if(c<0||r<0||c>=GRID_COLS||r>=GRID_ROWS) return;
    if(netMode==='remote'){
      sendNet({type:'action', name:'placeTower', payload:{towerType:selectedTowerType, c, r}});
      return;
    }
    const cost = TOWER_TYPES[selectedTowerType].cost;
    if(defenseCoins < cost) return;
    defenseCoins -= cost; towers.push(new Tower(selectedTowerType, c, r));
    sfxPlace();
    refreshShopStates();
  } else {
    selectedTowerId = null; el('infoPanel').style.display='none';
  }
});
let lastMouse = null;
defCanvas.addEventListener('mousemove', ev=>{ const rect=defCanvas.getBoundingClientRect(); lastMouse={x:ev.clientX-rect.left-offsetX1,y:ev.clientY-rect.top-offsetY1}; });

// ---- input: offense canvas (select or move the Commander) ----
offCanvas.addEventListener('click', ev=>{
  if(phase!=='playing' || !commander) return;
  const rect = offCanvas.getBoundingClientRect();
  const mx = ev.clientX-rect.left-offsetX2, my = ev.clientY-rect.top-offsetY2;
  if(mx<0||my<0||mx>cellSize*GRID_COLS||my>cellSize*GRID_ROWS) return;
  if(!commander.dead && Math.hypot(commander.x-mx, commander.y-my) < Math.max(cellSize*0.65, 24) && !commanderSelected){
    commanderSelected = true; showCommanderPanel();
    return;
  }
  if(netMode==='remote'){
    const [fx,fy] = toFrac(mx,my);
    sendNet({type:'action', name:'moveCommander', payload:{fx,fy}});
    return;
  }
  commander.moveTo(mx,my);
});

function showCommanderPanel(){
  if(!commanderSelected || !commander){ el('commanderPanel').style.display='none'; return; }
  el('commanderPanel').style.display='block';
  el('cmdLevel').textContent = commander.level+' / '+COMMANDER_BASE.maxLevel;
  el('cmdHp').textContent = commander.dead ? `respawning (${Math.ceil(commander.respawnTimer)}s)` : Math.round(commander.hp)+' / '+Math.round(commander.maxHp);
  el('cmdXp').textContent = commander.level>=COMMANDER_BASE.maxLevel ? 'MAX' : Math.round(commander.xp)+' / '+commander.xpToNext;
  const upBtn = el('commanderUpgradeBtn');
  if(commander.level>=COMMANDER_BASE.maxLevel){ upBtn.disabled=true; upBtn.innerHTML='MAX LEVEL'; }
  else {
    const cost = commanderUpgradeCost();
    upBtn.disabled = offenseCoins<cost || commander.dead;
    upBtn.innerHTML = `UPGRADE (💰${cost})`;
  }
}
function commanderUpgradeCost(){ return Math.round(45 + commander.level*35); }
el('commanderUpgradeBtn').addEventListener('click', ()=>{
  if(!commander || commander.dead || commander.level>=COMMANDER_BASE.maxLevel) return;
  if(netMode==='remote'){ sendNet({type:'action', name:'upgradeCommander', payload:{}}); return; }
  const cost = commanderUpgradeCost();
  if(offenseCoins<cost) return;
  offenseCoins -= cost;
  commander.gainXp(commander.xpToNext);
  sfxLevelUp();
  showCommanderPanel();
});

function showInfoPanel(){
  const t = towers.find(x=>x.id===selectedTowerId);
  if(!t){ el('infoPanel').style.display='none'; return; }
  el('infoPanel').style.display='block';
  el('infoName').textContent = t.def.name;
  el('infoLevel').textContent = t.level+' / 3';
  el('infoHp').textContent = Math.round(t.hp)+' / '+t.maxHp;
  el('infoDamage').textContent = Math.round(t.damage);
  const upCost = t.upgradeCost();
  const upBtn = el('upgradeBtn');
  if(upCost===null){ upBtn.disabled=true; upBtn.innerHTML='MAX'; }
  else { upBtn.disabled = defenseCoins<upCost; upBtn.innerHTML = `UP (💰${upCost})`; }
  el('sellValue').textContent = t.sellValue();
}
el('upgradeBtn').addEventListener('click', ()=>{
  const t = towers.find(x=>x.id===selectedTowerId); if(!t) return;
  if(netMode==='remote'){ sendNet({type:'action', name:'upgradeTower', payload:{id:t.id}}); return; }
  const cost = t.upgradeCost(); if(cost===null||defenseCoins<cost) return;
  defenseCoins -= cost; t.totalSpent += cost; t.level++; sfxUpgrade(); showInfoPanel();
});
el('sellBtn').addEventListener('click', ()=>{
  const t = towers.find(x=>x.id===selectedTowerId); if(!t) return;
  if(netMode==='remote'){ sendNet({type:'action', name:'sellTower', payload:{id:t.id}}); selectedTowerId=null; el('infoPanel').style.display='none'; return; }
  sfxSell();
  defenseCoins += t.sellValue(); towers = towers.filter(x=>x!==t);
  selectedTowerId=null; el('infoPanel').style.display='none';
});

// ===================== GAME FLOW / LOBBY =====================
el('localModeCard').addEventListener('click', ()=>{
  netMode = 'local'; myRole = null;
  el('startScreen').hidden = true;
  el('globalBar').hidden = false; el('defenseHalf').hidden = false; el('offenseHalf').hidden = false;
  document.getElementById('speedBtn').style.display = '';
  actx.resume && actx.resume();
  requestWakeLock();
  buildShops(); resize(); startMatch();
});
el('onlineModeCard').addEventListener('click', ()=>{
  el('modeRow').style.display = 'none';
  el('onlinePanel').style.display = 'flex';
});
el('backToModeBtn').addEventListener('click', ()=>{
  el('onlinePanel').style.display = 'none';
  el('modeRow').style.display = 'flex';
  el('onlineStatus').textContent = '';
});
let pickedRole = 'defense';
el('pickDefenseBtn').addEventListener('click', ()=>{ pickedRole='defense'; el('pickDefenseBtn').classList.add('selected'); el('pickOffenseBtn').classList.remove('selected'); });
el('pickOffenseBtn').addEventListener('click', ()=>{ pickedRole='offense'; el('pickOffenseBtn').classList.add('selected'); el('pickDefenseBtn').classList.remove('selected'); });

function randomRoomCode(){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<4;i++) s+=chars[Math.floor(Math.random()*chars.length)]; return s; }

el('createRoomBtn').addEventListener('click', async ()=>{
  const statusEl = el('onlineStatus');
  const code = randomRoomCode();
  el('roomCodeInput').value = code;
  netMode = 'host';
  statusEl.textContent = 'Connecting...';
  try{
    await connectRelay(code, pickedRole, statusEl);
    statusEl.textContent = `Room ${code} created. Waiting for the other player...\nTell them to open ${location.protocol}//${location.host} and join room ${code} as ${pickedRole==='defense'?'Offense':'Defense'}.`;
  }catch(e){ netMode='local'; }
});
el('joinRoomBtn').addEventListener('click', async ()=>{
  const statusEl = el('onlineStatus');
  const code = el('roomCodeInput').value.trim().toUpperCase();
  if(!code){ statusEl.textContent = 'Enter the room code first.'; return; }
  netMode = 'remote';
  statusEl.textContent = 'Connecting...';
  try{
    await connectRelay(code, pickedRole, statusEl);
  }catch(e){ netMode='local'; }
});

el('rematchBtn').addEventListener('click', ()=>{
  if(connectionLost){ returnToLobby(); return; }
  if(netMode==='remote'){ sendNet({type:'action', name:'requestRematch', payload:{}}); return; }
  startMatch(); // local or host: restart immediately, keeping the same room if online
});
el('leaveRoomBtn').addEventListener('click', returnToLobby);
el('speedBtn').addEventListener('click', ()=>{
  gameSpeedMult = gameSpeedMult===1 ? 2 : 1;
  el('speedBtn').textContent = gameSpeedMult+'x SPEED';
  el('speedBtn').classList.toggle('active', gameSpeedMult===2);
});
el('muteBtn').addEventListener('click', ()=>{
  setMuted(!muted);
  el('muteBtn').textContent = muted ? '🔇' : '🔊';
  el('muteBtn').classList.toggle('muted', muted);
});

function startMatch(){
  // Browsers can suspend the shared AudioContext (autoplay/power-saving policy) after a while;
  // a rematch doesn't go through the initial "start" click handlers that resume it, so every
  // match start — first one or a rematch — re-asserts it here instead of relying on the caller.
  if(!muted) actx.resume && actx.resume();
  defenseCoins=DEFENSE_START_COINS; offenseCoins=OFFENSE_START_COINS; lives=MAX_LIVES; timeLeft=MATCH_SECONDS;
  towers=[]; enemies=[]; projectiles=[]; effects=[];
  selectedTowerType=null; selectedTowerId=null; overclockTimer=0; nukeUsed=false; defenseNukeUsed=false; nukeFallTimer=0;
  commander = new Commander(); commanderSelected=false;
  Object.keys(ENEMY_TYPES).forEach(k=> monsterLevels[k]=1);
  el('infoPanel').style.display='none'; el('commanderPanel').style.display='none';
  el('gameOverOverlay').hidden = true; el('rematchBtn').textContent = 'REMATCH'; connectionLost=false;
  phase='playing';
  playMusic();
  refreshShopStates();
}

function endMatch(win, reason){
  phase='ended'; winner=win; winReason=reason;
  stopMusic();
  playSample(win==='defense' ? sfxVictoryAudio : sfxDefeatAudio);
  el('resultTitle').textContent = win==='defense' ? 'DEFENSE WINS!' : 'OFFENSE WINS!';
  el('resultTitle').style.color = win==='defense' ? '#3fae4a' : '#e74c3c';
  el('resultSub').textContent = reason;
  el('rematchBtn').textContent = 'REMATCH';
  el('leaveRoomBtn').style.display = (netMode==='local') ? 'none' : 'inline-block';
  connectionLost = false;
  el('gameOverOverlay').hidden = false;
}

// ===================== RENDER =====================
function drawTowerSprite(t){
  const img = loadImg(`assets/${t.type}.png`);
  const lvlScale = 1 + (t.level-1)*0.09;
  const s = cellSize*1.05*lvlScale;
  const tierColor = tierGlowColor(t.level, 3);
  if(tierColor) drawTierRing(t.x, t.y, cellSize*0.58*lvlScale, tierColor);
  ctx.save(); ctx.translate(t.x,t.y);
  ctx.fillStyle='#2a3140'; ctx.beginPath(); ctx.arc(0,0,cellSize*0.5*lvlScale,0,Math.PI*2); ctx.fill();
  ctx.rotate(t.angle+Math.PI/2);
  ctx.filter = tierSpriteFilter(t.level, 3);
  if(img.complete && img.naturalWidth) ctx.drawImage(img, -s/2, -s/2, s, s);
  ctx.filter = 'none';
  ctx.restore();
  const barW = cellSize*0.6;
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(t.x-barW/2, t.y-cellSize*0.62, barW, 4);
  ctx.fillStyle = t.hp/t.maxHp>0.4 ? '#5599dd' : '#ff5555';
  ctx.fillRect(t.x-barW/2, t.y-cellSize*0.62, barW*Math.max(0,t.hp/t.maxHp), 4);
  if(t.id===selectedTowerId){
    ctx.beginPath(); ctx.arc(t.x,t.y,t.rangePx,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=1.5; ctx.setLineDash([5,5]); ctx.stroke(); ctx.setLineDash([]);
  }
}

function drawBackground(dt){
  const theme = BATTLEFIELD_THEMES[battlefieldTheme];
  const gridW = cellSize*GRID_COLS, gridH = cellSize*GRID_ROWS;
  const g = ctx.createLinearGradient(0,0,0,gridH);
  g.addColorStop(0,theme.bgTop); g.addColorStop(0.35,theme.bgMid); g.addColorStop(1,theme.bgBottom);
  ctx.fillStyle=g; ctx.fillRect(0,0,gridW,gridH);
  for(let c=0;c<GRID_COLS;c++) for(let r=0;r<GRID_ROWS;r++){
    const isPath = pathCellSet.has(c+','+r);
    if(isPath){
      ctx.fillStyle=theme.pathColor; ctx.fillRect(c*cellSize,r*cellSize,cellSize,cellSize);
      ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=cellSize*0.12;
      ctx.beginPath(); ctx.moveTo(c*cellSize+cellSize*0.3,r*cellSize); ctx.lineTo(c*cellSize+cellSize*0.3,r*cellSize+cellSize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c*cellSize+cellSize*0.7,r*cellSize); ctx.lineTo(c*cellSize+cellSize*0.7,r*cellSize+cellSize); ctx.stroke();
    } else {
      ctx.fillStyle=(c+r)%2===0?theme.tileLight:theme.tileDark;
      ctx.fillRect(c*cellSize,r*cellSize,cellSize,cellSize);
    }
  }
  decorations.forEach(drawDecoration);
  smokeParticles.forEach(p=>{
    p.y -= p.spd*dt; p.x += Math.sin((p.phase+=dt))*p.drift*dt;
    if(p.y<-p.r){ p.y=gridH+p.r; p.x=Math.random()*gridW; }
    const rg = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);
    rg.addColorStop(0,'rgba(120,110,100,0.10)'); rg.addColorStop(1,'rgba(120,110,100,0)');
    ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  });
  if(selectedTowerType && lastMouse){
    const c = Math.floor(lastMouse.x/cellSize), r = Math.floor(lastMouse.y/cellSize);
    if(c>=0&&r>=0&&c<GRID_COLS&&r<GRID_ROWS && !pathCellSet.has(c+','+r)){
      const [px,py] = gridToPx(c,r);
      const rangePx = TOWER_TYPES[selectedTowerType].range*cellSize;
      ctx.beginPath(); ctx.arc(px,py,rangePx,0,Math.PI*2);
      ctx.fillStyle='rgba(120,180,255,0.12)'; ctx.fill();
      ctx.strokeStyle='rgba(120,180,255,0.6)'; ctx.lineWidth=1.5; ctx.setLineDash([5,4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle='rgba(120,180,255,0.35)'; ctx.fillRect(c*cellSize,r*cellSize,cellSize,cellSize);
    }
  }
}

function renderPass(targetCtx, rawDt, offX, offY){
  ctx = targetCtx;
  ctx.save();
  ctx.fillStyle = '#11151c'; ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
  ctx.translate(offX, offY);
  drawBackground(rawDt);
  towers.forEach(t=>drawTowerSprite(t));
  enemies.forEach(e=>e.draw());
  if(commander) commander.draw();
  projectiles.forEach(p=>p.draw());
  effects.forEach(ef=>{
    ctx.save(); ctx.globalAlpha = Math.max(0,ef.life/ef.maxLife);
    if(ef.type==='chainline'){ ctx.strokeStyle=ef.color; ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(ef.x1,ef.y1); ctx.lineTo(ef.x2,ef.y2); ctx.stroke(); }
    else if(ef.type==='flash'){ ctx.globalAlpha = Math.max(0,ef.life/ef.maxLife)*0.9; ctx.fillStyle='#fff'; ctx.fillRect(0,0,cellSize*GRID_COLS,cellSize*GRID_ROWS); }
    else if(ef.type==='bombfall'){
      ctx.globalAlpha = 1;
      const gridW = cellSize*GRID_COLS, gridH = cellSize*GRID_ROWS;
      const cx = gridW/2, cy = gridH/2;
      const progress = 1 - Math.max(0, ef.life/ef.maxLife);
      const eased = progress*progress; // accelerating fall
      const bombY = -cellSize*2.5 + (cy+cellSize*2.5)*eased;
      const bombSize = cellSize*(0.55+0.5*eased);
      ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 2.5; ctx.setLineDash([6,5]);
      ctx.globalAlpha = 0.5+0.4*Math.sin(progress*20);
      ctx.beginPath(); ctx.arc(cx, cy, cellSize*2.2*(1-eased*0.5), 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.35*eased;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(cx, cy, bombSize*0.55, bombSize*0.22, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = `${Math.round(bombSize)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💣', cx, bombY);
    }
    else if(ef.type==='heal'){ ctx.strokeStyle=ef.color; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(ef.x,ef.y, ef.r*(1-(ef.life/ef.maxLife)), 0, Math.PI*2); ctx.stroke(); }
    else { ctx.strokeStyle=ef.color; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(ef.x,ef.y, ef.r*(1-(ef.life/ef.maxLife)*0.5), 0, Math.PI*2); ctx.stroke(); }
    ctx.restore();
  });
  ctx.restore();
}

// ===================== MAIN LOOP =====================
let lastTime = performance.now();
function loop(now){
  requestAnimationFrame(loop);
  const rawDt = Math.min((now-lastTime)/1000, 0.05); lastTime = now;
  const dt = rawDt * gameSpeedMult;

  // Watchdog: try to reconnect instead of silently sitting frozen — a fresh WebSocket + the
  // relay's evict-on-join logic usually reseats us cleanly. Remote must watch specifically for
  // real snapshot data going quiet (lastSnapshotReceivedAt), NOT the generic heartbeat below —
  // a heartbeat can keep succeeding even when the actual 15Hz snapshot stream has stalled (e.g.
  // a proxy struggling with that data rate/size specifically), which would otherwise mask the
  // exact failure this is meant to catch. Host has no snapshot stream to watch, so it falls back
  // to the heartbeat-based lastPeerHeardAt.
  if(netMode==='remote' && inOnlineMatch && !reconnecting && now-lastSnapshotReceivedAt > SNAPSHOT_TIMEOUT_MS){
    attemptReconnect('Lost contact with the host — check your connection.');
  }
  if(netMode==='host' && inOnlineMatch && !reconnecting && now-lastPeerHeardAt > SNAPSHOT_TIMEOUT_MS){
    attemptReconnect('Lost contact with the other player — check your connection.');
  }
  // A lightweight heartbeat so the HOST also has a way to notice a dead remote — remote only
  // sends real traffic when the player acts, which could otherwise go quiet for a while with
  // nothing wrong. Cheap and role-agnostic; snapshots/actions already refresh lastPeerHeardAt too.
  if(inOnlineMatch && netMode!=='local' && now-lastHeartbeatSentAt > 2000){
    lastHeartbeatSentAt = now;
    sendNet({type:'hb'});
  }
  // Live connection-health readout, so a stalled game shows "why" instead of just sitting there —
  // if this climbs on the host's own screen, that device itself is the one going quiet (locked,
  // backgrounded, low power mode); if only the other player's climbs, the network is the culprit.
  if(netMode==='remote' || netMode==='host'){
    const stat = el('netStat');
    if(stat){
      if(reconnecting){
        stat.textContent = '🔄 reconnecting'; stat.classList.add('stale');
      } else {
        const secs = Math.max(0, (now - (netMode==='remote' ? lastSnapshotReceivedAt : lastSnapshotTime))/1000);
        const count = netMode==='remote' ? `rx:${snapshotsReceived}` : `tx:${snapshotsSent}`;
        stat.textContent = (secs<2 ? (netMode==='remote' ? '📡 synced' : '📡 broadcasting') : `📡 stalled ${secs.toFixed(0)}s`) + ` (${count})`;
        stat.classList.toggle('stale', secs>=2);
      }
    }
  }

  const simulate = phase==='playing' && netMode!=='remote';
  if(simulate){
    timeLeft -= dt;
    // Rubber-band: whichever side is flat-out poorer right now (raw coin mismatch) earns income
    // faster, independent of who's closer to winning — a side that's just broke gets help immediately.
    // (There's no more lives-based catchup: one breach ends the match outright, so there's no
    // gradual "losing" state to react to on defense's side the way there used to be.)
    const MONEY_CATCHUP_STRENGTH = 1.2;
    const coinPool = Math.max(1, offenseCoins+defenseCoins);
    const offenseShare = offenseCoins/coinPool, defenseShare = defenseCoins/coinPool;
    const offenseMoneyBonus = Math.max(0, 0.5-offenseShare)*2*MONEY_CATCHUP_STRENGTH;
    const defenseMoneyBonus = Math.max(0, 0.5-defenseShare)*2*MONEY_CATCHUP_STRENGTH;
    const offenseCatchup = Math.min(3, 1 + offenseMoneyBonus);
    const defenseCatchup = Math.min(3, 1 + defenseMoneyBonus);
    offenseCoins += OFFENSE_TRICKLE_PER_SEC*offenseCatchup*dt;
    defenseCoins += DEFENSE_TRICKLE_PER_SEC*defenseCatchup*dt;
    if(overclockTimer>0) overclockTimer -= dt;
    if(nukeFallTimer>0){ nukeFallTimer -= dt; if(nukeFallTimer<=0){ nukeFallTimer=0; detonateNuke(); } }

    towers.forEach(t=>t.update(dt));
    enemies.forEach(e=>e.update(dt));
    projectiles.forEach(p=>p.update(dt));
    if(commander) commander.update(dt);

    for(const t of towers){
      if(t.hp<=0){ effects.push({type:'hit', x:t.x, y:t.y, life:0.35, maxLife:0.35, color:'#ff3355', r:26}); sfxDestroyed(); if(t.id===selectedTowerId){ selectedTowerId=null; el('infoPanel').style.display='none'; } }
    }
    towers = towers.filter(t=>t.hp>0);
    enemies = enemies.filter(e=>!e.dead);
    projectiles = projectiles.filter(p=>!p.dead);
    effects.forEach(ef=>ef.life-=dt);
    effects = effects.filter(ef=>ef.life>0);

    el('defCoins').textContent = Math.round(defenseCoins);
    el('offCoins').textContent = Math.round(offenseCoins);
    const t = Math.max(0,timeLeft); const mm=Math.floor(t/60), ss=Math.floor(t%60);
    el('timerStat').textContent = `⏱ ${mm}:${ss.toString().padStart(2,'0')}`;
    refreshShopStates();
    if(selectedTowerId!=null) showInfoPanel();
    if(commanderSelected) showCommanderPanel();

    if(timeLeft<=0 && phase==='playing') endMatch('defense', 'The defense held the line — not a single breach.');
  }

  if(netMode==='host' && now-lastSnapshotTime > 1000/SNAPSHOT_HZ){
    lastSnapshotTime = now;
    snapshotsSent++;
    sendNet({type:'snapshot', data:buildSnapshot()});
  }

  if(netMode==='local' || netMode==='host'){
    renderPass(defCtx, rawDt, offsetX1, offsetY1);
    renderPass(offCtx, rawDt, offsetX2, offsetY2);
  } else if(myRole==='defense'){
    renderPass(defCtx, rawDt, offsetX1, offsetY1);
  } else if(myRole==='offense'){
    renderPass(offCtx, rawDt, offsetX2, offsetY2);
  }
}

requestAnimationFrame(loop);

// Mobile Safari (and some desktop browsers) can restore a page from the back/forward cache on
// "reload" instead of truly re-fetching and re-executing it — reviving whatever stale JS state
// (a dead `ws`, an old match, old code from before a fix) was in memory when it was last put away.
// A version bump in the script URL doesn't help here since the page was never re-requested at
// all. Forcing a real reload whenever a persisted/bfcache restore is detected guarantees every
// "reload" actually runs the current deployed code from a clean slate.
window.addEventListener('pageshow', (e)=>{ if(e.persisted) location.reload(); });
