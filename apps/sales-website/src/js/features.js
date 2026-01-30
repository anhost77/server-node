/* ServerFlow Features Animations Logic */

document.addEventListener('DOMContentLoaded', () => {
    // 0. Smooth Scroll
    const lenis = new Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        gestureDirection: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
        infinite: false,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    gsap.registerPlugin(ScrollTrigger);

    // Normaliser le scroll pour éviter les saccades
    ScrollTrigger.normalizeScroll(true);

    // Synchroniser ScrollTrigger avec Lenis
    lenis.on('scroll', ScrollTrigger.update);

    // 1. Hero
    gsap.from(".badge-container", { y: -20, opacity: 0, duration: 0.8, delay: 0.2 });
    gsap.from(".hero-title .split-line", { y: 100, opacity: 0, stagger: 0.2, duration: 1, ease: "power4.out" });
    gsap.from(".hero-subtitle", { y: 30, opacity: 0, duration: 0.8 }, "-=0.6");
    gsap.from(".hero-actions", { y: 20, opacity: 0, duration: 0.8 }, "-=0.6");

    // Animation de flottement infinie pour le background (la "planète")
    gsap.to(".hero-bg", {
        duration: 20,
        x: "2%",
        y: "2%",
        rotation: 0.01,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true
    });

    gsap.to(".hero-bg", {
        duration: 15,
        x: "-1%",
        y: "-1%",
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        delay: 5
    });

    // 2. Runtimes Orbit
    initOrbit();
    function initOrbit() {
        const container = document.getElementById('runtimes-anim');
        const descBox = document.getElementById('orbit-desc');
        const descTitle = document.getElementById('desc-title');
        const descText = document.getElementById('desc-text');

        const runtimesData = [
            { id: 'JS', name: 'Node.js', icon: '/assets/runtime-nodejs.png', desc: 'npm, yarn, pnpm. Hot reload < 2s avec PM2.' },
            { id: 'PY', name: 'Python', icon: '/assets/runtime-python.png', desc: 'pip, venv, Uvicorn, Gunicorn. Django, Flask, FastAPI ready.' },
            { id: 'PHP', name: 'PHP', icon: '/assets/runtime-php.png', desc: 'PHP-FPM, Composer, extensions MySQL/PostgreSQL incluses.' },
            { id: 'GO', name: 'Go', icon: '/assets/runtime-go.png', desc: 'Go 1.22+, compilation ARM64/amd64 automatique.' },
            { id: 'RS', name: 'Rust', icon: '/assets/runtime-rust.png', desc: 'Cargo, rustup, toolchain stable. Compilation optimisée.' },
            { id: 'RB', name: 'Ruby', icon: '/assets/runtime-ruby.png', desc: 'Bundler, Puma, Rails-ready. Gems pré-installés.' },
            { id: 'DK', name: 'Docker', icon: '/assets/runtime-docker.png', desc: 'docker-compose, Dockerfile. Conteneurs orchestrés.' }
        ];

        const total = runtimesData.length;
        let isPaused = false;
        const orbitBubbles = [];

        runtimesData.forEach((data, i) => {
            const item = document.createElement('div');
            item.className = 'orbit-item';

            // Add icon
            const img = document.createElement('img');
            img.src = data.icon;
            img.alt = data.name;
            img.style.width = '70%';
            img.style.height = '70%';
            img.style.objectFit = 'contain';
            item.appendChild(img);

            item.dataset.index = i;
            container.appendChild(item);
            orbitBubbles.push(item);

            const angle = (i / total) * Math.PI * 2;
            const radius = 250; // Increased radius for larger space

            gsap.set(item, {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });

            // Hover Events for Bubbles
            item.addEventListener('mouseenter', () => activateItem(i));
            item.addEventListener('mouseleave', deactivateItem);

            // Rotation animation
            gsap.to(item, {
                duration: 25,
                repeat: -1,
                ease: "none",
                modifiers: {
                    x: (x) => {
                        if (isPaused) return parseFloat(gsap.getProperty(item, "x"));
                        const time = Date.now() / 2500;
                        const currAngle = angle + time;
                        return Math.cos(currAngle) * radius;
                    },
                    y: (y) => {
                        if (isPaused) return parseFloat(gsap.getProperty(item, "y"));
                        const time = Date.now() / 2500;
                        const currAngle = angle + time;
                        return Math.sin(currAngle) * radius;
                    }
                }
            });
        });

        // Link right column items
        const serviceItems = document.querySelectorAll('.data-side .service-item');
        serviceItems.forEach((el, i) => {
            el.addEventListener('mouseenter', () => activateItem(i));
            el.addEventListener('mouseleave', deactivateItem);
        });

        function activateItem(i) {
            const data = runtimesData[i];
            const bubble = orbitBubbles[i];
            isPaused = true;
            descTitle.innerText = data.name;
            descText.innerText = data.desc;
            descBox.classList.add('active');
            gsap.to(".orbit-center", { scale: 0.8, opacity: 0.1, duration: 0.4 });

            // Highlight specific bubble
            orbitBubbles.forEach((b, idx) => {
                if (idx === i) {
                    gsap.to(b, { backgroundColor: '#8b5cf6', borderColor: '#fff', scale: 1.3, zIndex: 100, duration: 0.4 });
                } else {
                    gsap.to(b, { opacity: 0.2, scale: 0.8, duration: 0.4 });
                }
            });
        }

        function deactivateItem() {
            isPaused = false;
            descBox.classList.remove('active');
            gsap.to(".orbit-center", { scale: 1, opacity: 1, duration: 0.4 });
            orbitBubbles.forEach(b => {
                gsap.to(b, { backgroundColor: 'rgba(26, 26, 46, 0.8)', borderColor: 'rgba(255,255,255,0.08)', scale: 1, opacity: 1, zIndex: 10, duration: 0.4 });
            });
        }
    }

    // 3. Database Stream (Server Blades Insertion)
    // État initial défini explicitement pour éviter les problèmes de timing
    const disks = gsap.utils.toArray('.disk');

    // Définir l'état initial immédiatement
    gsap.set(disks, { x: 80, opacity: 0 });

    // Animation au scroll avec to() au lieu de from() pour plus de contrôle
    const dbTl = gsap.timeline({
        scrollTrigger: {
            trigger: "#db-anim",
            start: "top 85%",
            end: "center 50%",
            scrub: 0.8,
            invalidateOnRefresh: true,
            // Force le recalcul des positions
            refreshPriority: 1
        }
    });

    dbTl.to(disks, {
        x: 0,
        opacity: 1,
        stagger: 0.15,
        duration: 1,
        ease: "power2.out"
    });

    // 4. Security Shield Orbital System
    initSecurity();
    function initSecurity() {
        const layers = gsap.utils.toArray('.sec-layer');
        const ringRadii = [90, 140, 190];

        // Grouper et répartir équitablement sur chaque anneau
        const groups = {};
        layers.forEach(layer => {
            const r = layer.dataset.ring || "1";
            if (!groups[r]) groups[r] = [];
            groups[r].push(layer);
        });

        Object.keys(groups).forEach((ringKey, rIdx) => {
            const ringLayers = groups[ringKey];
            const radius = ringRadii[rIdx] || 110;

            ringLayers.forEach((layer, i) => {
                // Angle de départ réparti uniformément (360 / nombre d'éléments dans cet anneau)
                const startAngle = (i * (360 / ringLayers.length)) * (Math.PI / 180);

                gsap.set(layer, {
                    x: Math.cos(startAngle) * (radius + 30),
                    y: Math.sin(startAngle) * (radius + 30),
                    opacity: 0,
                    scale: 0.8
                });

                gsap.to(layer, {
                    x: Math.cos(startAngle) * radius,
                    y: Math.sin(startAngle) * radius,
                    opacity: 1,
                    scale: 1,
                    duration: 1,
                    delay: rIdx * 0.2,
                    ease: "back.out(1.4)",
                    scrollTrigger: {
                        trigger: "#sec-anim",
                        start: "top 85%"
                    }
                });

                // Rotation orbitale infinie
                gsap.to(layer, {
                    duration: 25 + (rIdx * 10),
                    repeat: -1,
                    ease: "none",
                    onUpdate: function () {
                        const prog = this.progress();
                        const curAngle = startAngle + (prog * Math.PI * 2);
                        gsap.set(layer, {
                            x: Math.cos(curAngle) * radius,
                            y: Math.sin(curAngle) * radius
                        });
                    }
                });
            });
        });

        gsap.to(".shield-main", {
            scale: 1.1,
            filter: "drop-shadow(0 0 30px rgba(139, 92, 246, 0.5))",
            duration: 2,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        });
    }

    // 5. Email Pipeline
    const emailTl = gsap.timeline({
        scrollTrigger: {
            trigger: "#email-anim",
            start: "top 75%",
            onEnter: () => startEmailLoop()
        }
    });

    emailTl.from(".pipeline-node", {
        opacity: 0,
        y: 20,
        stagger: 0.15,
        duration: 0.8,
        ease: "power2.out"
    });

    function startEmailLoop() {
        const nodes = gsap.utils.toArray('.pipeline-node');
        const packet = document.querySelector('.mail-packet');
        if (!packet || !nodes.length) return;

        const tl = gsap.timeline({ repeat: -1, delay: 1 });

        tl.set(packet, { y: 0, opacity: 0, scale: 0.8 });

        nodes.forEach((node, i) => {
            const targetY = node.offsetTop + 18 + 25; // padding top 18 + icon 50/2 = 43px

            tl.to(packet, {
                y: targetY - 10, // Center the 20px packet
                opacity: 1,
                duration: 0.7,
                ease: "power2.inOut",
                onStart: () => {
                    gsap.to(node, {
                        borderColor: "rgba(139, 92, 246, 0.6)",
                        backgroundColor: "rgba(139, 92, 246, 0.08)",
                        duration: 0.2
                    });
                },
                onComplete: () => {
                    gsap.to(node, {
                        borderColor: "rgba(255, 255, 255, 0.08)",
                        backgroundColor: "rgba(10, 10, 10, 0.6)",
                        duration: 0.4
                    });
                }
            });

            tl.to(packet, { scale: 1.2, duration: 0.15, yoyo: true, repeat: 1 });
        });

        tl.to(packet, {
            y: "+=60",
            opacity: 0,
            duration: 0.5,
            ease: "power2.in"
        });
    }

    // 6. Performance Graph
    initHealthGraph();
    function initHealthGraph() {
        const canvas = document.getElementById('health-graph');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let width, height;

        function resize() {
            width = canvas.width = canvas.parentElement.offsetWidth;
            height = canvas.height = 300;
        }
        resize();
        window.addEventListener('resize', resize);

        let points = [];
        const count = 40;
        for (let i = 0; i <= count; i++) {
            points.push({ x: (width / count) * i, y: 150, targetY: 150 });
        }

        let isAnimating = false;
        function animateGraph() {
            if (!isAnimating) return;
            ctx.clearRect(0, 0, width, height);
            ctx.beginPath();
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 3;
            points.forEach((p, i) => {
                p.x = (width / count) * i;
                if (Math.random() > 0.95) p.targetY = 150 + (Math.random() - 0.5) * 150;
                p.y += (p.targetY - p.y) * 0.1;
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
            requestAnimationFrame(animateGraph);
        }

        ScrollTrigger.create({
            trigger: canvas,
            start: "top bottom",
            end: "bottom top",
            onEnter: () => { isAnimating = true; animateGraph(); },
            onLeave: () => { isAnimating = false; },
            onEnterBack: () => { isAnimating = true; animateGraph(); },
            onLeaveBack: () => { isAnimating = false; }
        });
    }

    // Reveal Observer
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    // 8. Info Box Animations (Stats + Text Highlights)
    initInfoBoxAnimations();
    function initInfoBoxAnimations() {
        const infoBoxes = document.querySelectorAll('.section-info-box');
        if (!infoBoxes.length) return;

        // Observe each info box - trigger when 60% visible (prevents early trigger)
        const boxObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
                    entry.target.classList.add('animated');
                    animateInfoBox(entry.target);
                }
            });
        }, { threshold: 0.6 });

        infoBoxes.forEach(box => boxObserver.observe(box));

        function animateInfoBox(box) {
            let currentDelay = 0;

            // 1. Animate badge with typing effect (first)
            const badge = box.querySelector('.info-box-badge');
            let badgeDuration = 0;
            if (badge) {
                badgeDuration = animateBadge(badge);
                currentDelay = badgeDuration + 200;
            }

            // 2. Animate title with typing effect (after badge)
            const title = box.querySelector('.info-box-title');
            let titleDuration = 0;
            if (title) {
                const titleLength = title.textContent.length;
                titleDuration = titleLength * 30 + 300;
                setTimeout(() => {
                    animateTitle(title);
                }, currentDelay);
                currentDelay += titleDuration;
            }

            // 3. Animate strong elements in description (highlight effect)
            const description = box.querySelector('.info-box-description');
            if (description) {
                const strongElements = description.querySelectorAll('strong');
                strongElements.forEach((strong, index) => {
                    setTimeout(() => {
                        strong.classList.add('highlight-animate');
                    }, currentDelay + (index * 150));
                });
            }

            // 4. Animate stat values with counter effect
            const statValues = box.querySelectorAll('.info-stat-value');
            statValues.forEach((stat, index) => {
                setTimeout(() => {
                    animateStatValue(stat);
                }, currentDelay + 300 + (index * 200));
            });
        }

        function animateBadge(element) {
            const text = element.textContent.trim();
            const duration = text.length * 40 + 200; // Return estimated duration
            element.textContent = '';
            element.classList.add('badge-typing');

            let i = 0;
            const typingSpeed = 40; // ms per char

            function typeChar() {
                if (i < text.length) {
                    element.textContent += text.charAt(i);
                    i++;
                    setTimeout(typeChar, typingSpeed);
                } else {
                    setTimeout(() => {
                        element.classList.remove('badge-typing');
                        element.classList.add('badge-typed');
                    }, 200);
                }
            }

            typeChar();
            return duration;
        }

        function animateTitle(element) {
            const text = element.textContent.trim();
            element.textContent = '';
            element.classList.add('title-typing');

            let i = 0;
            const typingSpeed = 30; // ms per char (fast but visible)

            function typeChar() {
                if (i < text.length) {
                    element.textContent += text.charAt(i);
                    i++;
                    setTimeout(typeChar, typingSpeed);
                } else {
                    // Typing done - remove cursor after short delay
                    setTimeout(() => {
                        element.classList.remove('title-typing');
                        element.classList.add('title-typed');
                    }, 500);
                }
            }

            typeChar();
        }

        function animateStatValue(element) {
            const text = element.textContent.trim();
            const duration = 1000; // ms

            // Check if it's a numeric value we can animate
            const numericMatch = text.match(/^([<>]?\s*)(\d+(?:\.\d+)?)(.*)/);

            if (numericMatch) {
                // Numeric value: animate the counter
                const prefix = numericMatch[1] || '';
                const targetNum = parseFloat(numericMatch[2]);
                const suffix = numericMatch[3] || '';
                const isDecimal = text.includes('.');
                const startTime = performance.now();

                element.textContent = prefix + '0' + suffix;

                function update(currentTime) {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);

                    // Easing function (ease-out cubic)
                    const easeProgress = 1 - Math.pow(1 - progress, 3);
                    const currentValue = targetNum * easeProgress;

                    if (isDecimal) {
                        element.textContent = prefix + currentValue.toFixed(1) + suffix;
                    } else {
                        element.textContent = prefix + Math.round(currentValue) + suffix;
                    }

                    if (progress < 1) {
                        requestAnimationFrame(update);
                    } else {
                        element.textContent = text;
                    }
                }

                requestAnimationFrame(update);
            } else {
                // Text value (Ed25519, TLS 1.3, etc.): typing effect
                const chars = text.split('');
                element.textContent = '';
                element.classList.add('typing-stat');

                let i = 0;
                const typingSpeed = 40; // ms per char

                function typeChar() {
                    if (i < chars.length) {
                        element.textContent += chars[i];
                        i++;
                        setTimeout(typeChar, typingSpeed);
                    } else {
                        element.classList.remove('typing-stat');
                    }
                }

                typeChar();
            }
        }
    }

    // 7. CI/CD Section Animation
    const cicdSection = document.querySelector('.cicd-section');
    if (cicdSection) {
        const cicdObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                }
            });
        }, { threshold: 0.3 });

        cicdObserver.observe(cicdSection);
    }

    // Fix ultime pour les positions de scroll
    // Refresh multiple pour s'assurer que tout est calculé correctement
    window.addEventListener('load', () => {
        // Premier refresh après le chargement complet
        ScrollTrigger.refresh();

        // Deuxième refresh après un court délai pour les polices et images lazy-loaded
        setTimeout(() => {
            ScrollTrigger.refresh(true); // true = recalcul complet
        }, 200);
    });

    // Refresh aussi quand toutes les images sont chargées
    const images = document.querySelectorAll('img');
    let loadedCount = 0;
    images.forEach(img => {
        if (img.complete) {
            loadedCount++;
        } else {
            img.addEventListener('load', () => {
                loadedCount++;
                if (loadedCount === images.length) {
                    ScrollTrigger.refresh(true);
                }
            });
        }
    });
});
