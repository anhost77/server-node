/* ServerFlow Deployments Page Logic */

document.addEventListener('DOMContentLoaded', () => {
    // 0. Initialize Smooth Scroll (Lenis)
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Register GSAP Plugins
    gsap.registerPlugin(ScrollTrigger);

    // 1. Hero Section - Sticky Text Reveal
    const heroTl = gsap.timeline({
        scrollTrigger: {
            trigger: ".hero-sticky",
            start: "top top",
            end: "bottom bottom",
            scrub: 1,
        }
    });

    heroTl.to(".hero-title .word", {
        opacity: 1,
        y: 0,
        stagger: 0.1,
        duration: 2
    });

    heroTl.to(".hero-sticky .subtitle", {
        opacity: 1,
        duration: 1
    }, "-=1");

    // 2. Runtimes - Horizontal Scroll
    const runtimesSection = document.querySelector('.horizontal-scroll');
    const track = document.querySelector('.track');

    gsap.to(track, {
        x: () => -(track.scrollWidth - window.innerWidth + 200),
        ease: "none",
        scrollTrigger: {
            trigger: runtimesSection,
            start: "top top",
            end: "bottom bottom",
            scrub: 1,
            invalidateOnRefresh: true,
        }
    });

    // 3D Tilt for cards
    document.querySelectorAll('.card-3d').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const xc = rect.width / 2;
            const yc = rect.height / 2;
            const dx = x - xc;
            const dy = y - yc;

            gsap.to(card, {
                rotateY: dx / 10,
                rotateX: -dy / 10,
                duration: 0.5,
                ease: "power2.out"
            });
        });

        card.addEventListener('mouseleave', () => {
            gsap.to(card, {
                rotateY: 0,
                rotateX: 0,
                duration: 0.5,
                ease: "power2.out"
            });
        });
    });

    // 3. Databases - Card Stack Reveal
    const dbCards = gsap.utils.toArray('.database-card');
    const stackTl = gsap.timeline({
        scrollTrigger: {
            trigger: ".card-stack-section",
            start: "top 20%",
            end: "bottom bottom",
            scrub: 1,
        }
    });

    dbCards.forEach((card, i) => {
        if (i === 0) return;
        stackTl.fromTo(card,
            { y: i * 40, scale: 1 - (i * 0.05), opacity: 0.5 },
            { y: 0, scale: 1, opacity: 1, duration: 1 },
            i * 0.5
        );
    });

    // Draw connection lines
    gsap.to(".line-path", {
        strokeDashoffset: 0,
        scrollTrigger: {
            trigger: ".card-stack-section",
            start: "top 40%",
            end: "center center",
            scrub: 1
        }
    });

    // 4. Split Screen Parallax & Merge
    const splitTl = gsap.timeline({
        scrollTrigger: {
            trigger: ".split-screen",
            start: "top top",
            end: "bottom bottom",
            scrub: 1,
            pin: true
        }
    });

    splitTl.from(".left .side-content", { y: 100, opacity: 0 });
    splitTl.from(".right .side-content", { y: -100, opacity: 0 }, 0);

    splitTl.to(".merge-center", {
        scale: 1,
        opacity: 1,
        duration: 1
    });

    // 5. Email Pipeline Animation
    const pipelineTl = gsap.timeline({
        scrollTrigger: {
            trigger: ".email-pipeline",
            start: "top 60%",
        }
    });

    const nodes = gsap.utils.toArray('.pipeline-node');
    const arrows = gsap.utils.toArray('.pipeline-arrow');

    nodes.forEach((node, i) => {
        pipelineTl.to(node, {
            opacity: 1,
            x: 0,
            duration: 0.5,
            ease: "back.out(1.7)"
        });
        if (arrows[i]) {
            pipelineTl.to(arrows[i], {
                opacity: 1,
                scaleX: 1,
                duration: 0.3
            });
        }
    });

    // 6. Monitoring - Dashboard buildup
    const monitoringTl = gsap.timeline({
        scrollTrigger: {
            trigger: ".monitoring-dashboard",
            start: "top 40%",
        }
    });

    monitoringTl.from(".device-frame", {
        scale: 0.8,
        rotateY: 0,
        rotateX: 0,
        opacity: 0,
        duration: 1.5,
        ease: "power4.out"
    });

    // Animate stats
    document.querySelectorAll('.stat-value').forEach(stat => {
        const target = parseFloat(stat.getAttribute('data-target'));
        const obj = { val: 0 };
        gsap.to(obj, {
            val: target,
            duration: 2,
            scrollTrigger: {
                trigger: stat,
                start: "top 80%",
            },
            onUpdate: () => {
                stat.innerText = obj.val.toFixed(target % 1 === 0 ? 0 : 2);
            }
        });
    });

    // Fake Charts (Chart.js)
    const ctxCpu = document.getElementById('cpu-chart').getContext('2d');
    new Chart(ctxCpu, {
        type: 'line',
        data: {
            labels: ['', '', '', '', '', ''],
            datasets: [{
                data: [12, 19, 3, 5, 2, 3],
                borderColor: '#8b5cf6',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0
            }]
        },
        options: { plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
    });

    // 7. Backup Cloud Animation
    const backupTl = gsap.timeline({
        scrollTrigger: {
            trigger: ".backup-cloud",
            start: "top 40%",
            end: "bottom 60%",
            scrub: 1
        }
    });

    backupTl.to(".data-file", {
        y: 200,
        scale: 0.5,
        opacity: 0,
        duration: 2
    });

    backupTl.to(".cloud-provider", {
        opacity: 1,
        scale: 1.1,
        stagger: 0.2,
        duration: 1
    }, "-=1");

    backupTl.to(".shield-lock", {
        scale: 1,
        opacity: 1,
        duration: 1
    });

    // 8. CTA Convergence Particles
    initConvergence();

    function initConvergence() {
        const canvas = document.getElementById('convergence-canvas');
        const ctx = canvas.getContext('2d');
        let width, height, particles = [];

        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }

        window.addEventListener('resize', resize);
        resize();

        class Particle {
            constructor() {
                this.reset();
            }
            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.targetX = width / 2;
                this.targetY = height / 2;
                this.size = Math.random() * 2 + 1;
                this.speed = Math.random() * 0.02 + 0.01;
                this.opacity = Math.random() * 0.5 + 0.2;
                this.color = Math.random() > 0.5 ? '#8b5cf6' : '#10b981';
            }
            update(progress) {
                // Converge as scroll progress increases
                const moveX = (this.targetX - this.x) * progress * this.speed;
                const moveY = (this.targetY - this.y) * progress * this.speed;
                this.x += moveX;
                this.y += moveY;
            }
            draw() {
                ctx.fillStyle = this.color;
                ctx.globalAlpha = this.opacity;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        for (let i = 0; i < 200; i++) particles.push(new Particle());

        function animate() {
            ctx.clearRect(0, 0, width, height);

            // Get scroll progress of the CTA section
            const trigger = ScrollTrigger.getById('cta-trigger');
            const progress = trigger ? trigger.progress : 0;

            particles.forEach(p => {
                p.update(progress);
                p.draw();
            });
            requestAnimationFrame(animate);
        }

        ScrollTrigger.create({
            id: 'cta-trigger',
            trigger: ".cta-convergence",
            start: "top bottom",
            end: "center center",
            scrub: true
        });

        animate();
    }

    // Generic reveal animations
    gsap.utils.toArray('.reveal').forEach(el => {
        gsap.from(el, {
            y: 50,
            opacity: 0,
            duration: 1,
            scrollTrigger: {
                trigger: el,
                start: "top 90%",
                toggleActions: "play none none reverse"
            }
        });
    });
});
