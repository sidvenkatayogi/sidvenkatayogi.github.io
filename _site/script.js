// Theme Toggle (Radio Buttons) — extracted so it can be re-bound after SPA swaps
function setupThemeToggle() {
    var lightModeRadio = document.getElementById('light-mode');
    var darkModeRadio = document.getElementById('dark-mode');
    if (!lightModeRadio || !darkModeRadio) return;

    if (document.documentElement.classList.contains('dark-mode')) {
        darkModeRadio.checked = true;
    } else {
        lightModeRadio.checked = true;
    }

    function applyTheme(themeClass) {
        var colorOff = document.documentElement.classList.contains('color-off');
        document.documentElement.className = themeClass + (colorOff ? ' color-off' : '');
        localStorage.setItem('theme', themeClass);
        if (!isMobileDevice()) {
            waves.reset();
            waves.render();
        }
    }

    lightModeRadio.addEventListener('change', function () {
        if (this.checked) applyTheme('light-mode');
    });

    darkModeRadio.addEventListener('change', function () {
        if (this.checked) applyTheme('dark-mode');
    });
}

function setupColorToggle() {
    var colorToggle = document.getElementById('color-toggle');
    if (!colorToggle) return;
    colorToggle.checked = !document.documentElement.classList.contains('color-off');
    colorToggle.addEventListener('change', function () {
        if (this.checked) {
            document.documentElement.classList.remove('color-off');
            localStorage.setItem('color', 'on');
        } else {
            document.documentElement.classList.add('color-off');
            localStorage.setItem('color', 'off');
        }
        if (!isMobileDevice() && typeof waves !== 'undefined') {
            waves.render();
        }
    });
}

// SPA-style navigation: swap page content without full reload so the canvas stays alive
function navigateTo(url, isPopState) {
    fetch(url)
        .then(function (response) {
            if (!response.ok) throw new Error(response.status);
            return response.text();
        })
        .then(function (html) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, 'text/html');

            // Update body class (page-specific layout class)
            document.body.className = doc.body.className;

            // Swap container contents
            var newContainer = doc.querySelector('.container');
            var currentContainer = document.querySelector('.container');
            if (newContainer && currentContainer) {
                currentContainer.innerHTML = newContainer.innerHTML;
            }

            // Update URL and title
            if (!isPopState) {
                history.pushState(null, '', url);
            }
            document.title = doc.title;

            // Execute inline scripts in the swapped content
            var scripts = currentContainer.querySelectorAll('script');
            for (var i = 0; i < scripts.length; i++) {
                var oldScript = scripts[i];
                // Skip external scripts (like script.js) to avoid re-initializing waves
                if (oldScript.src) continue;
                var newScript = document.createElement('script');
                newScript.textContent = oldScript.textContent;
                oldScript.parentNode.replaceChild(newScript, oldScript);
            }

            // Re-bind theme toggle on the fresh DOM
            setupThemeToggle();
            setupColorToggle();

            // Trigger scatter animation on project/art items
            animateScatterItems();
            setupProximityScale();

            window.scrollTo(0, 0);
        })
        .catch(function () {
            // Fallback to normal navigation on error
            window.location.href = url;
        });
}

// Animate items: start from center of viewport, scatter to final position
function animateScatterItems() {
    var items = [];
    // Collect project/art/blog items
    document.querySelectorAll('.project-item, .art-item, .blog-page .content li').forEach(function (el) {
        items.push(el);
    });
    // For about page, group children separated by <p><br></p> spacers into animation groups
    var aboutIntro = document.querySelector('.about-intro');
    if (aboutIntro) {
        var groups = [[]];
        Array.prototype.forEach.call(aboutIntro.children, function (child) {
            // A <p> containing only whitespace/br is a spacer — starts a new group
            var isSpacer = child.tagName === 'P' && !child.textContent.trim();
            if (isSpacer) {
                groups[groups.length - 1].push(child);
                groups.push([]);
            } else {
                groups[groups.length - 1].push(child);
            }
        });
        // Each group becomes one animation item (array of elements)
        groups.forEach(function (group) {
            if (group.length) items.push(group);
        });
    }
    if (!items.length) return;

    var totalItems = items.length;
    items.forEach(function (item, index) {
        // item can be a single element or an array of elements (grouped about-intro children)
        var elements = Array.isArray(item) ? item : [item];

        // Use the first element for position calculation
        var rect = elements[0].getBoundingClientRect();
        var centerX = window.innerWidth / 2;
        var centerY = window.innerHeight / 2;
        var itemCenterX = rect.left + rect.width / 2;
        var itemCenterY = rect.top + rect.height / 2;
        var offsetX = centerX - itemCenterX;
        var offsetY = centerY - itemCenterY;

        elements.forEach(function (el) {
            // ASCII art just fades in place, no movement
            var isAscii = el.classList && el.classList.contains('ascii-art');
            el.style.setProperty('--scatter-x', isAscii ? '0px' : offsetX + 'px');
            el.style.setProperty('--scatter-y', isAscii ? '0px' : offsetY + 'px');
            el.style.animationDelay = (index * 0.07) + 's';
            el.style.zIndex = totalItems - index;
            el.style.position = 'relative';
            el.classList.add('scatter-animate');

            el.addEventListener('animationend', function handler() {
                el.classList.remove('scatter-animate');
                el.style.removeProperty('--scatter-x');
                el.style.removeProperty('--scatter-y');
                el.style.animationDelay = '';
                el.style.opacity = '1';
                el.style.zIndex = '';
                el.style.position = '';
                el.removeEventListener('animationend', handler);
            });
        });
    });
}

// Scale project/art/blog entries up as they near the 2/5-from-top focus line
// (matches the list's padding-top offset) and back down as they scroll away from it.
//
// Each item's position is measured ONCE into proximityEntries, in scroll-content
// coordinates. scale() does not affect layout, so those positions stay valid while
// scrolling — which means the per-frame path reads a single scrollTop and then only
// writes, never triggering a layout flush per item.
//
// The rendered scale eases toward its target rather than tracking scrollTop exactly:
// a wheel notch moves scrollTop in one big jump, so a scale derived straight from it
// snaps between values and reads as choppy. Easing decouples the two, giving
// continuous motion even from discrete scroll input.
var PROXIMITY_TARGET_FRACTION = 0.4;
var PROXIMITY_FALLOFF_PX = 320;
var PROXIMITY_MIN_SCALE = 0.85;
var PROXIMITY_MAX_SCALE = 1.5;
var PROXIMITY_MAX_SCALE_MOBILE = 1.25; // Smaller peak so wide items don't overflow narrow screens
var PROXIMITY_SMOOTHING_TAU = 90; // ms time constant; larger = softer, slower follow
var proximityEntries = [];
var proximityWrapper = null;
var proximityWrapperTop = 0;
var proximityRemeasureTimer = null;
var proximityAnimating = false;
var proximityLastFrameAt = 0;

// True while a scroll is in flight. The background wave animation reads this (and
// proximityAnimating) and drops to options.scrollingFps so the motion gets the
// main thread.
var isScrolling = false;
var scrollIdleTimer = null;

function markScrolling() {
    isScrolling = true;
    clearTimeout(scrollIdleTimer);
    scrollIdleTimer = setTimeout(function () {
        isScrolling = false;
    }, 140);
}

// offsetTop is relative to the nearest positioned ancestor, so accumulate up the
// offsetParent chain to get each item's offset within the scroll container.
function offsetTopWithin(el, ancestor) {
    var top = 0;
    var node = el;
    while (node && node !== ancestor) {
        top += node.offsetTop;
        node = node.offsetParent;
    }
    return top;
}

// Add trailing space so the LAST item can be scrolled up to the focus line, the
// same way the list's padding-top lets the first item start there. Derived by
// measuring the shortfall rather than by formula, so it stays correct whatever the
// item heights, margins and wrapper padding happen to be.
function applyProximityTailPadding(items) {
    var listEl = items[items.length - 1].parentNode;
    if (!listEl) return;

    // Dropping the padding shrinks scrollHeight, which makes the browser clamp
    // scrollTop if we are near the bottom. Restore it so a re-measure triggered
    // mid-scroll (an image finishing decode, say) never jerks the view.
    var scrollTop = proximityWrapper.scrollTop;

    listEl.style.paddingBottom = '0px';
    var lastTop = offsetTopWithin(items[items.length - 1], proximityWrapper);
    var currentMax = proximityWrapper.scrollHeight - proximityWrapper.clientHeight;
    var desiredMax = proximityWrapperTop + lastTop - window.innerHeight * PROXIMITY_TARGET_FRACTION;
    var shortfall = desiredMax - currentMax;
    listEl.style.paddingBottom = (shortfall > 0 ? Math.round(shortfall) : 0) + 'px';

    if (proximityWrapper.scrollTop !== scrollTop) {
        proximityWrapper.scrollTop = scrollTop;
    }
}

function measureProximityItems() {
    proximityWrapper = document.querySelector('.wrapper');
    proximityEntries = [];
    if (!proximityWrapper) return;

    proximityWrapperTop = proximityWrapper.getBoundingClientRect().top;
    var items = document.querySelectorAll('.project-item, .art-item, .blog-page .content li');
    if (!items.length) return;

    for (var i = 0; i < items.length; i++) {
        proximityEntries.push({
            el: items[i],
            center: offsetTopWithin(items[i], proximityWrapper) + items[i].offsetHeight / 2,
            target: 1,
            current: 1,
            lastScale: -1,
            lastZ: -1
        });
    }
    applyProximityTailPadding(items);
}

// Where each item wants to be, given the current scroll position.
function computeProximityTargets() {
    if (!proximityEntries.length || !proximityWrapper) return;

    var maxScale = isMobileDevice() ? PROXIMITY_MAX_SCALE_MOBILE : PROXIMITY_MAX_SCALE;
    var range = maxScale - PROXIMITY_MIN_SCALE;
    var focusY = window.innerHeight * PROXIMITY_TARGET_FRACTION;
    // The only geometry read of the frame, taken before any writes.
    var base = proximityWrapperTop - proximityWrapper.scrollTop;

    for (var i = 0; i < proximityEntries.length; i++) {
        var entry = proximityEntries[i];
        var distance = Math.abs(base + entry.center - focusY);
        var t = distance < PROXIMITY_FALLOFF_PX ? distance / PROXIMITY_FALLOFF_PX : 1;
        var eased = t * t * (3 - 2 * t); // smoothstep for a gradual, smooth falloff
        entry.target = maxScale - eased * range;
    }
}

function writeProximityScale(entry) {
    var scale = Math.round(entry.current * 1000) / 1000;
    if (scale === entry.lastScale) return; // Skip redundant style writes
    entry.lastScale = scale;
    entry.el.style.transform = 'scale(' + scale + ')';

    // Bigger items stack above their neighbours. Coarse so it rarely changes.
    var z = Math.round(scale * 50);
    if (z !== entry.lastZ) {
        entry.lastZ = z;
        entry.el.style.zIndex = z;
    }
}

function stepProximityAnimation(now) {
    // Clamped so a long stall (backgrounded tab) does not jump the easing.
    var dt = Math.min(64, (now - proximityLastFrameAt) || 16);
    proximityLastFrameAt = now;
    computeProximityTargets();

    // Exponential approach, so convergence speed is the same whether we are
    // getting 60 frames a second or 20.
    var k = 1 - Math.exp(-dt / PROXIMITY_SMOOTHING_TAU);
    var settled = true;

    for (var i = 0; i < proximityEntries.length; i++) {
        var entry = proximityEntries[i];
        // Let the one-time entrance animation finish untouched; it owns its transform.
        if (entry.el.classList.contains('scatter-animate')) continue;

        var diff = entry.target - entry.current;
        if (diff > -0.0005 && diff < 0.0005) {
            entry.current = entry.target;
        } else {
            entry.current += diff * k;
            settled = false;
        }
        writeProximityScale(entry);
    }

    // Keep ticking while still converging, or while a scroll is still feeding
    // new targets.
    if (settled && !isScrolling) {
        proximityAnimating = false;
        return;
    }
    requestAnimationFrame(stepProximityAnimation);
}

function startProximityAnimation() {
    if (proximityAnimating || !proximityEntries.length) return;
    proximityAnimating = true;
    proximityLastFrameAt = performance.now();
    requestAnimationFrame(stepProximityAnimation);
}

function onProximityScroll() {
    markScrolling();
    startProximityAnimation();
}

// Snap straight to the target — used on load/resize/image-decode, where easing
// from a stale value would look like an unprompted animation.
function remeasureProximity() {
    measureProximityItems();
    computeProximityTargets();
    for (var i = 0; i < proximityEntries.length; i++) {
        proximityEntries[i].current = proximityEntries[i].target;
        writeProximityScale(proximityEntries[i]);
    }
}

function scheduleProximityRemeasure() {
    clearTimeout(proximityRemeasureTimer);
    proximityRemeasureTimer = setTimeout(remeasureProximity, 120);
}

function setupProximityScale() {
    remeasureProximity();

    // Re-measure once the entrance animation has settled: it clears the inline
    // styles it set, and item positions are only final afterwards.
    setTimeout(remeasureProximity, 900);

    // Art thumbnails change item heights as they decode, which moves every
    // item below them.
    var imgs = document.querySelectorAll('.wrapper img');
    for (var i = 0; i < imgs.length; i++) {
        if (!imgs[i].complete) {
            imgs[i].addEventListener('load', scheduleProximityRemeasure, { once: true });
        }
    }

    if (proximityWrapper) {
        proximityWrapper.addEventListener('scroll', onProximityScroll, { passive: true });
    }
}

window.addEventListener('resize', scheduleProximityRemeasure);

// Rainbow flash-to-grey hover animation for clickable text
function lockLinkHover(link, triggerEl) {
    if (link.dataset.rainbowHoverLocked === '1') return false;
    link.dataset.rainbowHoverLocked = '1';
    triggerEl.addEventListener('mouseleave', function handler() {
        delete link.dataset.rainbowHoverLocked;
        triggerEl.removeEventListener('mouseleave', handler);
    });
    return true;
}

function animateLinkHover(link) {
    if (link.dataset.rainbowAnimating === '1') return;
    // Skip links that contain element children (e.g. images, excerpt blocks);
    // only animate links whose content is pure text.
    for (var i = 0; i < link.childNodes.length; i++) {
        if (link.childNodes[i].nodeType !== 3) return;
    }
    var text = link.textContent;
    if (!text || !text.trim()) return;

    var colorOn = !document.documentElement.classList.contains('color-off');
    if (!colorOn) return; // CSS handles the fade-to-grey hover when color is off
    var palette = ['#d23be7', '#4355db', '#34bbe6', '#49da9a', '#f7d038', '#e6261f'];
    link.dataset.rainbowAnimating = '1';
    var originalText = text;

    // Wrap each character in its own span
    link.textContent = '';
    var spans = [];
    for (var j = 0; j < originalText.length; j++) {
        var ch = originalText[j];
        if (ch === ' ') {
            link.appendChild(document.createTextNode(' '));
        } else {
            var span = document.createElement('span');
            span.textContent = ch;
            link.appendChild(span);
            spans.push({
                el: span,
                settleAt: 200 + Math.pow(Math.random(), 1.6) * 1200,
                nextFlashAt: 0
            });
        }
    }

    var duration = 1500;
    var start = performance.now();

    function frame(now) {
        var elapsed = now - start;
        if (elapsed >= duration) {
            link.textContent = originalText;
            delete link.dataset.rainbowAnimating;
            return;
        }
        for (var k = 0; k < spans.length; k++) {
            var s = spans[k];
            if (elapsed < s.settleAt) {
                if (elapsed >= s.nextFlashAt) {
                    // Probability of a colored flash fades to 0 as we approach settleAt
                    var remaining = (s.settleAt - elapsed) / s.settleAt;
                    if (Math.random() < remaining) {
                        s.el.style.color = palette[Math.floor(Math.random() * palette.length)];
                    } else {
                        s.el.style.color = '';
                    }
                    s.nextFlashAt = elapsed + 60;
                }
            } else if (s.el.style.color !== '') {
                s.el.style.color = '';
            }
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

function setupLinkHoverAnimation() {
    document.addEventListener('mouseover', function (e) {
        var link = e.target.closest('a');
        if (!link) return;
        // Avoid re-triggering when moving between child nodes of the same link
        if (e.relatedTarget && link.contains(e.relatedTarget)) return;
        if (!lockLinkHover(link, link)) return;
        animateLinkHover(link);
    });

    // Hovering a project/art thumbnail also triggers the title link animation
    document.addEventListener('mouseover', function (e) {
        var thumb = e.target.closest('.project-thumbnail a, .art-thumbnail a');
        if (!thumb) return;
        if (e.relatedTarget && thumb.contains(e.relatedTarget)) return;
        var item = thumb.closest('.project-item, .art-item');
        if (!item) return;
        var titleLink = item.querySelector('.project-title a, .art-title a');
        if (!titleLink) return;
        if (!lockLinkHover(titleLink, thumb)) return;
        animateLinkHover(titleLink);
    });
}

document.addEventListener('DOMContentLoaded', function () {
    setupThemeToggle();
    setupColorToggle();
    setupLinkHoverAnimation();

    // Initial render
    if (!isMobileDevice()) {
        waves.render();
    }

    // Trigger scatter animation on initial page load
    animateScatterItems();
    setupProximityScale();

    // Intercept internal link clicks for SPA navigation
    document.addEventListener('click', function (e) {
        var link = e.target.closest('a');
        if (!link) return;

        var href = link.getAttribute('href');
        if (!href) return;

        // Skip external links, mailto, anchors, new-tab links
        if (link.origin && link.origin !== window.location.origin) return;
        if (href.startsWith('mailto:')) return;
        if (href.startsWith('#')) return;
        if (link.target === '_blank') return;

        e.preventDefault();
        navigateTo(href);
    });

    // Handle browser back/forward
    window.addEventListener('popstate', function () {
        navigateTo(window.location.pathname + window.location.search, true);
    });
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
            targetFps: 30, // Cap render rate; see animate() for why
            scrollingFps: 10, // Yield the main thread to the scroll while it is active
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

        if (!Waves.restoreState()) {
            if (preload) Waves.preload();
        }
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

    Waves.prototype.saveState = function () {
        var state = {
            waves: this.waves.map(function (wave) {
                return {
                    angle: wave.angle.slice(),
                    speed: wave.speed.slice(),
                    lines: wave.Lines.map(function (line) {
                        return line.angle.slice();
                    })
                };
            }),
            thinWaves: this.thinWaves.map(function (wave) {
                return {
                    angle: wave.angle.slice(),
                    speed: wave.speed.slice(),
                    lines: wave.Lines.map(function (line) {
                        return line.angle.slice();
                    })
                };
            })
        };
        try {
            sessionStorage.setItem('wavesState', JSON.stringify(state));
        } catch (e) { }
    };

    Waves.prototype.restoreState = function () {
        var saved = sessionStorage.getItem('wavesState');
        if (!saved) return false;

        try {
            var state = JSON.parse(saved);
            for (var i = 0; i < state.waves.length && i < this.waves.length; i++) {
                this.waves[i].angle = state.waves[i].angle;
                this.waves[i].speed = state.waves[i].speed;
                this.waves[i].Lines = state.waves[i].lines.map(function (angles) {
                    return { angle: angles };
                });
            }
            for (var i = 0; i < state.thinWaves.length && i < this.thinWaves.length; i++) {
                this.thinWaves[i].angle = state.thinWaves[i].angle;
                this.thinWaves[i].speed = state.thinWaves[i].speed;
                this.thinWaves[i].Lines = state.thinWaves[i].lines.map(function (angles) {
                    return { angle: angles };
                });
            }
            return true;
        } catch (e) {
            return false;
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
        var boundAnimate = Waves._boundAnimate || (Waves._boundAnimate = Waves.animate.bind(Waves));

        // A full render costs tens of milliseconds (thousands of bezier strokes,
        // a full-canvas getImageData, then a fillText per ASCII cell), so at 60Hz
        // it monopolises the main thread and makes scrolling stutter. The output
        // is a coarse 12px character grid that cannot show 60Hz motion anyway,
        // so render at targetFps and leave the remaining frames for everything else.
        var now = performance.now();
        var busy = isScrolling || proximityAnimating;
        var minDelta = 1000 / (busy ? Waves.options.scrollingFps : Waves.options.targetFps);
        if (now - (Waves._lastRenderAt || 0) >= minDelta) {
            Waves._lastRenderAt = now;
            Waves.render();

            if (Waves.options.fps) {
                Waves.stats.log();
                Waves.ctx.font = '12px Arial';
                Waves.ctx.fillStyle = '#000';
                Waves.ctx.fillText(Waves.stats.fps() + ' FPS', 10, 22);
            }
        }

        window.requestAnimationFrame(boundAnimate);
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

        // Text colors: normal and thin wave variants for each mode
        var normalColor = isDarkMode ? '#323232' : '#e4e4e4';
        var thinColor = isDarkMode ? '#444444' : '#c9c9c9';

        // Colorful palette for the densest cells
        var colorfulColors = ['#d23be7', '#4355db', '#34bbe6', '#49da9a', '#f7d038', '#e6261f'];
        var denseCharThreshold = 1; // charIndex <= this counts as "dense" (@ # $ ? !)

        // Sample offscreen canvas in grid and render ASCII
        var cols = Math.ceil(Waves.width / cellSize);
        var rows = Math.ceil(Waves.height / cellSize);

        for (var row = 0; row < rows; row++) {
            for (var col = 0; col < cols; col++) {
                var x = col * cellSize;
                var y = row * cellSize;

                // Calculate average wave brightness for this cell from Red (normal) and Green (thin) channels
                var totalNormalBrightness = 0;
                var totalThinBrightness = 0;
                var sampleCount = 0;

                for (var sy = 0; sy < cellSize && y + sy < Waves.height; sy += 2) {
                    for (var sx = 0; sx < cellSize && x + sx < Waves.width; sx += 2) {
                        var pixelIndex = ((Math.floor(y + sy) * Waves.width) + Math.floor(x + sx)) * 4;
                        totalNormalBrightness += pixels[pixelIndex];     // Red channel = normal
                        totalThinBrightness += pixels[pixelIndex + 1];  // Green channel = thin
                        sampleCount++;
                    }
                }

                var avgNormalBrightness = sampleCount > 0 ? totalNormalBrightness / sampleCount : 0;
                var avgThinBrightness = sampleCount > 0 ? totalThinBrightness / sampleCount : 0;
                var avgTotalBrightness = Math.max(avgNormalBrightness, avgThinBrightness);

                // If there's wave content, map to ASCII character; otherwise use backtick
                if (avgTotalBrightness > 2) {
                    // Direct conversion: brightness to character
                    var charIndex = Math.floor((avgTotalBrightness / 255) * (asciiChars.length - 1));
                    charIndex = Math.max(0, Math.min(asciiChars.length - 1, charIndex));

                    // Densest cells get a 70% chance to render in a palette color.
                    // Seed off cell coordinates so each cell's color is stable across frames.
                    var cellSeed = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453;
                    cellSeed = cellSeed - Math.floor(cellSeed);
                    var colorPick = Math.sin(col * 39.346 + row * 11.135) * 43758.5453;
                    colorPick = colorPick - Math.floor(colorPick);

                    var colorOn = !document.documentElement.classList.contains('color-off');
                    if (colorOn && charIndex <= denseCharThreshold && cellSeed < 0.02) {
                        ctx.fillStyle = colorfulColors[Math.floor(colorPick * colorfulColors.length)];
                    } else {
                        // Set color based on which type of wave is more prominent in this cell
                        ctx.fillStyle = avgThinBrightness > avgNormalBrightness ? thinColor : normalColor;
                    }

                    ctx.fillText(asciiChars[charIndex], x + cellSize / 2, y + cellSize / 2);
                } else {
                    // Solid background of backticks using the normal background color
                    ctx.fillStyle = normalColor;
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

            // Draw colored lines on black background for brightness sampling
            // We use Red channel for normal waves and Green channel for thin waves
            // so we can color them differently in the final ASCII output.
            if (Wave.thin) {
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.25)';
                ctx.lineWidth = 1;
            } else {
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
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

// Save state on hard navigation (refresh, external link) as fallback
window.addEventListener('beforeunload', function () {
    if (typeof waves !== 'undefined' && waves.saveState) {
        waves.saveState();
    }
});
