/* ============================================================
   shared.js — โค้ดกลางที่ใช้ร่วมกันทุกหน้า (index / host / screen / all-in-one)
   ต้องวางไฟล์นี้อยู่โฟลเดอร์เดียวกับไฟล์ .html ทั้งหมด
   ============================================================ */

const FIREBASE_URL = "https://reaction-time-multiplayer-default-rtdb.asia-southeast1.firebasedatabase.app/";

/** เรียก firebase.initializeApp() แบบกันเรียกซ้ำ */
function initFirebase() {
    if (!firebase.apps.length) {
        firebase.initializeApp({ databaseURL: FIREBASE_URL });
    }
    return firebase.database();
}

/** แปลงข้อความให้ปลอดภัยก่อนใส่ผ่าน innerHTML */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = (str === null || str === undefined) ? '' : String(str);
    return div.innerHTML;
}

/** รหัสประจำตัวผู้เล่น สุ่มครั้งเดียวแล้วเก็บถาวรใน localStorage ของเครื่องนั้น */
function getOrCreatePlayerId() {
    let id = localStorage.getItem('rt_player_id');
    if (!id) {
        id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('rt_player_id', id);
    }
    return id;
}

/* ============================================================
   Toast / Snackbar — แทน alert() ของเบราว์เซอร์ที่ดูหลุดธีม
   ============================================================ */
function ensureToastContainer() {
    let c = document.getElementById('toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'toast-container';
        document.body.appendChild(c);
    }
    return c;
}
function showToast(message, type = 'info', duration = 3200) {
    const c = ensureToastContainer();
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = message;
    c.appendChild(t);
    setTimeout(() => {
        t.classList.add('hide');
        setTimeout(() => t.remove(), 220);
    }, duration);
}

/* ============================================================
   Loading overlay — กันช่วงว่างเปล่าตอนรอ Firebase เชื่อมต่อครั้งแรก
   ============================================================ */
function showLoadingOverlay(message) {
    let el = document.getElementById('loading-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'loading-overlay';
        el.className = 'loading-overlay';
        el.innerHTML = '<div class="spinner"></div><div id="loading-message"></div>';
        document.body.appendChild(el);
    }
    document.getElementById('loading-message').textContent = message || 'กำลังเชื่อมต่อ...';
    el.style.display = 'flex';
}
function hideLoadingOverlay() {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = 'none';
}

/* ============================================================
   เสียง — พร้อมระบบปลดล็อกที่ต้องมี user gesture ก่อน
   ============================================================ */
function createBeeper() {
    let audioCtx = null;
    function ensureCtx() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }
    return {
        unlock() { ensureCtx(); },
        play(freq = 440, type = 'sine', duration = 0.15) {
            try {
                const ctx = ensureCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = type;
                osc.frequency.value = freq;
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
                osc.stop(ctx.currentTime + duration);
            } catch (err) {
                console.warn('เล่นเสียงไม่สำเร็จ:', err);
            }
        }
    };
}

/** เสียงกลองรัวก่อนเผยผล — สังเคราะห์เองล้วนๆ ไม่ต้องพึ่งไฟล์เสียงภายนอก ไม่มีปัญหาลิขสิทธิ์ */
function playDrumroll(beeperInstance, durationMs = 1200) {
    const clicksCount = 18;
    for (let i = 0; i < clicksCount; i++) {
        const t = Math.pow(i / clicksCount, 1.6) * durationMs; // เร่งจังหวะถี่ขึ้นเรื่อยๆ เหมือนกลองรัว
        setTimeout(() => beeperInstance.play(180 + Math.random() * 40, 'square', 0.04), t);
    }
    setTimeout(() => {
        beeperInstance.play(90, 'sawtooth', 0.5);   // เสียงตูมปิดท้าย
        beeperInstance.play(1200, 'triangle', 0.3); // เสียงประกาย
    }, durationMs + 80);
}

/* ============================================================
   การสั่น — ผู้เล่นปิดเองได้ (ไม่ชอบ) / host ปิดรวมได้ (ความเท่าเทียม)
   ============================================================ */
function tryVibrate(pattern, globalEnabled) {
    if (globalEnabled === false) return; // host ปิดไว้เพื่อความเท่าเทียมของทุกคน
    const pref = localStorage.getItem('rt_vibration_pref');
    const personalOn = pref === null ? true : pref === 'true';
    if (!personalOn) return;
    if (navigator.vibrate) {
        try { navigator.vibrate(pattern); } catch (e) { /* บางเบราว์เซอร์ไม่รองรับ ไม่ต้องทำอะไร */ }
    }
}
function getVibrationPref() {
    const pref = localStorage.getItem('rt_vibration_pref');
    return pref === null ? true : pref === 'true';
}
function setVibrationPref(on) {
    localStorage.setItem('rt_vibration_pref', on ? 'true' : 'false');
}

/* ============================================================
   Label ความไวแบบสนุกๆ ตามเวลาที่ทำได้
   ============================================================ */
const SPEED_LABELS = [
    { max: 200, emoji: '⚡', text: 'สายฟ้าแลบ!' },
    { max: 300, emoji: '🔥', text: 'ยอดเยี่ยม!' },
    { max: 450, emoji: '👍', text: 'ดีมาก!' },
    { max: 650, emoji: '🙂', text: 'ใช้ได้เลย!' },
    { max: Infinity, emoji: '🐢', text: 'ฝึกอีกนิดนะ' }
];
function getSpeedLabel(ms) {
    return SPEED_LABELS.find(l => ms <= l.max);
}

/* ============================================================
   Avatar / สีประจำตัว — เลือกตอนเข้าร่วม
   ============================================================ */
const AVATAR_OPTIONS = ['🦊', '🐱', '🐼', '🦁', '🐸', '🐵', '🦄', '🐯', '🐨', '🐰'];
const COLOR_OPTIONS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e84393'];

/* ============================================================
   ผู้เล่น: จัดเรียง / หาอันดับ
   ============================================================ */
function sortPlayersForLeaderboard(playersObj) {
    const list = Object.keys(playersObj || {}).map(id => Object.assign({ id }, playersObj[id]));
    list.sort((a, b) => {
        if (a.status === 'OK' && b.status === 'OK') return a.time - b.time;
        if (a.status === 'OK') return -1;
        if (b.status === 'OK') return 1;
        return 0;
    });
    return list;
}
function computeMyRank(playersObj, myId) {
    const list = sortPlayersForLeaderboard(playersObj).filter(p => p.status === 'OK');
    const idx = list.findIndex(p => p.id === myId);
    return idx === -1 ? null : idx + 1;
}

/** จัดกลุ่มผู้เล่นเป็นทีม พร้อมคำนวณเวลาเฉลี่ย/ดีที่สุดของแต่ละทีม (สำหรับโหมดทีม) */
function computeTeamRankings(playersObj) {
    const teams = {};
    Object.values(playersObj || {}).forEach(p => {
        const teamName = (p.team || '').trim() || 'ไม่มีทีม';
        if (!teams[teamName]) teams[teamName] = { team: teamName, members: [], okTimes: [] };
        teams[teamName].members.push(p);
        if (p.status === 'OK') teams[teamName].okTimes.push(p.time);
    });
    const teamList = Object.values(teams).map(t => ({
        team: t.team,
        members: t.members,
        okCount: t.okTimes.length,
        avgTime: t.okTimes.length ? Math.round(t.okTimes.reduce((a, b) => a + b, 0) / t.okTimes.length) : null,
        bestTime: t.okTimes.length ? Math.min(...t.okTimes) : null
    }));
    teamList.sort((a, b) => {
        if (a.avgTime !== null && b.avgTime !== null) return a.avgTime - b.avgTime;
        if (a.avgTime !== null) return -1;
        if (b.avgTime !== null) return 1;
        return 0;
    });
    return teamList;
}

/* ============================================================
   QR Code — ลิงก์เข้าร่วมเกม (ต้องมีสคริปต์ qrcode.min.js ในหน้านั้นด้วย)
   ============================================================ */
function getJoinUrl() {
    return new URL('index.html', window.location.href).href;
}
function renderQrCode(containerId, size = 180) {
    const el = document.getElementById(containerId);
    if (!el || typeof QRCode === 'undefined') return;
    el.innerHTML = '';
    new QRCode(el, { text: getJoinUrl(), width: size, height: size, colorDark: '#000000', colorLight: '#ffffff' });
}

/* ============================================================
   Confetti ตอนประกาศผล (ต้องมีสคริปต์ canvas-confetti ในหน้านั้นด้วย)
   ============================================================ */
function fireConfettiSafe() {
    if (typeof confetti === 'function') {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
        setTimeout(() => confetti({ particleCount: 70, spread: 110, origin: { y: 0.4 } }), 250);
    }
}

/* ============================================================
   Fullscreen API
   ============================================================ */
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
}

/* ============================================================
   ตัวควบคุมแอนิเมชันไฟ 5 ดวง — ใช้ร่วมกันระหว่าง screen.html และ all-in-one.html
   ============================================================ */
function createLightSequencer(lights, beeper, getServerNow) {
    let currentLights = 0;
    let isGoPlayed = false;
    let animFrame = null;

    function stop() {
        if (animFrame) cancelAnimationFrame(animFrame);
        animFrame = null;
    }
    function resetLights() {
        stop();
        currentLights = 0;
        isGoPlayed = false;
        lights.forEach(l => l.className = 'light');
    }
    function run(data) {
        stop();
        currentLights = 0;
        isGoPlayed = false;

        function tick() {
            const now = getServerNow();
            if (data.state === 'STARTING') {
                const elapsed = now - data.startTime;
                if (elapsed < 0) {
                    lights.forEach(l => l.className = 'light');
                } else if (data.mode === 'AUTO' && data.goTime > 0 && now >= data.goTime) {
                    lights.forEach(l => l.className = 'light');
                    if (!isGoPlayed) { beeper.play(880, 'sine', 0.3); isGoPlayed = true; }
                } else {
                    let activeCount = Math.min(5, Math.floor(elapsed / 1000) + 1);
                    if (activeCount < 1) activeCount = 1;
                    lights.forEach((l, idx) => { l.className = idx < activeCount ? 'light red' : 'light'; });
                    if (activeCount > currentLights && activeCount <= 5) {
                        beeper.play(440, 'square', 0.15);
                        currentLights = activeCount;
                    }
                }
            } else if (data.state === 'MANUAL_GO') {
                lights.forEach(l => l.className = 'light');
                if (!isGoPlayed) { beeper.play(880, 'sine', 0.3); isGoPlayed = true; }
            }
            animFrame = requestAnimationFrame(tick);
        }
        tick();
    }
    return { run, resetLights, stop };
}

/* ============================================================
   Leaderboard + Podium reveal (สไตล์ Kahoot: 3 → 2 → 1 แล้วค่อยขึ้นตารางที่เหลือ)
   รองรับทั้งโหมดรายบุคคลและโหมดทีม
   ใช้ร่วมกันระหว่าง screen.html และ all-in-one.html
   ============================================================ */
function createLeaderboardController({ podiumRowEl, tableBodyEl, beeper }) {

    function medalFor(rank) {
        return rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
    }
    function nameWithAvatar(p) {
        return (p.avatar ? p.avatar + ' ' : '') + (p.name || '(ไม่มีชื่อ)');
    }

    function renderPodiumBlock(p, rank) {
        const block = document.createElement('div');
        block.className = 'podium-block podium-rank-' + rank;
        block.dataset.playerId = p.id; // เก็บ id ไว้ใช้ sync ชื่อทีหลัง ถ้า host เปลี่ยนชื่อหลัง podium ขึ้นจอไปแล้ว
        const medal = document.createElement('div');
        medal.className = 'podium-medal';
        medal.textContent = medalFor(rank);
        const name = document.createElement('div');
        name.className = 'podium-name';
        name.textContent = nameWithAvatar(p);
        if (p.color) name.style.color = p.color;
        const time = document.createElement('div');
        time.className = 'podium-time';
        time.textContent = p.time + ' ms';
        const bar = document.createElement('div');
        bar.className = 'podium-bar podium-bar-' + rank;
        bar.textContent = rank;
        block.appendChild(medal); block.appendChild(name); block.appendChild(time); block.appendChild(bar);
        podiumRowEl.appendChild(block);
    }

    function renderRestTable(list, startRank, animate) {
        tableBodyEl.innerHTML = '';
        list.forEach((p, i) => {
            const rank = startRank + i;
            const isFoul = p.status !== 'OK';
            const tr = document.createElement('tr');
            tr.className = 'leaderboard-row' + (isFoul ? ' foul' : '') + (animate ? ' row-animate' : '');
            if (animate) tr.style.animationDelay = (i * 60) + 'ms';

            const rankTd = document.createElement('td');
            rankTd.className = 'rank';
            rankTd.textContent = isFoul ? '-' : rank;

            const nameTd = document.createElement('td');
            nameTd.textContent = nameWithAvatar(p);
            if (p.color) nameTd.style.color = p.color;

            const timeTd = document.createElement('td');
            timeTd.className = 'time-col';
            let timeDisplay = 'WAITING...';
            if (p.status === 'OK') timeDisplay = `${p.time} ms`;
            else if (p.status === 'JUMP_START') timeDisplay = '❌ JUMP START';
            else if (p.status === 'LOCKED') timeDisplay = '🔒 รอรอบถัดไป';
            else if (p.status === 'ELIMINATED') timeDisplay = '❌ ถูกคัดออก';
            else if (p.status === 'PRACTICE') timeDisplay = '🎯 กำลังฝึกซ้อม';
            timeTd.textContent = timeDisplay;

            tr.appendChild(rankTd); tr.appendChild(nameTd); tr.appendChild(timeTd);
            tableBodyEl.appendChild(tr);
        });
    }

    /** เรียกครั้งเดียวตอนเปลี่ยนมาที่หน้า LEADERBOARD (ไม่ใช่ทุกครั้งที่ players/ อัปเดตขณะอยู่หน้านี้อยู่แล้ว) */
    function reveal(playersObj, mode) {
        const list = sortPlayersForLeaderboard(playersObj);
        const top3 = list.filter(p => p.status === 'OK').slice(0, 3);
        const top3Ids = new Set(top3.map(p => p.id));
        const rest = list.filter(p => !top3Ids.has(p.id));
        const restStartRank = top3.length + 1;

        podiumRowEl.innerHTML = '';
        tableBodyEl.innerHTML = '';

        if (mode !== 'ANIMATED' || top3.length === 0) {
            // โหมดตารางทันที — เพื่อความรวดเร็ว ไม่ต้องรอทีละคน
            top3.forEach((p, i) => renderPodiumBlock(p, i + 1));
            renderRestTable(rest, restStartRank, true);
            if (top3.length) fireConfettiSafe();
            return;
        }

        // โหมดอนิเมชันสไตล์ Kahoot: กลองรัวก่อน แล้วเผยอันดับ 3 → 2 → 1 ทีละคน แล้วค่อยโชว์ตารางที่เหลือ
        playDrumroll(beeper);
        const revealOrder = [3, 2, 1].filter(r => top3[r - 1]);
        const startDelay = 1400;
        revealOrder.forEach((rank, seq) => {
            setTimeout(() => {
                renderPodiumBlock(top3[rank - 1], rank);
                beeper.play(rank === 1 ? 880 : 600, 'sine', 0.25);
                if (rank === 1) fireConfettiSafe();
            }, startDelay + seq * 900);
        });
        setTimeout(() => renderRestTable(rest, restStartRank, true), startDelay + revealOrder.length * 900 + 400);
    }

    /** sync ชื่อ/เวลาบน podium ที่ขึ้นจอไปแล้ว ให้ตรงกับข้อมูลล่าสุด */
    function syncPodiumWithPlayers(playersObj) {
        const blocks = podiumRowEl.querySelectorAll('.podium-block');
        blocks.forEach(block => {
            const id = block.dataset.playerId;
            const p = playersObj[id];
            if (!p) return;
            const nameEl = block.querySelector('.podium-name');
            const timeEl = block.querySelector('.podium-time');
            const expectedName = nameWithAvatar(p);
            if (nameEl && nameEl.textContent !== expectedName) nameEl.textContent = expectedName;
            const newTimeText = p.time + ' ms';
            if (timeEl && timeEl.textContent !== newTimeText) timeEl.textContent = newTimeText;
        });
    }

    /** อัปเดตตารางที่เหลือ + sync ชื่อบน podium โดยไม่เล่นอนิเมชัน podium ใหม่ */
    function refreshTableOnly(playersObj) {
        const list = sortPlayersForLeaderboard(playersObj);
        const shownTop3 = podiumRowEl.children.length;
        renderRestTable(list.slice(shownTop3), shownTop3 + 1, false);
        syncPodiumWithPlayers(playersObj);
    }

    /* ---------- โหมดทีม ---------- */
    function renderTeamPodiumBlock(t, rank) {
        const block = document.createElement('div');
        block.className = 'podium-block podium-rank-' + rank;
        block.dataset.team = t.team;
        const medal = document.createElement('div');
        medal.className = 'podium-medal';
        medal.textContent = medalFor(rank);
        const name = document.createElement('div');
        name.className = 'podium-name';
        name.textContent = `🏷️ ${t.team}`;
        const time = document.createElement('div');
        time.className = 'podium-time';
        time.textContent = t.avgTime !== null ? `เฉลี่ย ${t.avgTime} ms` : 'ยังไม่มีผล';
        const bar = document.createElement('div');
        bar.className = 'podium-bar podium-bar-' + rank;
        bar.textContent = rank;
        block.appendChild(medal); block.appendChild(name); block.appendChild(time); block.appendChild(bar);
        podiumRowEl.appendChild(block);
    }
    function renderTeamRestTable(teamList, startRank, animate) {
        tableBodyEl.innerHTML = '';
        teamList.forEach((t, i) => {
            const rank = startRank + i;
            const tr = document.createElement('tr');
            tr.className = 'leaderboard-row' + (animate ? ' row-animate' : '');
            if (animate) tr.style.animationDelay = (i * 60) + 'ms';
            const rankTd = document.createElement('td');
            rankTd.className = 'rank';
            rankTd.textContent = rank;
            const nameTd = document.createElement('td');
            nameTd.textContent = `🏷️ ${t.team} (${t.members.length} คน)`;
            const timeTd = document.createElement('td');
            timeTd.className = 'time-col';
            timeTd.textContent = t.avgTime !== null ? `เฉลี่ย ${t.avgTime} ms` : 'ยังไม่มีผล';
            tr.appendChild(rankTd); tr.appendChild(nameTd); tr.appendChild(timeTd);
            tableBodyEl.appendChild(tr);
        });
    }
    function revealTeams(playersObj, mode) {
        const teamList = computeTeamRankings(playersObj);
        const top3 = teamList.slice(0, 3).filter(t => t.avgTime !== null);
        const top3Names = new Set(top3.map(t => t.team));
        const rest = teamList.filter(t => !top3Names.has(t.team));
        const restStartRank = top3.length + 1;

        podiumRowEl.innerHTML = '';
        tableBodyEl.innerHTML = '';

        if (mode !== 'ANIMATED' || top3.length === 0) {
            top3.forEach((t, i) => renderTeamPodiumBlock(t, i + 1));
            renderTeamRestTable(rest, restStartRank, true);
            if (top3.length) fireConfettiSafe();
            return;
        }

        playDrumroll(beeper);
        const revealOrder = [3, 2, 1].filter(r => top3[r - 1]);
        const startDelay = 1400;
        revealOrder.forEach((rank, seq) => {
            setTimeout(() => {
                renderTeamPodiumBlock(top3[rank - 1], rank);
                beeper.play(rank === 1 ? 880 : 600, 'sine', 0.25);
                if (rank === 1) fireConfettiSafe();
            }, startDelay + seq * 900);
        });
        setTimeout(() => renderTeamRestTable(rest, restStartRank, true), startDelay + revealOrder.length * 900 + 400);
    }
    function refreshTeamTableOnly(playersObj) {
        const teamList = computeTeamRankings(playersObj);
        const shownTop3 = podiumRowEl.children.length;
        renderTeamRestTable(teamList.slice(shownTop3), shownTop3 + 1, false);
        const blocks = podiumRowEl.querySelectorAll('.podium-block');
        blocks.forEach((block) => {
            const t = teamList.find(x => x.team === block.dataset.team);
            if (!t) return;
            const timeEl = block.querySelector('.podium-time');
            if (timeEl) timeEl.textContent = t.avgTime !== null ? `เฉลี่ย ${t.avgTime} ms` : 'ยังไม่มีผล';
        });
    }

    return { reveal, refreshTableOnly, syncPodiumWithPlayers, revealTeams, refreshTeamTableOnly };
}
