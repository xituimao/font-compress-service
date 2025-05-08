/**
 * ui.js
 * 处理与用户界面交互相关的函数
 */

// DOM 元素缓存
let elements = {
    errorMessage: null,
    successMessage: null,
    loading: null,
    uploadProgress: null,
    progressBarFill: null,
    progressText: null,
    modalContainer: null,
    modalContent: null,
    modalClose: null
};

/**
 * 初始化UI组件
 */
export function initUI() {
    // 获取常用DOM元素引用
    elements = {
        errorMessage: document.getElementById('errorMessage'),
        successMessage: document.getElementById('successMessage'),
        loading: document.getElementById('loading'),
        uploadProgress: document.getElementById('uploadProgress'),
        progressBarFill: document.getElementById('progressBarFill'),
        progressText: document.getElementById('progressText')
    };
    
    // 确保所有UI元素都隐藏
    hideElement(elements.errorMessage);
    hideElement(elements.successMessage);
    hideElement(elements.loading);
    hideElement(elements.uploadProgress);

    // 创建模态弹窗
    createModalIfNeeded();
}

/**
 * 创建模态弹窗
 */
function createModalIfNeeded() {
    // 如果模态弹窗已存在，则直接返回
    if (document.getElementById('errorModal')) {
        elements.modalContainer = document.getElementById('errorModal');
        elements.modalContent = document.getElementById('errorModalContent');
        elements.modalClose = document.getElementById('errorModalClose');
        return;
    }

    // 创建模态弹窗容器
    const modal = document.createElement('div');
    modal.id = 'errorModal';
    modal.className = 'modal';
    modal.style.display = 'none';
    modal.style.position = 'fixed';
    modal.style.zIndex = '1000';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.4)';
    modal.style.overflow = 'auto';

    // 创建模态弹窗内容
    const modalContent = document.createElement('div');
    modalContent.id = 'errorModalContent';
    modalContent.className = 'modal-content';
    modalContent.style.backgroundColor = '#fefefe';
    modalContent.style.margin = '15% auto';
    modalContent.style.padding = '20px';
    modalContent.style.border = '1px solid #888';
    modalContent.style.borderRadius = '5px';
    modalContent.style.width = '80%';
    modalContent.style.maxWidth = '500px';
    modalContent.style.boxShadow = '0 4px 8px 0 rgba(0,0,0,0.2)';

    // 创建关闭按钮
    const closeBtn = document.createElement('span');
    closeBtn.id = 'errorModalClose';
    closeBtn.className = 'close';
    closeBtn.innerHTML = '&times;';
    closeBtn.style.color = '#aaa';
    closeBtn.style.float = 'right';
    closeBtn.style.fontSize = '28px';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // 组装模态弹窗
    modalContent.appendChild(closeBtn);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // 点击模态框外部关闭
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // 保存元素引用
    elements.modalContainer = modal;
    elements.modalContent = modalContent;
    elements.modalClose = closeBtn;
}

/**
 * 显示错误消息
 * @param {string} message - 要显示的错误消息
 * @param {boolean} useModal - 是否以模态弹窗形式显示
 */
export function showError(message, useModal = false) {
    if (!elements.errorMessage) initUI();
    
    if (message && message.trim() !== '') {
        elements.errorMessage.textContent = message;
        showElement(elements.errorMessage);
        // 记录到控制台
        console.error('[ERROR]', message);
        
        if (useModal) {
            showModal(message, 'error');
        }
    } else {
        // 无内容时隐藏错误提示框
        hideElement(elements.errorMessage);
    }
    
    // 始终隐藏成功消息框
    hideElement(elements.successMessage);
}

/**
 * 显示成功消息
 * @param {string} message - 要显示的成功消息
 * @param {boolean} useModal - 是否以模态弹窗形式显示
 */
export function showSuccess(message, useModal = false) {
    if (!elements.successMessage) initUI();
    
    if (message && message.trim() !== '') {
        elements.successMessage.textContent = message;
        showElement(elements.successMessage);
        // 记录到控制台
        console.log('[SUCCESS]', message);
        
        if (useModal) {
            showModal(message, 'success');
        }
    } else {
        // 无内容时隐藏成功提示框
        hideElement(elements.successMessage);
    }
    
    // 始终隐藏错误消息框
    hideElement(elements.errorMessage);
}

/**
 * 显示模态弹窗
 * @param {string} message - 要显示的消息
 * @param {string} type - 消息类型，'error' 或 'success'
 */
export function showModal(message, type = 'error') {
    if (!elements.modalContainer) createModalIfNeeded();

    // 清除旧内容
    while (elements.modalContent.childElementCount > 1) {
        elements.modalContent.removeChild(elements.modalContent.lastChild);
    }

    // 创建消息内容
    const h3 = document.createElement('h3');
    h3.textContent = type === 'error' ? '错误' : '成功';
    h3.style.color = type === 'error' ? '#e74c3c' : '#27ae60';
    h3.style.marginTop = '0';

    const p = document.createElement('p');
    p.textContent = message;
    p.style.margin = '10px 0';

    const button = document.createElement('button');
    button.textContent = '确定';
    button.style.padding = '8px 16px';
    button.style.backgroundColor = type === 'error' ? '#e74c3c' : '#27ae60';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.float = 'right';
    button.onclick = () => {
        elements.modalContainer.style.display = 'none';
    };

    // 添加内容到模态框
    elements.modalContent.appendChild(h3);
    elements.modalContent.appendChild(p);
    elements.modalContent.appendChild(button);

    // 显示模态框
    elements.modalContainer.style.display = 'block';
}

/**
 * 显示链接模态窗口
 * @param {string} url - 要显示的下载链接
 * @param {string} filename - 文件名
 * @param {number} fileSize - 文件大小(字节)
 */
export function showLinkModal(url, filename, fileSize) {
    const resultModal = document.getElementById('resultModal');
    if (!resultModal) return;
    
    const resultLink = document.getElementById('resultLink');
    if (resultLink) {
        resultLink.value = url;
    }
    
    const fileSizeKB = (fileSize / 1024).toFixed(1);
    const modalTitle = document.querySelector('#resultModal .modal-content h3');
    if (modalTitle) {
        modalTitle.textContent = `压缩完成 - ${filename}`;
    }
    
    const modalMsg = document.querySelector('#resultModal .modal-content p');
    if (modalMsg) {
        modalMsg.textContent = `字体压缩已完成 (${fileSizeKB}KB)，您可以：`;
    }
    
    resultModal.style.display = 'block';
}

/**
 * 显示/隐藏加载指示器
 * @param {boolean} isLoading - 是否显示加载指示器
 */
export function setLoading(isLoading) {
    if (!elements.loading) initUI();
    if (isLoading) {
        showElement(elements.loading);
    } else {
        hideElement(elements.loading);
    }
}

/**
 * 显示或隐藏一个元素
 * @param {HTMLElement} element - 要操作的DOM元素
 * @param {boolean} show - 是否显示元素，默认为true
 */
export function toggleElement(element, show = true) {
    if (!element) return;
    element.style.display = show ? 'block' : 'none';
}

/**
 * 显示一个元素
 * @param {HTMLElement} element - 要显示的DOM元素
 */
export function showElement(element) {
    toggleElement(element, true);
}

/**
 * 隐藏一个元素
 * @param {HTMLElement} element - 要隐藏的DOM元素
 */
export function hideElement(element) {
    toggleElement(element, false);
}

/**
 * 更新上传进度显示
 * @param {number} percent - 进度百分比 (0-100)
 * @param {boolean} show - 是否显示进度条
 */
export function updateProgress(percent, show = true) {
    if (!elements.uploadProgress) initUI();
    
    if (show) {
        showElement(elements.uploadProgress);
    } else {
        hideElement(elements.uploadProgress);
        return;
    }
    
    // 限制进度值在0-100之间
    const progress = Math.max(0, Math.min(100, percent));
    
    // 更新进度条
    elements.progressBarFill.style.width = `${progress}%`;
    elements.progressText.textContent = `${Math.round(progress)}%`;
    
    // 如果进度已完成，设置为绿色
    if (progress >= 100) {
        elements.progressBarFill.style.backgroundColor = '#27ae60';
    } else {
        elements.progressBarFill.style.backgroundColor = '#3498db';
    }
}

/**
 * 创建一个用于下载文件的链接并触发下载
 * @param {Blob} blob - 文件数据
 * @param {string} filename - 下载的文件名
 */
export function downloadFile(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
}

/**
 * 从 Content-Disposition 头部获取文件名
 * @param {string} contentDisposition - Content-Disposition 头部值
 * @param {string} defaultFilename - 默认文件名
 * @returns {string} 解析的文件名或默认文件名
 */
export function getFilenameFromContentDisposition(contentDisposition, defaultFilename = 'compressed-font.ttf') {
    if (!contentDisposition) return defaultFilename;
    
    const filenameMatch = contentDisposition.match(/filename="?([^"]*)"?/);
    if (filenameMatch && filenameMatch[1]) {
        return filenameMatch[1];
    }
    
    return defaultFilename;
} 