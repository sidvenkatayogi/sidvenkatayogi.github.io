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

    // ASCII characters from darkest to lightest (more dense to less dense)
    var asciiChars = '@#$?!abc;:+*=-,.` ';

    this.Waves = function (holder, options) {
        var Waves = this;

        Waves.options = extend(options || {}, {
            resize: true,
            rotation: 45,
            waves: 5,
            thinWaves: 4, // Extra thin waves
            width: 10,
            amplitude: 1.5,
            background: true,
            preload: true,
            speed: [0.003, 0.015],
            thinSpeed: [0.005, 0.01], // Faster speed for thin waves
            debug: false,
            fps: false,
            asciiCellSize: 12, // Size of each ASCII cell in pixels
        });

        Waves.waves = [];
        Waves.thinWaves = [];

        Waves.holder = document.querySelector(holder);
        Waves.canvas = document.createElement('canvas');
        Waves.ctx = Waves.canvas.getContext('2d');
        Waves.holder.appendChild(Waves.canvas);

        // Create offscreen canvas for wave rendering
        Waves.offscreenCanvas = document.createElement('canvas');
        Waves.offscreenCtx = Waves.offscreenCanvas.getContext('2d');

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
            Waves.waves[i] = new Wave(Waves, false);

        for (var i = 0; i < options.thinWaves; i++)
            Waves.thinWaves[i] = new Wave(Waves, true);

        if (preload) Waves.preload();
    };

    Waves.prototype.reset = function () {
        this.waves = [];
        this.thinWaves = [];
        for (var i = 0; i < this.options.waves; i++) {
            this.waves[i] = new Wave(this, false);
        }
        for (var i = 0; i < this.options.thinWaves; i++) {
            this.thinWaves[i] = new Wave(this, true);
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
        for (var i = 0; i < options.thinWaves; i++) {
            for (var j = 0; j < options.width; j++) {
                Waves.thinWaves[i].update();
            }
        }
    };

    Waves.prototype.render = function () {
        var Waves = this;
        var ctx = Waves.ctx;
        var offscreenCtx = Waves.offscreenCtx;

        // Clear both canvases
        Waves.clear();
        offscreenCtx.clearRect(0, 0, Waves.width, Waves.height);

        // Draw background on main canvas
        if (Waves.options.background) {
            Waves.background();
        }

        // Render waves to offscreen canvas (white lines on black)
        offscreenCtx.fillStyle = '#000';
        offscreenCtx.fillRect(0, 0, Waves.width, Waves.height);

        each(Waves.waves, function (wave) {
            wave.update();
            wave.drawToOffscreen(offscreenCtx);
        });

        each(Waves.thinWaves, function (wave) {
            wave.update();
            wave.drawToOffscreen(offscreenCtx);
        });

        // Convert offscreen canvas to ASCII art
        Waves.renderAscii();

        if (Waves.options.debug) {
            ctx.beginPath();
            ctx.strokeStyle = '#f00';
            ctx.arc(Waves.centerX, Waves.centerY, Waves.radius, 0, pi2);
            ctx.stroke();
        }
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

        // Base background color (start of gradient)
        if (document.documentElement.classList.contains('dark-mode')) {
            ctx.fillStyle = '#000';
        } else {
            ctx.fillStyle = '#fff';
        }

        ctx.fillRect(0, 0, Waves.width, Waves.height);
    };

    Waves.prototype.renderAscii = function () {
        var Waves = this;
        var ctx = Waves.ctx;
        var offscreenCtx = Waves.offscreenCtx;
        var cellSize = Waves.options.asciiCellSize * Waves.scale;
        var isDarkMode = document.documentElement.classList.contains('dark-mode');

        // Get pixel data from offscreen canvas (wave data)
        var imageData = offscreenCtx.getImageData(0, 0, Waves.width, Waves.height);
        var pixels = imageData.data;

        // Set up text rendering
        ctx.font = (cellSize * 0.9) + 'px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Text color: dark grey on light mode, light grey on dark mode
        ctx.fillStyle = isDarkMode ? '#323232' : '#e4e4e4';

        // Sample offscreen canvas in grid and render ASCII
        var cols = Math.ceil(Waves.width / cellSize);
        var rows = Math.ceil(Waves.height / cellSize);

        for (var row = 0; row < rows; row++) {
            for (var col = 0; col < cols; col++) {
                var x = col * cellSize;
                var y = row * cellSize;

                // Calculate average wave brightness for this cell
                var totalWaveBrightness = 0;
                var sampleCount = 0;

                for (var sy = 0; sy < cellSize && y + sy < Waves.height; sy += 2) {
                    for (var sx = 0; sx < cellSize && x + sx < Waves.width; sx += 2) {
                        var pixelIndex = ((Math.floor(y + sy) * Waves.width) + Math.floor(x + sx)) * 4;
                        totalWaveBrightness += pixels[pixelIndex];
                        sampleCount++;
                    }
                }

                var avgWaveBrightness = sampleCount > 0 ? totalWaveBrightness / sampleCount : 0;

                // If there's wave content, map to ASCII character; otherwise use backtick
                if (avgWaveBrightness > 2) {
                    // Direct conversion: brightness to character
                    var charIndex = Math.floor((avgWaveBrightness / 255) * (asciiChars.length - 1));
                    charIndex = Math.max(0, Math.min(asciiChars.length - 1, charIndex));
                    ctx.fillText(asciiChars[charIndex], x + cellSize / 2, y + cellSize / 2);
                } else {
                    // Solid background of backticks
                    ctx.fillText("`", x + cellSize / 2, y + cellSize / 2);
                }
            }
        }
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

        // Also resize offscreen canvas
        Waves.offscreenCanvas.width = Waves.width;
        Waves.offscreenCanvas.height = Waves.height;

        Waves.radius = Math.sqrt(Waves.width ** 2 + Waves.height ** 2) / 2;
        Waves.centerX = Waves.width / 2;
        Waves.centerY = Waves.height / 2;
    };

    function Wave(Waves, thin) {
        var Wave = this;
        var speed = thin ? Waves.options.thinSpeed : Waves.options.speed;

        Wave.Waves = Waves;
        Wave.Lines = [];
        Wave.thin = thin || false;

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
        // Legacy method - now we use drawToOffscreen
        var Wave = this;
        Wave.drawToOffscreen(Wave.Waves.ctx);
    };

    Wave.prototype.drawToOffscreen = function (ctx) {
        var Wave = this;
        var Waves = Wave.Waves;

        var radius = Waves.radius;
        var radius3 = radius / 3;
        var x = Waves.centerX;
        var y = Waves.centerY;
        var rotation = dtr(Waves.options.rotation);
        var amplitude = Waves.options.amplitude;

        var Lines = Wave.Lines;

        each(Lines, function (line, i) {
            var angle = line.angle;

            var x1 = x - radius * Math.cos(angle[0] * amplitude + rotation);
            var y1 = y - radius * Math.sin(angle[0] * amplitude + rotation);
            var x2 = x + radius * Math.cos(angle[3] * amplitude + rotation);
            var y2 = y + radius * Math.sin(angle[3] * amplitude + rotation);
            var cpx1 = x - radius3 * Math.cos(angle[1] * amplitude * 2);
            var cpy1 = y - radius3 * Math.sin(angle[1] * amplitude * 2);
            var cpx2 = x + radius3 * Math.cos(angle[2] * amplitude * 2);
            var cpy2 = y + radius3 * Math.sin(angle[2] * amplitude * 2);

            // Draw white lines on black background for brightness sampling
            if (Wave.thin) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 1;
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 2;
            }

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x2, y2);
            ctx.stroke();
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
        width: 200,
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
