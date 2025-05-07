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
    progressText: null
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
}

/**
 * 显示错误消息
 * @param {string} message - 要显示的错误消息
 */
export function showError(message) {
    if (!elements.errorMessage) initUI();
    elements.errorMessage.textContent = message;
    showElement(elements.errorMessage);
    hideElement(elements.successMessage);
}

/**
 * 显示成功消息
 * @param {string} message - 要显示的成功消息
 */
export function showSuccess(message) {
    if (!elements.successMessage) initUI();
    elements.successMessage.textContent = message;
    showElement(elements.successMessage);
    hideElement(elements.errorMessage);
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