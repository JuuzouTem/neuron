const canvas = document.getElementById('neuronCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let neurons = [];
let mouse = { x: canvas.width / 2, y: canvas.height / 2 };

const MAX_NEURONS = 150;
const CONNECTION_DISTANCE = 150;
const GROWTH_SPEED = 0.5;
const MOUSE_INFLUENCE_RADIUS = 250;
const AXON_MAX_LENGTH = 350; // Aksonların geri çekilmeye başlamadan önceki max uzunluğu

// Olay dinleyicileri
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

window.addEventListener('click', e => {
    for (let i = 0; i < 5; i++) {
        if (neurons.length < MAX_NEURONS) {
            neurons.push(new Neuron(
                e.clientX + Math.random() * 40 - 20,
                e.clientY + Math.random() * 40 - 20
            ));
        }
    }
});

class Neuron {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 2 + 2;
        this.axons = [];
        
        // YENİ: Daha yumuşak hareket için
        this.vx = (Math.random() - 0.5) * 0.2;
        this.vy = (Math.random() - 0.5) * 0.2;
        this.maxSpeed = 0.2;

        this.activity = 1.0; 
        this.findPotentialConnections();
    }
    
    boostActivity() {
        this.activity = Math.min(1.0, this.activity + 0.5);
    }

    findPotentialConnections() {
        if (this.axons.length > 3) return;
        
        neurons.forEach(neuron => {
            if (this === neuron || neuron.activity < 0.5) return;
            const dist = Math.hypot(this.x - neuron.x, this.y - neuron.y);
            if (dist < CONNECTION_DISTANCE && dist > 20) {
                const connectionExists = this.axons.some(axon => axon.target === neuron);
                if (!connectionExists) {
                    this.axons.push(new Axon(this, neuron));
                    return; // Sadece bir tane bul ve çık
                }
            }
        });
    }

    draw() {
        const opacity = this.activity * 0.8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 220, 255, ${opacity})`;
        ctx.shadowColor = `rgba(100, 200, 255, ${this.activity})`;
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0; // Performans için gölgeyi sıfırla
    }
    
    update() {
        // GÜNCELLENDİ: Daha yumuşak hareket
        // Sadece arada bir yön değiştir
        if (Math.random() < 0.01) {
            this.vx += (Math.random() - 0.5) * 0.1;
            this.vy += (Math.random() - 0.5) * 0.1;
        }

        // Hızı sınırla
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > this.maxSpeed) {
            this.vx = (this.vx / speed) * this.maxSpeed;
            this.vy = (this.vy / speed) * this.maxSpeed;
        }
        
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;

        this.activity -= 0.0005; 
        const distToMouse = Math.hypot(this.x - mouse.x, this.y - mouse.y);
        if (distToMouse < MOUSE_INFLUENCE_RADIUS) {
            this.activity = Math.min(1.0, this.activity + 0.005);
        }

        // YENİ: Tamamen geri çekilmiş aksonları temizle
        this.axons = this.axons.filter(axon => !axon.isFullyRetracted);

        this.axons.forEach(axon => axon.update());
        
        if(Math.random() < 0.01) {
            this.findPotentialConnections();
        }
    }
}

class Axon {
    constructor(source, target) {
        this.source = source;
        this.target = target;
        this.path = [{ x: source.x, y: source.y }];
        this.isComplete = false;
        // YENİ: Geri çekilme durumu için
        this.isRetracting = false;
        this.isFullyRetracted = false;
    }

    update() {
        this.path[0] = { x: this.source.x, y: this.source.y };

        // YENİ: Geri çekilme mantığı
        if (this.isRetracting) {
            if (this.path.length > 1) {
                this.path.pop();
            } else {
                this.isFullyRetracted = true;
            }
            return;
        }

        if (this.isComplete) return;

        const lastPoint = this.path[this.path.length - 1];
        
        let dx_target = this.target.x - lastPoint.x;
        let dy_target = this.target.y - lastPoint.y;
        let dx_mouse = mouse.x - lastPoint.x;
        let dy_mouse = mouse.y - lastPoint.y;
        
        const dist_mouse = Math.hypot(dx_mouse, dy_mouse);
        let influence = Math.max(0, 1 - dist_mouse / 400);

        let vx = dx_target + dx_mouse * influence * 0.5;
        let vy = dy_target + dy_mouse * influence * 0.5;

        const mag = Math.hypot(vx, vy);
        if (mag > 0) {
            vx = (vx / mag) * GROWTH_SPEED;
            vy = (vy / mag) * GROWTH_SPEED;
        }
        
        vx += (Math.random() - 0.5) * 0.8;
        vy += (Math.random() - 0.5) * 0.8;
        
        const newPoint = {
            x: lastPoint.x + vx,
            y: lastPoint.y + vy
        };
        this.path.push(newPoint);

        const distToTarget = Math.hypot(newPoint.x - this.target.x, newPoint.y - this.target.y);
        
        // GÜNCELLENDİ: Bağlantı veya geri çekilme kontrolü
        if (distToTarget < 10) {
            this.isComplete = true;
            this.target.boostActivity();
        } else if (this.path.length > AXON_MAX_LENGTH) {
            this.isRetracting = true; // Boşlukta durmak yerine geri çekilmeye başla
        }
    }
    
    draw() {
        if (this.isFullyRetracted) return;
        ctx.beginPath();
        ctx.moveTo(this.source.x, this.source.y);
        for (let i = 1; i < this.path.length; i++) {
            ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        const opacity = Math.min(this.source.activity, this.target.activity || 1.0) * 0.3;
        ctx.strokeStyle = `rgba(180, 220, 255, ${opacity})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }
}

function init() {
    for (let i = 0; i < 50; i++) {
        if (neurons.length < MAX_NEURONS) {
             neurons.push(new Neuron(Math.random() * canvas.width, Math.random() * canvas.height));
        }
    }
}

function animate() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Aktif olmayan nöronları temizle
    neurons = neurons.filter(neuron => neuron.activity > 0.01);

    neurons.forEach(neuron => {
        neuron.update();
        neuron.axons.forEach(axon => axon.draw());
    });
    neurons.forEach(neuron => neuron.draw());

    requestAnimationFrame(animate);
}

init();
animate();

// Pencere yeniden boyutlandırıldığında canvas'ı ayarla
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});