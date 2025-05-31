document.addEventListener('DOMContentLoaded', function() {
    
    const newUploadBtn = document.getElementById('newUploadBtn');
    const copyBtn = document.getElementById('copyBtn');
    const urlText = document.getElementById('urlText');
    const bucketIdElement = document.getElementById('bucketId');
    const createdAtElement = document.getElementById('createdAt');
    const expiresInElement = document.getElementById('expiresIn');
    const protectedStatusElement = document.getElementById('protectedStatus');

    
    const urlParams = new URLSearchParams(window.location.search);
    const bucketId = urlParams.get('b');
    
    if (!bucketId) {
        console.error('Bucket ID not found in URL');
        return;
    }
    
    
    bucketIdElement.textContent = bucketId;
    urlText.textContent = `${window.location.origin}/b/${bucketId}`;
    urlText.href = `/b/${bucketId}`

    
    newUploadBtn.addEventListener('click', () => {
        window.location.href = '/';
    });

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(urlText.textContent).then(() => {
            alert('URL copied to clipboard!');
        });
    });

    
    fetchBucketData(bucketId);
});

async function fetchBucketData(bucketId) {
    try {
        const response = await fetch(`/api/b/${bucketId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch bucket data');
        }
        
        const data = await response.json();
        displayBucketData(data);
    } catch (error) {
        console.error('Error fetching bucket data:', error);
        displayErrorState();
    }
}

function displayBucketData(data) {
    const createdAtElement = document.getElementById('createdAt');
    const expiresInElement = document.getElementById('expiresIn');
    const protectedStatusElement = document.getElementById('protectedStatus');

    
    createdAtElement.textContent = formatDateTime(data.created_at);
    expiresInElement.textContent = calculateTimeRemaining(data.expires_at);
    
    
    const isProtected = !!data.has_password;
    protectedStatusElement.textContent = isProtected ? 'Yes' : 'No';
    protectedStatusElement.className = isProtected ? 'protected-true' : 'protected-false';
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

function calculateTimeRemaining(expiresAtString) {
    const expiresAt = new Date(expiresAtString);
    const now = new Date();
    const diff = expiresAt - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
}

function displayErrorState() {
    const infoElements = document.querySelectorAll('.info-value');
    infoElements.forEach(el => {
        if (!el.textContent.trim()) {
            el.textContent = 'Error loading data';
            el.style.color = 'var(--error-color)';
        }
    });
}