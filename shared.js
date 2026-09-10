/* ============================================================
   shared.js — โค้ดกลางที่ใช้ร่วมกันทุกหน้า (index / host / screen / all-in-one)
   ต้องวางไฟล์นี้อยู่โฟลเดอร์เดียวกับไฟล์ .html ทั้งหมด
   ============================================================ */

const FIREBASE_URL = "https://reaction-time-multiplayer-default-rtdb.asia-southeast1.firebasedatabase.app/";

/** เรียก firebase.initializeApp() แบบกันเรียกซ้ำ (กัน error ถ้ามีการ include สคริปต์ผิดจังหวะ) */
function initFirebase() {
    if (!firebase.apps.length) {
        firebase.initializeApp({ databaseURL: FIREBASE_URL });
    }
    return firebase.database();
}

/** แปลงข้อความให้ปลอดภัยก่อนใส่ผ่าน innerHTML — กันคนตั้งชื่อเป็นโค้ด HTML/JS แล้วรันบนจอ host/จอใหญ่ */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = (str === null || str === undefined) ? '' : String(str);
    return div.innerHTML;
}

/**
 * รหัสประจำตัวผู้เล่น สุ่มครั้งเดียวแล้วเก็บถาวรใน localStorage ของเครื่อง/เบราว์เซอร์นั้น
 * ใช้แทนการใช้ "ชื่อ" เป็น Firebase key โดยตรง — แก้ปัญหาชื่อซ้ำทับกัน และเปลี่ยนชื่อแล้วโดนเตะออกเอง
 */
function getOrCreatePlayerId() {
    let id = localStorage.getItem('rt_player_id');
    if (!id) {
        id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('rt_player_id', id);
    }
    return id;
}

/** ตัวช่วยเล่นเสียง beep พร้อมระบบ "ปลดล็อกเสียง" ที่ต้องมี user gesture ก่อน (เบราว์เซอร์บล็อก autoplay) */
function createBeeper() {
    let audioCtx = null;
    function ensureCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
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
                // เสียงเล่นไม่ได้ไม่ควรทำให้เกมพัง แค่เงียบไปเฉยๆ
                console.warn('เล่นเสียงไม่สำเร็จ:', err);
            }
        }
    };
}

/** เรียงลำดับผู้เล่นสำหรับ leaderboard: OK เรียงตามเวลาน้อยไปมาก, ที่เหลือไปท้าย */
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

/**
 * ตัวควบคุมแอนิเมชันไฟ 5 ดวง — ใช้ร่วมกันระหว่าง screen.html และ all-in-one.html
 * กันปัญหา requestAnimationFrame ค้าง/ซ้อนกันเวลา gameState อัปเดตถี่ๆ
 */
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
                    if (!isGoPlayed) {
                        beeper.play(880, 'sine', 0.3);
                        isGoPlayed = true;
                    }
                } else {
                    let activeCount = Math.min(5, Math.floor(elapsed / 1000) + 1);
                    if (activeCount < 1) activeCount = 1;

                    lights.forEach((l, idx) => {
                        l.className = idx < activeCount ? 'light red' : 'light';
                    });

                    if (activeCount > currentLights && activeCount <= 5) {
                        beeper.play(440, 'square', 0.15);
                        currentLights = activeCount;
                    }
                }
            } else if (data.state === 'MANUAL_GO') {
                lights.forEach(l => l.className = 'light');
                if (!isGoPlayed) {
                    beeper.play(880, 'sine', 0.3);
                    isGoPlayed = true;
                }
            }

            animFrame = requestAnimationFrame(tick);
        }
        tick();
    }

    return { run, resetLights, stop };
}
