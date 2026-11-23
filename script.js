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
// Carousel Logic (supports multiple independent product carousels)
document.querySelectorAll('.carousel-container').forEach((container) => {
    const cards = container.querySelectorAll('.carousel-card');
    if (cards.length === 0) return;
    let currentIndex = 0;

    function updateCarousel() {
        cards.forEach((card, index) => {
            card.className = 'carousel-card';
            const offset = (index - currentIndex + cards.length) % cards.length;
            if (offset === 0) {
                card.classList.add('active');
            } else if (offset === 1) {
                card.classList.add('next');
            } else if (offset === 2) {
                card.classList.add('next-2');
            } else {
                card.classList.add('next-3');
                if (offset > 3) card.style.opacity = '0';
            }
        });
        currentIndex = (currentIndex + 1) % cards.length;
    }

    updateCarousel();
    if (cards.length > 1) {
        setInterval(updateCarousel, 4000);
    }
});

// SmartScreen Modal Logic
const downloadBtns = document.querySelectorAll('a.btn-primary');
const modal = document.getElementById('smartscreen-modal');
const proceedBtn = document.getElementById('proceed-download');
const cancelBtn = document.getElementById('cancel-download');

let targetDownloadUrl = '';

if (modal && proceedBtn && cancelBtn) {
    downloadBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Check if the button is a download button
            if (e.currentTarget.textContent.includes('Download')) {
                e.preventDefault();
                targetDownloadUrl = e.currentTarget.href;
                modal.classList.add('active');
            }
        });
    });

    proceedBtn.addEventListener('click', () => {
        if (targetDownloadUrl) {
            window.location.href = targetDownloadUrl;
        }
        modal.classList.remove('active');
    });

    cancelBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        targetDownloadUrl = '';
    });

    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            targetDownloadUrl = '';
        }
    });
}

// Fetch latest WeatherLight release from GitHub
async function updateWeatherLightDownloadLink() {
    try {
        const response = await fetch('https://api.github.com/repos/jonkt/weatherlight/releases/latest');
        if (!response.ok) throw new Error('Network response was not ok');
        const releaseData = await response.json();

        // Find the .exe asset
        const exeAsset = releaseData.assets.find(asset => asset.name.endsWith('.exe'));

        if (exeAsset) {
            const downloadBtn = document.getElementById('weatherlight-download-btn');
            if (downloadBtn) {
                downloadBtn.href = exeAsset.browser_download_url;
                // Parse version tag and update button text
                const version = releaseData.tag_name || releaseData.name;
                downloadBtn.textContent = `Download WeatherLight ${version} (Windows Only)`;
            }
        }
    } catch (error) {
        console.error('Error fetching latest WeatherLight release:', error);
    }
}

document.addEventListener('DOMContentLoaded', updateWeatherLightDownloadLink);

// Fetch latest DeepPhoto Studio release from GitHub
async function updateDeepPhotoDownloadLink() {
    try {
        const response = await fetch('https://api.github.com/repos/jonkt/DeepPhoto/releases/latest');
        if (!response.ok) throw new Error('Network response was not ok');
        const releaseData = await response.json();

        const exeAsset = releaseData.assets.find(asset => asset.name.endsWith('.exe'));
        if (exeAsset) {
            const downloadBtn = document.getElementById('deepphoto-download-btn');
            if (downloadBtn) {
                downloadBtn.href = exeAsset.browser_download_url;
                const version = releaseData.tag_name || releaseData.name;
                downloadBtn.textContent = `Download DeepPhoto Studio ${version} (Windows Only)`;
            }
        }
    } catch (error) {
        console.error('Error fetching latest DeepPhoto Studio release:', error);
    }
}

document.addEventListener('DOMContentLoaded', updateDeepPhotoDownloadLink);
