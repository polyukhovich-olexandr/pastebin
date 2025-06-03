document.addEventListener('DOMContentLoaded', () => {
    const bucketId = window.location.pathname.split('/b/')[1];
    const fileList = document.getElementById('fileList');
    const passwordForm = document.getElementById('passwordForm');
    const createdAt = document.getElementById('createdAt');
    const expiresAt = document.getElementById('expiresAt');
    let accessToken = localStorage.getItem(`accessToken_${bucketId}`) || null;
    const bucketData = window.bucketData;

    if (bucketData) {
        createdAt.textContent = new Date(bucketData.created_at).toLocaleString();
        expiresAt.textContent = bucketData.is_expired ? 'Expired' : new Date(bucketData.expires_at).toLocaleString();
    }

    loadFiles();

    async function loadFiles() {
        if (bucketData?.has_password) {
            await loadFilesWithToken();
        } else {
            await loadFilesWithoutToken();
        }
    }

    async function loadFilesWithoutToken() {
        try {
            const res = await fetch(`/api/b/${bucketId}/files`);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to load files');
            }
            const files = await res.json();
            renderFiles(files);
            passwordForm.style.display = 'none';
        } catch (e) {
            fileList.innerHTML = `<div class="error">${e.message}</div>`;
        }
    }

    async function loadFilesWithToken() {
        if (!accessToken) {
            passwordForm.style.display = 'block';
            return;
        }

        try {
            const res = await fetch(`/api/b/${bucketId}/files`, {
                headers: { 'X-Access-Token': accessToken }
            });
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    passwordForm.style.display = 'block';
                    localStorage.removeItem(`accessToken_${bucketId}`);
                    accessToken = null;
                    return;
                }
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to load files');
            }
            const files = await res.json();
            renderFiles(files);
            passwordForm.style.display = 'none';
        } catch (e) {
            fileList.innerHTML = `<div class="error">${e.message}</div>`;
        }
    }

    function renderFiles(files) {
        if (!files || files.length === 0) {
            fileList.innerHTML = '<div class="no-files">No files in this bucket</div>';
            return;
        }

        fileList.innerHTML = files.map(file => `
            <div class="file-item">
                <div class="file-header">
                    <div class="file-preview">
                        <i class="fas ${getFileIcon(file.original_name)}"></i>
                    </div>
                    <div class="file-info">
                        <div class="file-name">${file.original_name}</div>
                        <div class="file-size">${formatFileSize(file.size)}</div>
                    </div>
                    <div class="file-actions">
                        ${
                            bucketData?.has_password
                            ? `<button class="file-view-btn" data-stored-name="${file.stored_name}"><i class="fas fa-eye"></i></button>
                               <button class="file-download-btn" data-stored-name="${file.stored_name}"><i class="fas fa-download"></i></button>`
                            : `<a href="/b/${bucketId}/${file.stored_name}/view" target="_blank" rel="noopener noreferrer" class="file-view-btn"><i class="fas fa-eye"></i></a>
                               <a href="/b/${bucketId}/${file.stored_name}/download" target="_blank" rel="noopener noreferrer" class="file-download-btn"><i class="fas fa-download"></i></a>`
                        }
                    </div>
                </div>
                ${file.comment ? `<div class="file-comment">${file.comment}</div>` : ''}
            </div>
        `).join('');

        document.getElementById('downloadOptions').style.display = 'block';
    }

    fileList.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.file-view-btn');
        if (viewBtn) {
            if (bucketData?.has_password) {
                const storedName = viewBtn.getAttribute('data-stored-name');
                fetchFile(`/b/${bucketId}/${storedName}/view`, true);
                return;
            }
        }

        const downloadBtn = e.target.closest('.file-download-btn');
        if (downloadBtn) {
            if (bucketData?.has_password) {
                const storedName = downloadBtn.getAttribute('data-stored-name');
                fetchFile(`/b/${bucketId}/${storedName}/download`, true);
                return;
            }
        }
    });

    async function fetchFile(url, isProtected) {
        try {
            const headers = {};
            if (isProtected && accessToken) {
                headers['X-Access-Token'] = accessToken;
            }

            const response = await fetch(url, { headers });
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to fetch file');
            }

            const disposition = response.headers.get('Content-Disposition');
            let filename = 'file';
            if (disposition && disposition.includes('filename=')) {
                filename = disposition.split('filename=')[1].replace(/"/g, '');
            }

            const blob = await response.blob();

            if (url.endsWith('/view')) {
                const fileURL = URL.createObjectURL(blob);
                window.open(fileURL, '_blank');
                setTimeout(() => URL.revokeObjectURL(fileURL), 10000);
            } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(link.href), 10000);
            }
        } catch (e) {
            alert(e.message);
            console.error('Fetch file error:', e);
        }
    }

    function getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const icons = {
            pdf: 'fa-file-pdf',
            doc: 'fa-file-word',
            docx: 'fa-file-word',
            xls: 'fa-file-excel',
            xlsx: 'fa-file-excel',
            zip: 'fa-file-archive',
            rar: 'fa-file-archive',
            gz: 'fa-file-archive',
            tar: 'fa-file-archive',
            jpg: 'fa-file-image',
            jpeg: 'fa-file-image',
            png: 'fa-file-image',
            gif: 'fa-file-image',
            mp4: 'fa-file-video',
            mov: 'fa-file-video',
            mp3: 'fa-file-audio',
            wav: 'fa-file-audio'
        };
        return icons[ext] || 'fa-file';
    }

    function formatFileSize(bytes) {
        if (!bytes) return '0 B';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }

    document.getElementById('submitPassword')?.addEventListener('click', async () => {
        const password = document.getElementById('passwordInput').value.trim();
        if (!password) {
            alert('Please enter the password');
            return;
        }

        try {
            const res = await fetch(`/api/b/${bucketId}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Invalid password');
            }

            const { token } = await res.json();
            if (!token) throw new Error('No token received');

            accessToken = token;
            localStorage.setItem(`accessToken_${bucketId}`, token);
            passwordForm.style.display = 'none';
            await loadFilesWithToken();
        } catch (e) {
            alert(e.message);
            console.error('Password verification error:', e);
        }
    });

    document.getElementById('downloadZip')?.addEventListener('click', (e) => {
        e.preventDefault();
        let url = `/b/${bucketId}/download?format=zip`;
        if (bucketData?.has_password && accessToken) {
            fetchFile(url, true);
        } else {
            window.location.href = url;
        }
    });

    document.getElementById('downloadTar')?.addEventListener('click', (e) => {
        e.preventDefault();
        let url = `/b/${bucketId}/download?format=tar.gz`;
        if (bucketData?.has_password && accessToken) {
            fetchFile(url, true);
        } else {
            window.location.href = url;
        }
    });
});
