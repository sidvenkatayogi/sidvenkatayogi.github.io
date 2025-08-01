/// Theme Toggle (Radio Buttons)
document.addEventListener('DOMContentLoaded', function () {
    const lightModeRadio = document.getElementById('light-mode');
    const darkModeRadio = document.getElementById('dark-mode');

    // Set the radio button to the current theme based on the html element's class
    if (document.documentElement.classList.contains('dark-mode')) {
        darkModeRadio.checked = true;
    } else {
        lightModeRadio.checked = true;
    }

    lightModeRadio.addEventListener('change', function () {
        if (this.checked) {
            document.documentElement.className = 'light-mode';
            localStorage.setItem('theme', 'light-mode');
            if (!isMobileDevice()) {
                waves.reset();   // Clear old lines
                waves.render();  // Re-render with correct color
            }
        }
    });

    darkModeRadio.addEventListener('change', function () {
        if (this.checked) {
            document.documentElement.className = 'dark-mode';
            localStorage.setItem('theme', 'dark-mode');
            if (!isMobileDevice()) {
                waves.reset();   // Clear old lines
                waves.render();  // Re-render with correct color
            }
        }
    });

    // Initial render of the waves with the correct theme
    if (!isMobileDevice()) {
        waves.render();
    }
});

(function () {
    var pi = Math.PI;
    var pi2 = 2 * Math.PI;

    this.Waves = function (holder, options) {
        var Waves = this;

        Waves.options = extend(options || {}, {
            resize: false,
            rotation: 45,
            waves: 5,
            width: 100,
            amplitude: 0.5,
            background: true,
            preload: true,
            speed: [0.004, 0.008],
            debug: false,
            fps: false,
        });

        Waves.waves = [];

        Waves.holder = document.querySelector(holder);
        Waves.canvas = document.createElement('canvas');
        Waves.ctx = Waves.canvas.getContext('2d');
        Waves.holder.appendChild(Waves.canvas);

        Waves.stats = new Stats();

        Waves.resize();
        Waves.init(Waves.options.preload);

        if (Waves.options.resize)
            window.addEventListener('resize', function () {
                Waves.resize();
            }, false);
    };

    Waves.prototype.init = function (preload) {
        var Waves = this;
        var options = Waves.options;

        for (var i = 0; i < options.waves; i++)
            Waves.waves[i] = new Wave(Waves);

        if (preload) Waves.preload();
    };

    Waves.prototype.reset = function () {
        this.waves = [];
        for (var i = 0; i < this.options.waves; i++) {
            this.waves[i] = new Wave(this);
        }
    };

    Waves.prototype.preload = function () {
        var Waves = this;
        var options = Waves.options;

        for (var i = 0; i < options.waves; i++) {
            for (var j = 0; j < options.width; j++) {
                Waves.waves[i].update();
            }
        }
    };

    Waves.prototype.render = function () {
        var Waves = this;
        var ctx = Waves.ctx;

        Waves.clear();

        if (Waves.options.debug) {
            ctx.beginPath();
            ctx.strokeStyle = '#f00';
            ctx.arc(Waves.centerX, Waves.centerY, Waves.radius, 0, pi2);
            ctx.stroke();
        }

        if (Waves.options.background) {
            Waves.background();
        }

        each(Waves.waves, function (wave) {
            wave.update();
            wave.draw();
        });
    };

    Waves.prototype.animate = function () {
        var Waves = this;

        Waves.render();

        if (Waves.options.fps) {
            Waves.stats.log();
            Waves.ctx.font = '12px Arial';
            Waves.ctx.fillStyle = '#000';
            Waves.ctx.fillText(Waves.stats.fps() + ' FPS', 10, 22);
        }

        window.requestAnimationFrame(Waves.animate.bind(Waves));
    };

    Waves.prototype.clear = function () {
        var Waves = this;
        Waves.ctx.clearRect(0, 0, Waves.width, Waves.height);
    };

    Waves.prototype.background = function () {
        var Waves = this;
        var ctx = Waves.ctx;

        var gradient = ctx.createLinearGradient(0, 0, 0, Waves.height);
        if (document.documentElement.classList.contains('dark-mode')) {
            gradient.addColorStop(0, '#000');
            gradient.addColorStop(1, '#222');
        } else {
            gradient.addColorStop(0, '#fff');
            gradient.addColorStop(1, '#ddd');
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, Waves.width, Waves.height);
    };

    Waves.prototype.resize = function () {
        var Waves = this;
        var width = Waves.holder.offsetWidth;
        var height = Waves.holder.offsetHeight;
        Waves.scale = window.devicePixelRatio || 1;
        Waves.width = width * Waves.scale;
        Waves.height = height * Waves.scale;
        Waves.canvas.width = Waves.width;
        Waves.canvas.height = Waves.height;
        Waves.canvas.style.width = width + 'px';
        Waves.canvas.style.height = height + 'px';
        Waves.radius = Math.sqrt(Waves.width ** 2 + Waves.height ** 2) / 2;
        Waves.centerX = Waves.width / 2;
        Waves.centerY = Waves.height / 2;
    };

    function Wave(Waves) {
        var Wave = this;
        var speed = Waves.options.speed;

        Wave.Waves = Waves;
        Wave.Lines = [];

        Wave.angle = [
            rnd(pi2),
            rnd(pi2),
            rnd(pi2),
            rnd(pi2)
        ];

        Wave.speed = [
            rnd(speed[0], speed[1]) * rnd_sign(),
            rnd(speed[0], speed[1]) * rnd_sign(),
            rnd(speed[0], speed[1]) * rnd_sign(),
            rnd(speed[0], speed[1]) * rnd_sign(),
        ];

        return Wave;
    }

    Wave.prototype.update = function () {
        var Wave = this;
        var Lines = Wave.Lines;

        Lines.push(new Line(Wave));

        if (Lines.length > Wave.Waves.options.width) {
            Lines.shift();
        }
    };

    Wave.prototype.draw = function () {
        var Wave = this;
        var Waves = Wave.Waves;

        var ctx = Waves.ctx;
        var radius = Waves.radius;
        var radius3 = radius / 3;
        var x = Waves.centerX;
        var y = Waves.centerY;
        var rotation = dtr(Waves.options.rotation);
        var amplitude = Waves.options.amplitude;
        var debug = Waves.options.debug;

        var Lines = Wave.Lines;

        each(Lines, function (line, i) {
            if (debug && i > 0) return;

            var angle = line.angle;

            var x1 = x - radius * Math.cos(angle[0] * amplitude + rotation);
            var y1 = y - radius * Math.sin(angle[0] * amplitude + rotation);
            var x2 = x + radius * Math.cos(angle[3] * amplitude + rotation);
            var y2 = y + radius * Math.sin(angle[3] * amplitude + rotation);
            var cpx1 = x - radius3 * Math.cos(angle[1] * amplitude * 2);
            var cpy1 = y - radius3 * Math.sin(angle[1] * amplitude * 2);
            var cpx2 = x + radius3 * Math.cos(angle[2] * amplitude * 2);
            var cpy2 = y + radius3 * Math.sin(angle[2] * amplitude * 2);

            ctx.strokeStyle = debug ? '#aaa' : line.color;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x2, y2);
            ctx.stroke();

            if (debug) {
                ctx.strokeStyle = '#aaa';
                ctx.globalAlpha = 0.3;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(cpx1, cpy1);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x2, y2);
                ctx.lineTo(cpx2, cpy2);
                ctx.stroke();

                ctx.globalAlpha = 1;
            }
        });
    };

    function Line(Wave) {
        var Line = this;

        var angle = Wave.angle;
        var speed = Wave.speed;

        Line.angle = [
            Math.sin(angle[0] += speed[0]),
            Math.sin(angle[1] += speed[1]),
            Math.sin(angle[2] += speed[2]),
            Math.sin(angle[3] += speed[3])
        ];

        if (document.documentElement.classList.contains('dark-mode')) {
            Line.color = 'rgba(50, 50, 50, 0.1)';
        } else {
            Line.color = 'rgba(216, 216, 216, 0.1)';
        }
    }

    function Stats() {
        this.data = [];
    }

    Stats.prototype.time = function () {
        return (performance || Date).now();
    };

    Stats.prototype.log = function () {
        if (!this.last) {
            this.last = this.time();
            return 0;
        }

        this.new = this.time();
        this.delta = this.new - this.last;
        this.last = this.new;

        this.data.push(this.delta);
        if (this.data.length > 10)
            this.data.shift();
    };

    Stats.prototype.fps = function () {
        var fps = 0;
        each(this.data, function (data) {
            fps += data;
        });

        return Math.round(1000 / (fps / this.data.length));
    };

    function each(items, callback) {
        for (var i = 0; i < items.length; i++) {
            callback(items[i], i);
        }
    }

    function extend(options, defaults) {
        for (var key in options)
            if (defaults.hasOwnProperty(key))
                defaults[key] = options[key];
        return defaults;
    }

    function dtr(deg) {
        return deg * pi / 180;
    }

    function rnd(a, b) {
        if (arguments.length === 1)
            return Math.random() * a;
        return a + Math.random() * (b - a);
    }

    function rnd_sign() {
        return (Math.random() > 0.5) ? 1 : -1;
    }

})();

function isMobileDevice() {
    return window.innerWidth <= 768; // Adjust breakpoint as needed
}

if (!isMobileDevice()) {
    var waves = new Waves('#holder', {
        fps: false,
        waves: 3,
        width: 150,
    });

    waves.animate();
}
else{
    var waves = new Waves('#holder', {
        fps: true,
        waves: 1,
        width: 150,
    });

    waves.animate();
}
