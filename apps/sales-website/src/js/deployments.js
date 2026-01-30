/* ServerFlow Deployments Page Logic */

document.addEventListener('DOMContentLoaded', () => {
    // Register GSAP Plugins first
    gsap.registerPlugin(ScrollTrigger);

    // 0. Initialize Smooth Scroll (Lenis) with GSAP integration
    // Ajouter classe pour désactiver scroll-behavior CSS
    document.documentElement.classList.add('lenis');

    const lenis = new Lenis({
        duration: 1.0,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 0.8,
        touchMultiplier: 1.5,
        infinite: false,
    });

    // Synchronize Lenis with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // Update ScrollTrigger when Lenis scrolls
    ScrollTrigger.scrollerProxy(document.body, {
        scrollTop(value) {
            if (arguments.length) {
                lenis.scrollTo(value, { immediate: true });
            }
            return lenis.scroll;
        },
        getBoundingClientRect() {
            return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
        },
    });

    // 1. Hero Section - Animate on page load + parallax on scroll
    // Phase 1: Animation d'entrée au chargement
    const heroEntranceTl = gsap.timeline();

    heroEntranceTl.from(".badge-container", {
        opacity: 0,
        y: 30,
        duration: 0.6,
        ease: "power3.out"
    });

    heroEntranceTl.from(".hero-title .word", {
        opacity: 0,
        y: 50,
        stagger: 0.12,
        duration: 0.8,
        ease: "power3.out"
    }, "-=0.3");

    heroEntranceTl.from(".hero-sticky .subtitle", {
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: "power3.out"
    }, "-=0.4");

    heroEntranceTl.from(".scroll-indicator", {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: "power3.out"
    }, "-=0.2");

    // Phase 2: Effet parallax au scroll (fade out progressif)
    gsap.to(".sticky-content", {
        opacity: 0.2,
        y: -150,
        scale: 0.8,
        ease: "none",
        scrollTrigger: {
            trigger: ".hero-sticky",
            start: "top top",
            end: "bottom top",
            scrub: 1,
        }
    });

    // 2. Runtimes - Horizontal Scroll
    const runtimesSection = document.querySelector('.horizontal-scroll');
    const track = document.querySelector('.track');

    const horizontalAnim = gsap.to(track, {
        x: () => -(track.scrollWidth - window.innerWidth + 200),
        ease: "none",
        scrollTrigger: {
            id: "horizontal-scroll-trigger",
            trigger: runtimesSection,
            start: "top top",
            end: "bottom bottom",
            scrub: 1,
            invalidateOnRefresh: true,
        }
    });

    // 3D Tilt for cards + Scroll Reveal
    document.querySelectorAll('.card-3d').forEach(card => {
        // Initial state for reveal
        gsap.set(card, { opacity: 0, y: 30, scale: 0.95 });

        // Scroll Reveal
        ScrollTrigger.create({
            trigger: card,
            start: "right 110%",
            containerAnimation: horizontalAnim,
            onEnter: () => {
                gsap.to(card, {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 0.8,
                    ease: "power3.out"
                });
            }
        });

        // Spotlight highlight when crossing the center
        gsap.to(card, {
            boxShadow: `0 0 40px rgba(var(--lang-color-rgb), 0.2)`,
            borderColor: "rgba(var(--lang-color-rgb), 0.4)",
            duration: 0.4,
            scrollTrigger: {
                trigger: card,
                start: "center 65%",
                end: "center 35%",
                containerAnimation: horizontalAnim,
                toggleActions: "play reverse play reverse"
            }
        });

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const xc = rect.width / 2;
            const yc = rect.height / 2;
            const dx = x - xc;
            const dy = y - yc;

            gsap.to(card, {
                rotateY: dx / 15, // Softer tilt
                rotateX: -dy / 15,
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

    // 3. Databases - 3D Flip Cards Animation
    const dbCards = gsap.utils.toArray('.database-card');

    dbCards.forEach((card, i) => {
        // Initial state - cards rotated and hidden
        gsap.set(card, {
            opacity: 0,
            rotateY: -30,
            rotateX: 15,
            y: 80,
            scale: 0.9
        });

        // Animate each card with stagger
        gsap.to(card, {
            opacity: 1,
            rotateY: 0,
            rotateX: 0,
            y: 0,
            scale: 1,
            duration: 1,
            delay: i * 0.15,
            ease: "power3.out",
            scrollTrigger: {
                trigger: ".card-stack-section",
                start: "top 70%",
            }
        });
    });


    // 4. Web & Security - Card animations with 3D rotation on scroll
    const splitLeft = document.querySelector(".split-side.left");
    const splitRight = document.querySelector(".split-side.right");
    const splitGrid = document.querySelector(".split-grid");

    if (splitLeft && splitGrid) {
        // Entrance
        gsap.from(splitLeft, {
            x: -80,
            opacity: 0,
            duration: 1.2,
            ease: "expo.out",
            scrollTrigger: {
                trigger: splitGrid,
                start: "top 90%",
            }
        });

        // Book Logic (Rotation from center) - reduced amplitude
        gsap.fromTo(splitLeft, {
            rotateY: -8,
            rotateX: 3,
            transformOrigin: "right center"
        }, {
            rotateY: 8,
            rotateX: -3,
            ease: "none",
            scrollTrigger: {
                trigger: splitGrid,
                start: "top 100%",
                end: "bottom 0%",
                scrub: 1.5,
            }
        });
    }

    if (splitRight && splitGrid) {
        // Entrance
        gsap.from(splitRight, {
            x: 80,
            opacity: 0,
            duration: 1.2,
            delay: 0.2,
            ease: "expo.out",
            scrollTrigger: {
                trigger: splitGrid,
                start: "top 90%",
            }
        });

        // Book Logic (Rotation from center) - reduced amplitude
        gsap.fromTo(splitRight, {
            rotateY: 8,
            rotateX: 3,
            transformOrigin: "left center"
        }, {
            rotateY: -8,
            rotateX: -3,
            ease: "none",
            scrollTrigger: {
                trigger: splitGrid,
                start: "top 100%",
                end: "bottom 0%",
                scrub: 1.5,
            }
        });
    }

    // 5. Email Pipeline Animation
    const pipelineTl = gsap.timeline({
        scrollTrigger: {
            trigger: ".email-pipeline",
            start: "top 70%", // Start earlier
        }
    });

    const nodes = gsap.utils.toArray('.pipeline-node');
    const arrows = gsap.utils.toArray('.pipeline-arrow');

    // Reset initial state in JS to be sure, although CSS handles it too
    // But GSAP 'to' will animate to values, assuming current is start.
    // CSS has transform: translateY(30px).

    nodes.forEach((node, i) => {
        pipelineTl.to(node, {
            opacity: 1,
            y: 0, // Reset translateY
            duration: 0.6,
            ease: "back.out(1.5)"
        }, i * 0.2); // Stagger start time

        if (arrows[i]) {
            pipelineTl.to(arrows[i], {
                opacity: 1,
                duration: 0.4
            }, ">-0.2"); // Overlap slightly with node animation
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

    // 7. Backup Cards Animation - use fromTo with once to prevent re-triggering
    gsap.utils.toArray('.backup-card').forEach((card, i) => {
        gsap.fromTo(card,
            { opacity: 0, y: 50, scale: 0.9 },
            {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.8,
                delay: i * 0.15,
                ease: "power3.out",
                scrollTrigger: {
                    trigger: ".backup-cloud",
                    start: "top 70%",
                    once: true
                }
            }
        );
    });

    // 8. CTA Section Animation - use fromTo with once
    gsap.fromTo(".cta-content",
        { opacity: 0, y: 60 },
        {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
                trigger: ".cta-section",
                start: "top 75%",
                once: true
            }
        }
    );

    gsap.fromTo(".cta-content .btn",
        { opacity: 0, y: 30, scale: 0.9 },
        {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            delay: 0.3,
            ease: "back.out(1.7)",
            scrollTrigger: {
                trigger: ".cta-section",
                start: "top 75%",
                once: true
            }
        }
    );

    // Generic reveal animations - use set + to instead of from to avoid hidden state
    gsap.utils.toArray('.reveal').forEach(el => {
        gsap.set(el, { opacity: 1, y: 0 }); // Ensure visible by default

        ScrollTrigger.create({
            trigger: el,
            start: "top 90%",
            onEnter: () => {
                gsap.fromTo(el,
                    { y: 30, opacity: 0 },
                    { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
                );
            },
            once: true
        });
    });

    // Refresh ScrollTrigger after all animations are set up
    ScrollTrigger.refresh();

    // Refresh on window resize
    window.addEventListener('resize', () => {
        ScrollTrigger.refresh();
    });
});
