// Liman Bulmaca Oyunu - Manuel Gönderim + Strateji Versiyonu

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// roundRect polyfill (eski tarayıcılar için)
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (typeof r === 'number') r = [r, r, r, r];
        const [tl, tr, br, bl] = r;
        this.beginPath();
        this.moveTo(x + tl, y);
        this.lineTo(x + w - tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + tr);
        this.lineTo(x + w, y + h - br);
        this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        this.lineTo(x + bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - bl);
        this.lineTo(x, y + tl);
        this.quadraticCurveTo(x, y, x + tl, y);
        this.closePath();
        return this;
    };
}

// Tum Renkler
const ALL_COLORS = {
    RED: { main: '#e74c3c', light: '#ec7063', dark: '#c0392b', name: 'Kirmizi' },
    BLUE: { main: '#3498db', light: '#5dade2', dark: '#2980b9', name: 'Mavi' },
    GREEN: { main: '#2ecc71', light: '#58d68d', dark: '#27ae60', name: 'Yesil' },
    YELLOW: { main: '#f1c40f', light: '#f4d03f', dark: '#d4ac0d', name: 'Sari' },
    PURPLE: { main: '#9b59b6', light: '#a569bd', dark: '#7d3c98', name: 'Mor' }
};

// Temel Oyun Ayarlari
const BASE_CONTAINER_WIDTH = 80;
const BASE_CONTAINER_HEIGHT = 50;
const GROUND_HEIGHT = 120;
const MAX_STACK = 4;
const QUEUE_SIZE = 3;

// Dinamik değerler (seviyeye göre değişir)
let SLOT_COUNT = 4;
let CONTAINER_WIDTH = 80;
let CONTAINER_HEIGHT = 50;
let SLOT_GAP = 20;

// Seviye Ayarlari
const LEVEL_CONFIG = {
    1: { colors: ['RED', 'BLUE'], slots: 4, shipsToComplete: 1, containersPerColor: 3, maxRequest: 2, scale: 1.0 },
    2: { colors: ['RED', 'BLUE'], slots: 4, shipsToComplete: 2, containersPerColor: 3, maxRequest: 2, scale: 1.0 },
    3: { colors: ['RED', 'BLUE', 'GREEN'], slots: 4, shipsToComplete: 2, containersPerColor: 3, maxRequest: 3, scale: 1.0 },
    4: { colors: ['RED', 'BLUE', 'GREEN'], slots: 5, shipsToComplete: 2, containersPerColor: 3, maxRequest: 3, scale: 0.95 },
    5: { colors: ['RED', 'BLUE', 'GREEN', 'YELLOW'], slots: 5, shipsToComplete: 3, containersPerColor: 3, maxRequest: 3, scale: 0.9 },
    6: { colors: ['RED', 'BLUE', 'GREEN', 'YELLOW'], slots: 5, shipsToComplete: 4, containersPerColor: 4, maxRequest: 4, scale: 0.9 },
    7: { colors: ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE'], slots: 6, shipsToComplete: 5, containersPerColor: 4, maxRequest: 4, scale: 0.85 },
    8: { colors: ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE'], slots: 6, shipsToComplete: 6, containersPerColor: 4, maxRequest: 5, scale: 0.8 },
    9: { colors: ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE'], slots: 7, shipsToComplete: 7, containersPerColor: 4, maxRequest: 5, scale: 0.75 },
    10: { colors: ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE'], slots: 8, shipsToComplete: 8, containersPerColor: 5, maxRequest: 6, scale: 0.7 },
};

// Oyun Durumu
let gameState = {
    score: 0,
    level: 1,
    shipsInLevel: 0,
    totalShipsCompleted: 0,
    slots: [],
    ship: null,
    shipQueue: [], // Gelecek gemiler
    draggedContainer: null,
    dragStartSlot: null,
    dragStartPos: null,
    dragCurrentPos: null,
    particles: [],
    confetti: [],
    highlightedSlot: null,
    highlightedShip: false,
    gamePhase: 'playing',
    message: null,
    messageTimer: 0,
    combo: 0,
    lastDeliveryTime: 0
};

// Ses Sistemi
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
}

function playSound(type) {
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    switch(type) {
        case 'pickup':
            oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.1);
            break;
        case 'drop':
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.15);
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.15);
            break;
        case 'load':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.15);
            break;
        case 'horn':
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(180, audioCtx.currentTime);
            oscillator.frequency.setValueAtTime(200, audioCtx.currentTime + 0.5);
            oscillator.frequency.setValueAtTime(180, audioCtx.currentTime + 1);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 1.5);
            break;
        case 'error':
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
            oscillator.frequency.setValueAtTime(150, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.2);
            break;
        case 'combo':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523, audioCtx.currentTime);
            oscillator.frequency.setValueAtTime(659, audioCtx.currentTime + 0.08);
            oscillator.frequency.setValueAtTime(784, audioCtx.currentTime + 0.16);
            oscillator.frequency.setValueAtTime(1047, audioCtx.currentTime + 0.24);
            gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.4);
            break;
        case 'levelup':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
            oscillator.frequency.setValueAtTime(554, audioCtx.currentTime + 0.15);
            oscillator.frequency.setValueAtTime(659, audioCtx.currentTime + 0.3);
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.45);
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.8);
            break;
    }
}

// Canvas Boyutlandirma
function resizeCanvas() {
    const container = document.getElementById('game-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

// Seviye Ayarlarini Al
function getLevelConfig(level) {
    const maxLevel = Object.keys(LEVEL_CONFIG).length;
    if (level <= maxLevel) {
        return LEVEL_CONFIG[level];
    }
    const baseConfig = LEVEL_CONFIG[maxLevel];
    const extraLevels = level - maxLevel;
    return {
        colors: baseConfig.colors,
        slots: Math.min(9, baseConfig.slots + Math.floor(extraLevels / 2)),
        shipsToComplete: baseConfig.shipsToComplete + Math.floor(extraLevels / 2),
        containersPerColor: Math.min(5, baseConfig.containersPerColor + Math.floor(extraLevels / 3)),
        maxRequest: Math.min(5, baseConfig.maxRequest + Math.floor(extraLevels / 4)),
        scale: Math.max(0.5, baseConfig.scale - extraLevels * 0.03)
    };
}

// Seviye parametrelerini uygula
function applyLevelConfig() {
    const config = getLevelConfig(gameState.level);
    SLOT_COUNT = config.slots;
    CONTAINER_WIDTH = Math.floor(BASE_CONTAINER_WIDTH * config.scale);
    CONTAINER_HEIGHT = Math.floor(BASE_CONTAINER_HEIGHT * config.scale);
    SLOT_GAP = Math.floor(20 * config.scale);
}

// Slot Sinifi
class Slot {
    constructor(index) {
        this.index = index;
        this.containers = [];
    }

    getX() {
        const totalWidth = SLOT_COUNT * CONTAINER_WIDTH + (SLOT_COUNT - 1) * SLOT_GAP;
        const startX = (canvas.width - 300 - totalWidth) / 2;
        return startX + this.index * (CONTAINER_WIDTH + SLOT_GAP);
    }

    getY() {
        return canvas.height - GROUND_HEIGHT;
    }

    getTopContainer() {
        return this.containers.length > 0 ? this.containers[this.containers.length - 1] : null;
    }

    canPlace(container) {
        if (this.containers.length >= MAX_STACK) return false;
        if (this.containers.length === 0) return true;
        const topContainer = this.getTopContainer();
        return topContainer.colorKey === container.colorKey;
    }

    addContainer(container) {
        container.slot = this;
        container.stackIndex = this.containers.length;
        this.containers.push(container);
    }

    removeTopContainer() {
        const container = this.containers.pop();
        if (container) {
            container.slot = null;
        }
        return container;
    }

    getHitbox() {
        return {
            x: this.getX() - 5,
            y: this.getY() - MAX_STACK * CONTAINER_HEIGHT - 20,
            width: CONTAINER_WIDTH + 10,
            height: MAX_STACK * CONTAINER_HEIGHT + 40
        };
    }
}

// Konteyner Sinifi
class Container {
    constructor(colorKey) {
        this.colorKey = colorKey;
        this.color = ALL_COLORS[colorKey];
        this.slot = null;
        this.stackIndex = 0;
        this.wobble = 0;
        this.wobbleVel = 0;
    }

    getX() {
        if (!this.slot) return 0;
        return this.slot.getX();
    }

    getY() {
        if (!this.slot) return 0;
        return this.slot.getY() - (this.stackIndex + 1) * CONTAINER_HEIGHT;
    }

    draw(ctx, offsetX = 0, offsetY = 0) {
        const x = this.getX() + offsetX + Math.sin(this.wobble) * 3;
        const y = this.getY() + offsetY;
        this.drawAt(ctx, x, y);

        if (this.wobble !== 0 || this.wobbleVel !== 0) {
            this.wobbleVel -= this.wobble * 0.3;
            this.wobbleVel *= 0.85;
            this.wobble += this.wobbleVel;
            if (Math.abs(this.wobble) < 0.01 && Math.abs(this.wobbleVel) < 0.01) {
                this.wobble = 0;
                this.wobbleVel = 0;
            }
        }
    }

    drawAt(ctx, x, y, scale = 1) {
        const w = CONTAINER_WIDTH * scale;
        const h = CONTAINER_HEIGHT * scale;

        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(x + 4 * scale, y + 4 * scale, w, h);

        ctx.fillStyle = this.color.main;
        ctx.fillRect(x, y, w, h);

        ctx.fillStyle = this.color.light;
        ctx.fillRect(x, y, w, 8 * scale);

        ctx.fillStyle = this.color.dark;
        ctx.fillRect(x, y + h - 8 * scale, w, 8 * scale);

        ctx.strokeStyle = this.color.dark;
        ctx.lineWidth = 3 * scale;
        ctx.strokeRect(x, y, w, h);

        ctx.strokeStyle = this.color.dark;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.25, y + 5 * scale);
        ctx.lineTo(x + w * 0.25, y + h - 5 * scale);
        ctx.moveTo(x + w * 0.5, y + 5 * scale);
        ctx.lineTo(x + w * 0.5, y + h - 5 * scale);
        ctx.moveTo(x + w * 0.75, y + 5 * scale);
        ctx.lineTo(x + w * 0.75, y + h - 5 * scale);
        ctx.stroke();
    }

    startWobble() {
        this.wobble = 0;
        this.wobbleVel = 0.5;
    }

    getHitbox() {
        return {
            x: this.getX(),
            y: this.getY(),
            width: CONTAINER_WIDTH,
            height: CONTAINER_HEIGHT
        };
    }
}

// Gemi Sinifi
class Ship {
    constructor(requests) {
        this.targetX = canvas.width - 170;
        this.x = canvas.width + 200;
        this.y = canvas.height - GROUND_HEIGHT - 20;
        this.bobOffset = 0;
        // requests = [{colorKey: 'RED', count: 2}, {colorKey: 'BLUE', count: 1}]
        this.requests = requests;
        this.loadedByColor = {}; // {'RED': 2, 'BLUE': 0}
        requests.forEach(r => this.loadedByColor[r.colorKey] = 0);
        this.loadedContainers = [];
        this.state = 'arriving'; // arriving, waiting, leaving
    }

    getTotalRequested() {
        return this.requests.reduce((sum, r) => sum + r.count, 0);
    }

    getTotalLoaded() {
        return this.loadedContainers.length;
    }

    getRemainingForColor(colorKey) {
        const request = this.requests.find(r => r.colorKey === colorKey);
        if (!request) return 0;
        return request.count - (this.loadedByColor[colorKey] || 0);
    }

    canAccept(colorKey) {
        if (this.state !== 'waiting') return false;
        return this.getRemainingForColor(colorKey) > 0;
    }

    loadContainer(container) {
        this.loadedContainers.push({
            colorKey: container.colorKey,
            color: container.color
        });
        this.loadedByColor[container.colorKey] = (this.loadedByColor[container.colorKey] || 0) + 1;

        // Combo sistemi
        const now = Date.now();
        if (now - gameState.lastDeliveryTime < 2000) {
            gameState.combo++;
            if (gameState.combo > 1) {
                playSound('combo');
                showMessage(`Combo x${gameState.combo}!`, 800);
            }
        } else {
            gameState.combo = 1;
        }
        gameState.lastDeliveryTime = now;

        // Puan hesapla
        const basePoints = 100 * gameState.level;
        const comboBonus = Math.floor(basePoints * (gameState.combo - 1) * 0.5);
        gameState.score += basePoints + comboBonus;

        playSound('load');
        updateScoreUI();

        if (this.getTotalLoaded() >= this.getTotalRequested()) {
            this.complete();
        }
    }

    complete() {
        const config = getLevelConfig(gameState.level);

        gameState.shipsInLevel++;
        gameState.totalShipsCompleted++;
        updateScoreUI();

        playSound('horn');
        createConfetti();

        this.state = 'leaving';

        // Seviye kontrolu
        if (gameState.shipsInLevel >= config.shipsToComplete) {
            setTimeout(() => levelComplete(), 1500);
        } else {
            setTimeout(() => nextShip(), 2000);
        }
    }

    update() {
        this.bobOffset = Math.sin(Date.now() * 0.003) * 4;

        if (this.state === 'arriving') {
            this.x += (this.targetX - this.x) * 0.04;
            if (Math.abs(this.x - this.targetX) < 2) {
                this.x = this.targetX;
                this.state = 'waiting';
            }
        } else if (this.state === 'leaving') {
            this.x += 5;
        }
    }

    getHitbox() {
        return {
            x: this.x - 100,
            y: this.y - 150,
            width: 200,
            height: 180
        };
    }

    draw(ctx, isHighlighted = false) {
        const x = this.x;
        const y = this.y + this.bobOffset;
        const shipWidth = 180;
        const shipHeight = 80;

        // Highlight efekti
        if (isHighlighted && this.state === 'waiting') {
            ctx.fillStyle = 'rgba(46, 204, 113, 0.3)';
            ctx.beginPath();
            ctx.ellipse(x, y, 110, 70, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Gemi govdesi
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(x - shipWidth/2, y);
        ctx.lineTo(x - shipWidth/2 + 20, y + shipHeight/2);
        ctx.lineTo(x + shipWidth/2 - 20, y + shipHeight/2);
        ctx.lineTo(x + shipWidth/2, y);
        ctx.lineTo(x + shipWidth/2 - 10, y - shipHeight/3);
        ctx.lineTo(x - shipWidth/2 + 10, y - shipHeight/3);
        ctx.closePath();
        ctx.fill();

        // Gemi serit (tüm istenen renklerden)
        const stripeWidth = (shipWidth - 30) / this.requests.length;
        this.requests.forEach((req, i) => {
            ctx.fillStyle = ALL_COLORS[req.colorKey].main;
            ctx.fillRect(x - shipWidth/2 + 15 + i * stripeWidth, y - 5, stripeWidth, 10);
        });

        // Kabin
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(x - 30, y - shipHeight/3 - 50, 60, 50);

        // Pencereler
        ctx.fillStyle = '#3498db';
        ctx.fillRect(x - 20, y - shipHeight/3 - 40, 15, 12);
        ctx.fillRect(x + 5, y - shipHeight/3 - 40, 15, 12);

        // Baca
        ctx.fillStyle = '#f39c12';
        ctx.fillRect(x + 35, y - shipHeight/3 - 70, 18, 50);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(x + 35, y - shipHeight/3 - 70, 18, 8);

        // Yuklu konteynerler
        this.loadedContainers.forEach((c, i) => {
            const cx = x - 70 + (i % 3) * 45;
            const cy = y - shipHeight/3 - 5 - Math.floor(i / 3) * 25;

            ctx.fillStyle = c.color.main;
            ctx.fillRect(cx, cy - 20, 40, 20);
            ctx.strokeStyle = c.color.dark;
            ctx.lineWidth = 2;
            ctx.strokeRect(cx, cy - 20, 40, 20);
        });

        // Talep balonu
        if (this.state === 'waiting') {
            const activeRequests = this.requests.filter(r => this.getRemainingForColor(r.colorKey) > 0);
            const bubbleWidth = Math.max(120, activeRequests.length * 70 + 20);
            const bubbleX = x;
            const bubbleY = y - shipHeight/3 - 110;

            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 3;

            ctx.beginPath();
            ctx.roundRect(bubbleX - bubbleWidth/2, bubbleY - 28, bubbleWidth, 56, 12);
            ctx.fill();
            ctx.stroke();

            // Ok
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(bubbleX - 10, bubbleY + 28);
            ctx.lineTo(bubbleX, bubbleY + 43);
            ctx.lineTo(bubbleX + 10, bubbleY + 28);
            ctx.closePath();
            ctx.fill();

            // Her renk için mini konteyner ve sayı
            const startX = bubbleX - (activeRequests.length * 60) / 2;
            activeRequests.forEach((req, i) => {
                const remaining = this.getRemainingForColor(req.colorKey);
                const iconX = startX + i * 60;
                const iconY = bubbleY - 12;

                // Mini konteyner
                ctx.fillStyle = ALL_COLORS[req.colorKey].main;
                ctx.fillRect(iconX, iconY, 30, 20);
                ctx.strokeStyle = ALL_COLORS[req.colorKey].dark;
                ctx.lineWidth = 2;
                ctx.strokeRect(iconX, iconY, 30, 20);

                // Sayı
                ctx.fillStyle = '#333';
                ctx.font = 'bold 18px Arial';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(`x${remaining}`, iconX + 34, iconY + 10);
            });
        }
    }
}

// Mevcut konteynerlerin renklerini al
function getAvailableColors() {
    const colorCounts = {};
    gameState.slots.forEach(slot => {
        slot.containers.forEach(container => {
            colorCounts[container.colorKey] = (colorCounts[container.colorKey] || 0) + 1;
        });
    });
    return colorCounts; // {'RED': 5, 'BLUE': 3, ...}
}

// Gemi Kuyruğu Yönetimi
function generateShipRequest() {
    const config = getLevelConfig(gameState.level);
    const colorCounts = getAvailableColors();
    const availableColors = Object.keys(colorCounts).filter(c => colorCounts[c] > 0);

    // Eğer hiç konteyner kalmadıysa varsayılan istek döndür
    if (availableColors.length === 0) {
        return [{ colorKey: config.colors[0], count: 1 }];
    }

    // Tek renk varsa mecburen tek renk iste
    if (availableColors.length === 1) {
        const colorKey = availableColors[0];
        const count = Math.min(colorCounts[colorKey], 2);
        return [{ colorKey, count: Math.max(1, count) }];
    }

    // Birden fazla renk var - HER ZAMAN karışık iste (bulmaca olsun)
    // 2-3 farklı renk seç
    const numColors = Math.min(availableColors.length, Math.random() < 0.6 ? 2 : 3);

    // Renkleri karıştır ve seç
    const shuffled = [...availableColors].sort(() => Math.random() - 0.5);
    const selectedColors = shuffled.slice(0, numColors);

    // Her renkten 1 tane iste (toplam 2-3 konteyner)
    const requests = [];
    selectedColors.forEach(colorKey => {
        const available = colorCounts[colorKey];
        if (available > 0) {
            requests.push({ colorKey, count: 1 });
        }
    });

    // En az 2 farklı renk olmalı
    if (requests.length < 2 && availableColors.length >= 2) {
        // İkinci renk ekle
        for (const colorKey of availableColors) {
            if (!requests.find(r => r.colorKey === colorKey) && colorCounts[colorKey] > 0) {
                requests.push({ colorKey, count: 1 });
                break;
            }
        }
    }

    return requests;
}

function initShipQueue() {
    gameState.shipQueue = [];
    for (let i = 0; i < QUEUE_SIZE; i++) {
        gameState.shipQueue.push(generateShipRequest());
    }
    spawnCurrentShip();
}

function spawnCurrentShip() {
    if (gameState.shipQueue.length === 0) return;

    // Mevcut istek geçerli mi kontrol et
    const colorCounts = getAvailableColors();
    let requests = gameState.shipQueue[0];

    // Eğer istenen renkler mevcut değilse yeniden oluştur
    let needsRegeneration = false;
    for (const req of requests) {
        const available = colorCounts[req.colorKey] || 0;
        if (available < req.count) {
            needsRegeneration = true;
            break;
        }
    }

    if (needsRegeneration) {
        requests = generateShipRequest();
        gameState.shipQueue[0] = requests;
    }

    gameState.ship = new Ship(requests);
}

function nextShip() {
    // Konteyner kaldı mı kontrol et
    const colorCounts = getAvailableColors();
    const totalContainers = Object.values(colorCounts).reduce((a, b) => a + b, 0);

    if (totalContainers === 0) {
        // Tüm konteynerler bitti - seviye tamamlandı
        levelComplete();
        return;
    }

    // Kuyruktan ilk gemiyi çıkar
    gameState.shipQueue.shift();
    // Yeni gemi ekle
    gameState.shipQueue.push(generateShipRequest());
    // Yeni gemiyi spawn et
    spawnCurrentShip();
}

// Seviye Tamamlandi
function levelComplete() {
    if (gameState.gamePhase !== 'playing') return;

    gameState.gamePhase = 'levelComplete';
    playSound('levelup');

    const bonus = gameState.level * 500;
    gameState.score += bonus;

    showMessage(`Seviye ${gameState.level} Tamamlandi! +${bonus} Bonus`, 3000);
    createLevelUpEffect();

    setTimeout(() => startNextLevel(), 3500);
}

function startNextLevel() {
    gameState.level++;
    gameState.shipsInLevel = 0;
    gameState.gamePhase = 'playing';
    gameState.combo = 0;

    // Yeni seviye parametrelerini uygula
    applyLevelConfig();

    // Slotları yeniden oluştur (slot sayısı değişmiş olabilir)
    gameState.slots = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
        gameState.slots.push(new Slot(i));
    }

    // Yeni konteynerler
    generateBalancedContainers();

    // Yeni gemi kuyrugu
    initShipQueue();

    updateScoreUI();
    showMessage(`Seviye ${gameState.level} Basliyor!`, 2000);
}

function showMessage(text, duration) {
    gameState.message = text;
    gameState.messageTimer = duration;
}

// Efektler
function createDustParticles(x, y) {
    for (let i = 0; i < 8; i++) {
        gameState.particles.push({
            x: x + (Math.random() - 0.5) * 60,
            y: y + Math.random() * 10,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 3 - 1,
            life: 1,
            size: Math.random() * 6 + 3
        });
    }
}

function createLoadEffect(x, y, color) {
    for (let i = 0; i < 12; i++) {
        gameState.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: -Math.random() * 4 - 2,
            life: 1,
            size: Math.random() * 5 + 3,
            color: color
        });
    }
}

function createConfetti() {
    const ship = gameState.ship;
    if (!ship) return;

    for (let i = 0; i < 60; i++) {
        gameState.confetti.push({
            x: ship.x + (Math.random() - 0.5) * 100,
            y: ship.y - 80,
            vx: (Math.random() - 0.5) * 8,
            vy: -Math.random() * 6 - 2,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.3,
            color: ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e91e63'][Math.floor(Math.random() * 6)],
            life: 1,
            size: Math.random() * 8 + 4
        });
    }
}

function createLevelUpEffect() {
    for (let i = 0; i < 100; i++) {
        gameState.confetti.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 400,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.3,
            color: ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#fff'][Math.floor(Math.random() * 6)],
            life: 1,
            size: Math.random() * 12 + 6
        });
    }
}

function updateParticles() {
    gameState.particles = gameState.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= 0.03;
        return p.life > 0;
    });

    gameState.confetti = gameState.confetti.filter(c => {
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.2;
        c.rotation += c.rotationSpeed;
        c.life -= 0.01;
        return c.life > 0 && c.y < canvas.height + 50;
    });
}

function drawParticles(ctx) {
    gameState.particles.forEach(p => {
        const color = p.color || `rgba(180, 160, 140, ${p.life})`;
        if (p.color) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
        } else {
            ctx.fillStyle = `rgba(180, 160, 140, ${p.life})`;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });

    gameState.confetti.forEach(c => {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation);
        ctx.fillStyle = c.color;
        ctx.globalAlpha = c.life;
        ctx.fillRect(-c.size/2, -c.size/4, c.size, c.size/2);
        ctx.restore();
    });
}

// Oyun Baslat
function initGame() {
    resizeCanvas();
    applyLevelConfig();

    for (let i = 0; i < SLOT_COUNT; i++) {
        gameState.slots.push(new Slot(i));
    }

    generateBalancedContainers();
    initShipQueue();

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    window.addEventListener('resize', () => {
        resizeCanvas();
        if (gameState.ship) {
            gameState.ship.targetX = canvas.width - 170;
            if (gameState.ship.state === 'waiting') {
                gameState.ship.x = canvas.width - 170;
            }
        }
    });

    updateScoreUI();
    showMessage('Konteynerleri gemiye surukle!', 3000);

    gameLoop();
}

function generateBalancedContainers() {
    const config = getLevelConfig(gameState.level);
    const allContainers = [];

    config.colors.forEach(colorKey => {
        for (let i = 0; i < config.containersPerColor; i++) {
            allContainers.push(new Container(colorKey));
        }
    });

    // Karistir
    for (let i = allContainers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allContainers[i], allContainers[j]] = [allContainers[j], allContainers[i]];
    }

    // Dagit
    let slotIndex = 0;
    allContainers.forEach(container => {
        let attempts = 0;
        while (gameState.slots[slotIndex].containers.length >= MAX_STACK && attempts < SLOT_COUNT) {
            slotIndex = (slotIndex + 1) % SLOT_COUNT;
            attempts++;
        }

        if (gameState.slots[slotIndex].containers.length < MAX_STACK) {
            gameState.slots[slotIndex].addContainer(container);
        }

        slotIndex = (slotIndex + 1) % SLOT_COUNT;
    });
}

// Mouse/Touch
function getEventPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches && e.touches.length > 0) {
        return {
            x: (e.touches[0].clientX - rect.left) * scaleX,
            y: (e.touches[0].clientY - rect.top) * scaleY
        };
    }
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function findTopContainerAt(x, y) {
    for (const slot of gameState.slots) {
        const topContainer = slot.getTopContainer();
        if (!topContainer) continue;

        const hit = topContainer.getHitbox();
        if (x >= hit.x && x <= hit.x + hit.width &&
            y >= hit.y && y <= hit.y + hit.height) {
            return topContainer;
        }
    }
    return null;
}

function findSlotAt(x, y) {
    for (const slot of gameState.slots) {
        const hit = slot.getHitbox();
        if (x >= hit.x && x <= hit.x + hit.width &&
            y >= hit.y && y <= hit.y + hit.height) {
            return slot;
        }
    }
    return null;
}

function isOverShip(x, y) {
    if (!gameState.ship || gameState.ship.state !== 'waiting') return false;
    const hit = gameState.ship.getHitbox();
    return x >= hit.x && x <= hit.x + hit.width &&
           y >= hit.y && y <= hit.y + hit.height;
}

function handleMouseDown(e) {
    initAudio();
    const pos = getEventPos(e);

    if (gameState.gamePhase !== 'playing') return;

    const container = findTopContainerAt(pos.x, pos.y);
    if (container) {
        gameState.draggedContainer = container;
        gameState.dragStartSlot = container.slot;
        gameState.dragStartPos = { x: container.getX(), y: container.getY() };
        gameState.dragCurrentPos = { ...pos };
        playSound('pickup');
        container.startWobble();
    }
}

function handleMouseMove(e) {
    const pos = getEventPos(e);

    if (gameState.draggedContainer) {
        gameState.dragCurrentPos = { ...pos };

        // Hedef kontrolu
        const targetSlot = findSlotAt(pos.x, pos.y);
        gameState.highlightedSlot = targetSlot;
        gameState.highlightedShip = isOverShip(pos.x, pos.y);
    }
}

function handleMouseUp(e) {
    if (!gameState.draggedContainer) return;

    const pos = getEventPos(e);
    const sourceSlot = gameState.dragStartSlot;
    const container = gameState.draggedContainer;

    gameState.highlightedSlot = null;
    gameState.highlightedShip = false;

    // Gemiye mi birakiliyor?
    if (isOverShip(pos.x, pos.y) && gameState.ship) {
        if (gameState.ship.canAccept(container.colorKey)) {
            // Dogru renk - gemiye yukle
            sourceSlot.removeTopContainer();
            gameState.ship.loadContainer(container);
            createLoadEffect(gameState.ship.x, gameState.ship.y - 50, container.color.main);
        } else {
            // Yanlis renk
            playSound('error');
            showMessage('Yanlis renk!', 800);
        }
    } else {
        // Slot'a mi birakiliyor?
        const targetSlot = findSlotAt(pos.x, pos.y);

        if (targetSlot && targetSlot !== sourceSlot) {
            if (targetSlot.canPlace(container)) {
                sourceSlot.removeTopContainer();
                targetSlot.addContainer(container);
                playSound('drop');
                container.startWobble();

                const dropY = container.getY() + CONTAINER_HEIGHT;
                createDustParticles(container.getX() + CONTAINER_WIDTH/2, dropY);
            } else {
                playSound('error');
            }
        }
    }

    gameState.draggedContainer = null;
    gameState.dragStartSlot = null;
    gameState.dragStartPos = null;
    gameState.dragCurrentPos = null;
}

function handleTouchStart(e) {
    e.preventDefault();
    handleMouseDown(e);
}

function handleTouchMove(e) {
    e.preventDefault();
    handleMouseMove(e);
}

function handleTouchEnd(e) {
    e.preventDefault();
    if (e.changedTouches && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const fakeEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY
        };
        handleMouseUp(fakeEvent);
    }
}

function updateScoreUI() {
    const config = getLevelConfig(gameState.level);
    document.getElementById('score').textContent = `Skor: ${gameState.score}`;
    document.getElementById('ships-completed').textContent = `Seviye ${gameState.level} | Gemi: ${gameState.shipsInLevel}/${config.shipsToComplete}`;
}

// Cizim Fonksiyonlari
function drawBackground(ctx) {
    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(0.6, '#E0F4FF');
    skyGradient.addColorStop(1, '#B8D4E8');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Bulutlar
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const time = Date.now() * 0.00003;
    for (let i = 0; i < 4; i++) {
        const cx = ((i * 250 + time * 100) % (canvas.width + 200)) - 100;
        const cy = 60 + i * 25;
        ctx.beginPath();
        ctx.arc(cx, cy, 25, 0, Math.PI * 2);
        ctx.arc(cx + 20, cy - 8, 20, 0, Math.PI * 2);
        ctx.arc(cx + 40, cy, 25, 0, Math.PI * 2);
        ctx.fill();
    }

    // Deniz
    const seaY = canvas.height - GROUND_HEIGHT + 30;
    const seaGradient = ctx.createLinearGradient(0, seaY, 0, canvas.height);
    seaGradient.addColorStop(0, '#3498db');
    seaGradient.addColorStop(1, '#2471a3');
    ctx.fillStyle = seaGradient;
    ctx.fillRect(canvas.width - 320, seaY, 320, canvas.height - seaY);

    // Dalgalar
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
        const waveY = seaY + 15 + i * 20;
        ctx.beginPath();
        ctx.moveTo(canvas.width - 320, waveY);
        for (let x = canvas.width - 320; x <= canvas.width; x += 5) {
            const offset = Math.sin((x * 0.02) + (Date.now() * 0.003) + i) * 4;
            ctx.lineTo(x, waveY + offset);
        }
        ctx.stroke();
    }

    // Liman zemini
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width - 280, GROUND_HEIGHT);

    // Zemin cizgileri
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
        const y = canvas.height - GROUND_HEIGHT + 20 + i * 25;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width - 280, y);
        ctx.stroke();
    }

    // Iskele
    ctx.fillStyle = '#5d4e37';
    ctx.fillRect(canvas.width - 320, canvas.height - GROUND_HEIGHT, 40, GROUND_HEIGHT);
}

function drawSlots(ctx) {
    gameState.slots.forEach((slot, index) => {
        const x = slot.getX();
        const y = slot.getY();
        const isHighlighted = slot === gameState.highlightedSlot;

        ctx.fillStyle = isHighlighted ? 'rgba(46, 204, 113, 0.4)' : 'rgba(241, 196, 15, 0.3)';
        ctx.fillRect(x - 5, y - MAX_STACK * CONTAINER_HEIGHT - 10, CONTAINER_WIDTH + 10, MAX_STACK * CONTAINER_HEIGHT + 20);

        ctx.strokeStyle = isHighlighted ? '#2ecc71' : '#f1c40f';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(x - 5, y - MAX_STACK * CONTAINER_HEIGHT - 10, CONTAINER_WIDTH + 10, MAX_STACK * CONTAINER_HEIGHT + 20);
        ctx.setLineDash([]);

        ctx.fillStyle = isHighlighted ? '#27ae60' : '#f39c12';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${index + 1}`, x + CONTAINER_WIDTH/2, y + 22);

        const capacity = slot.containers.length;
        ctx.fillStyle = '#666';
        ctx.font = '11px Arial';
        ctx.fillText(`${capacity}/${MAX_STACK}`, x + CONTAINER_WIDTH/2, y - MAX_STACK * CONTAINER_HEIGHT - 15);
    });
}

function drawContainers(ctx) {
    gameState.slots.forEach(slot => {
        slot.containers.forEach(container => {
            if (container === gameState.draggedContainer) return;
            container.draw(ctx);
        });
    });

    // Suruklenen konteyner
    if (gameState.draggedContainer && gameState.dragCurrentPos) {
        const container = gameState.draggedContainer;

        // Orijinal pozisyonda golge
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(gameState.dragStartPos.x, gameState.dragStartPos.y + 5, CONTAINER_WIDTH, CONTAINER_HEIGHT);

        // Suruklenen
        const x = gameState.dragCurrentPos.x - CONTAINER_WIDTH/2;
        const y = gameState.dragCurrentPos.y - CONTAINER_HEIGHT/2;

        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(x + 8, y + 8, CONTAINER_WIDTH, CONTAINER_HEIGHT);

        container.drawAt(ctx, x, y);
    }
}

function drawShipQueue(ctx) {
    // Gelecek gemiler paneli
    const panelX = canvas.width - 180;
    const panelY = 45;
    const panelWidth = 170;
    const panelHeight = 30 + gameState.shipQueue.length * 50;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 10);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Siradaki Gemiler', panelX + panelWidth/2, panelY + 20);

    // Kuyruk
    gameState.shipQueue.forEach((requests, i) => {
        const itemY = panelY + 38 + i * 50;

        // Sira numarasi
        ctx.fillStyle = i === 0 ? '#2ecc71' : '#888';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(i === 0 ? 'SIMDI' : `${i + 1}.`, panelX + 8, itemY + 10);

        // Her renk için mini konteyner
        requests.forEach((req, j) => {
            const color = ALL_COLORS[req.colorKey];
            const offsetX = panelX + 45 + j * 42;

            // Mini konteyner
            ctx.fillStyle = color.main;
            ctx.fillRect(offsetX, itemY, 28, 18);
            ctx.strokeStyle = color.dark;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(offsetX, itemY, 28, 18);

            // Miktar
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`x${req.count}`, offsetX + 14, itemY + 32);
        });
    });
}

function drawLevelInfo(ctx) {
    const config = getLevelConfig(gameState.level);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(10, 45, 140, 65, 8);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Seviye: ${gameState.level}`, 20, 67);

    ctx.font = '13px Arial';
    ctx.fillText(`Gemi: ${gameState.shipsInLevel}/${config.shipsToComplete}`, 20, 85);

    // Combo gostergesi
    if (gameState.combo > 1) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 13px Arial';
        ctx.fillText(`Combo: x${gameState.combo}`, 20, 103);
    }
}

function drawMessage(ctx) {
    if (gameState.message && gameState.messageTimer > 0) {
        gameState.messageTimer -= 16;

        const alpha = Math.min(1, gameState.messageTimer / 500);

        ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * alpha})`;
        ctx.beginPath();
        ctx.roundRect(canvas.width/2 - 180, canvas.height/2 - 35, 360, 70, 15);
        ctx.fill();

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gameState.message, canvas.width/2, canvas.height/2);

        if (gameState.messageTimer <= 0) {
            gameState.message = null;
        }
    }
}

function drawInstructions(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Konteyneri gemiye surukle | Ayni renk ust uste konur | Hizli teslim = Combo bonus!', 15, canvas.height - 15);
}

// Ana oyun dongusu
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground(ctx);
    drawSlots(ctx);
    drawContainers(ctx);

    if (gameState.ship) {
        gameState.ship.update();
        gameState.ship.draw(ctx, gameState.highlightedShip);
    }

    updateParticles();
    drawParticles(ctx);

    drawShipQueue(ctx);
    drawLevelInfo(ctx);
    drawInstructions(ctx);
    drawMessage(ctx);

    requestAnimationFrame(gameLoop);
}

// Baslat
window.addEventListener('load', () => {
    try {
        initGame();
        console.log('Oyun baslatildi');
    } catch (e) {
        console.error('Oyun baslatilamadi:', e);
        alert('Oyun baslatilamadi: ' + e.message);
    }
});
