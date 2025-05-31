document.addEventListener('DOMContentLoaded', function() {
    
    const filesSection = document.getElementById('filesSection');
    const dropZone = document.getElementById('dropZone');
    const dropContent = document.getElementById('dropContent');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const addMoreContainer = document.getElementById('addMoreContainer');
    const addMoreBtn = document.getElementById('addMoreBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const globalDropOverlay = document.getElementById('globalDropOverlay');
    
    let files = [];
    const MAX_FILES = 20;
    fileList.style.display = 'none';

    
    addMoreBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        fileInput.click();
    });


    
    fileInput.addEventListener('change', function() {
        console.log("Отримано файли:", this.files); 
        if (this.files.length > 0) {
            handleFiles(this.files);
            this.value = ''; 
        }
    });

    
    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        globalDropOverlay.style.display = 'flex';
    });

    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.clientX <= 0 || e.clientY <= 0 || 
            e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
            globalDropOverlay.style.display = 'none';
        }
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        globalDropOverlay.style.display = 'none';
        
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });

    
    updateUI();

    
    function handleFiles(newFiles) {
        console.log("Нові файли:", newFiles); 
        const totalFiles = files.length + newFiles.length;
        
        if (totalFiles > MAX_FILES) {
            alert(`You can upload maximum ${MAX_FILES} files`);
            return;
        }
        
        for (let i = 0; i < newFiles.length; i++) {
            const file = newFiles[i];
            
            if (file.size > 64 * 1024 * 1024) {
                alert(`File "${file.name}" is too large (max 64MB)`);
                continue;
            }
            
            files.push(file);
        }
        window.uploadedFiles = files.slice(); 
        updateFileList();
        updateUI();
    }

    
    function updateFileList() {
        fileList.innerHTML = '';
        
        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            
            let previewContent = '';
            if (file.type.startsWith('image/')) {
                previewContent = `<img src="${URL.createObjectURL(file)}">`;
            } else {
                
                let fileIcon = 'fa-file';
                if (file.type.includes('pdf')) fileIcon = 'fa-file-pdf';
                else if (file.type.includes('word')) fileIcon = 'fa-file-word';
                else if (file.type.includes('excel')) fileIcon = 'fa-file-excel';
                else if (file.type.includes('zip') || file.type.includes('compressed')) fileIcon = 'fa-file-archive';
                else if (file.type.includes('video')) fileIcon = 'fa-file-video';
                else if (file.type.includes('audio')) fileIcon = 'fa-file-audio';
                
                previewContent = `<i class="fas ${fileIcon}"></i>`;
            }
            
            
            const fileSize = formatFileSize(file.size);
            
            fileItem.innerHTML = `
                <div class="file-header">
                    <div class="file-preview">${previewContent}</div>
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${fileSize}</div>
                    </div>
                    <button class="delete-btn" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <textarea class="file-comment" placeholder="Add comment (max 50 chars)" maxlength="50" data-file-index="${index}"></textarea>
            `;
            
            fileList.appendChild(fileItem);
        });
        
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const index = parseInt(this.getAttribute('data-index'));
                files.splice(index, 1);
                updateFileList();
                updateUI();
            });
        });
    }

    
    function updateUI() {
        if (files.length > 0) {
            
            dropZone.style.display = 'none';
            fileList.style.display = 'block';
            addMoreContainer.style.display = 'block';
            uploadBtn.style.display = 'flex';
        } else {
            
            dropZone.style.display = 'flex';
            fileList.style.display = 'none';
            addMoreContainer.style.display = 'none';
            uploadBtn.style.display = 'none';
        }    
    }

    
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }
});


document.getElementById('uploadBtn').addEventListener('click', async function() {
    const formData = new FormData();
    const files = window.uploadedFiles || [];
    console.log(files)
    const retention = document.getElementById('retentionSelect').value;
    const password = document.getElementById('passwordField').value;

    files.forEach((file, index) => {
        formData.append('files', file);
        const comment = document.querySelector(`[data-file-index="${index}"]`).value;
        formData.append('comments', comment);
    });

    formData.append('retention', retention);
    formData.append('password', password);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        window.location.href = `/success?b=${result.bucketId}`;
    } catch (error) {
        alert('Помилка завантаження: ' + error.message);
    }
});