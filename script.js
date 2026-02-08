document.addEventListener('DOMContentLoaded', () => {
    // Simple intersection observer for fade-in animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    // Elements to animate
    const animatedElements = document.querySelectorAll('.product-showcase, .feature-card, .btn');

    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(el);
    });

    // Add class for visible state
    const style = document.createElement('style');
    style.innerHTML = `
        .visible {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);
});
// Carousel Logic
const cards = document.querySelectorAll('.carousel-card');
let currentIndex = 0;

function updateCarousel() {
    cards.forEach((card, index) => {
        // Reset classes
        card.className = 'carousel-card';

        // Calculate offset from current index
        let offset = (index - currentIndex + cards.length) % cards.length;

        if (offset === 0) {
            card.classList.add('active');
        } else if (offset === 1) {
            card.classList.add('next');
        } else if (offset === 2) {
            card.classList.add('next-2');
        } else {
            card.classList.add('next-3');
            // Hide others or stack them far back
            if (offset > 3) card.style.opacity = '0';
        }
    });

    currentIndex = (currentIndex + 1) % cards.length;
}

// Initial set
updateCarousel();

// Auto-cycle every 4 seconds
setInterval(updateCarousel, 4000);

// SmartScreen Modal Logic
const downloadBtn = document.querySelector('.btn-primary');
const modal = document.getElementById('smartscreen-modal');
const proceedBtn = document.getElementById('proceed-download');
const cancelBtn = document.getElementById('cancel-download');

if (downloadBtn && modal && proceedBtn && cancelBtn) {
    downloadBtn.addEventListener('click', (e) => {
        // Check if the button is the download button (it should be the first btn-primary)
        if (e.target.textContent.includes('Download')) {
            e.preventDefault();
            modal.classList.add('active');
        }
    });

    proceedBtn.addEventListener('click', () => {
        window.location.href = downloadBtn.href;
        modal.classList.remove('active');
    });

    cancelBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
}
