document.addEventListener('DOMContentLoaded', () => {
  // 1. Scroll-Triggered Animations (Intersection Observer)
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Optional: Stop observing once visible if you don't want it to toggle
        // observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document
    .querySelectorAll('.reveal, .stagger-child, .stagger-parent')
    .forEach((el) => observer.observe(el));

  // 2. Parallax Effects
  let scrollY = window.scrollY;

  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
    requestAnimationFrame(updateParallax);
    updateStickyProgress();
    updateScrollIndicator();
  });

  function updateParallax() {
    document.querySelectorAll('.parallax').forEach((el) => {
      const speed = parseFloat(el.dataset.speed) || 0.5;
      const offset = el.getBoundingClientRect().top;
      // Only animate if in view to save resources
      if (offset < window.innerHeight && offset > -el.offsetHeight) {
        el.style.transform = `translate3d(0, ${scrollY * speed * 0.1}px, 0)`;
      }
    });
  }

  // 3. Sticky Section Logic (The "Problem/Solution" flow)
  const stickySection = document.querySelector('.sticky-wrapper');
  const stickyGraphics = document.querySelectorAll('.sticky-graphic');
  const stickySteps = document.querySelectorAll('.sticky-step');

  function updateStickyProgress() {
    if (!stickySection) return;

    const rect = stickySection.getBoundingClientRect();
    const offsetTop = rect.top;
    const sectionHeight = rect.height;
    const windowHeight = window.innerHeight;

    // Calculate progress 0 to 1 based on scroll position within the section
    // We want the animation to happen while the section is effectively "stuck"
    let progress = (windowHeight - offsetTop) / sectionHeight;
    progress = Math.min(Math.max(progress, 0), 1);

    // Logic to switch active step based on progress
    // Assuming 3 steps -> 0-0.33, 0.33-0.66, 0.66-1
    let activeIndex = 0;
    if (progress > 0.66) activeIndex = 2;
    else if (progress > 0.33) activeIndex = 1;

    // Update Text Opacity
    stickySteps.forEach((step, index) => {
      if (index === activeIndex) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });

    // Update Graphics (if separate) or perform specific transforms
    stickyGraphics.forEach((graphic, index) => {
      if (index === activeIndex) {
        graphic.classList.add('active');
      } else {
        graphic.classList.remove('active');
      }
    });
  }

  // 4. Progress Scroll Indicator
  const progressBar = document.querySelector('.scroll-progress-bar');
  function updateScrollIndicator() {
    if (!progressBar) return;
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (scrollY / totalHeight) * 100;
    progressBar.style.width = `${progress}%`;
  }

  // Initialize logic
  updateParallax();
});
