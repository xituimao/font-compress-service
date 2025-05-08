/**
 * main.js
 * 字体压缩服务的主入口JavaScript文件
 */

// 导入模块
import { charsets, addCharsetsToText } from './charsets.js';
import { initUI, showError, showSuccess, setLoading, updateProgress, downloadFile, getFilenameFromContentDisposition } from './ui.js';
import { uploadFileToBlobStore, isFileSizeExceeded, isValidFileType } from './upload.js'; // uploadFileToBlobStore 现在使用@vercel/blob/client

// DOM就绪后执行初始化
document.addEventListener('DOMContentLoaded', init);

// 全局变量，用于存储DOM元素引用
let form, fileInput, textInput, submitBtn, fileSizeWarning;

/**
 * 初始化应用
 */
function init() {
    // 初始化UI工具
    initUI();
    
    // 获取DOM元素引用
    form = document.getElementById('compressForm');
    fileInput = document.getElementById('fontFile');
    textInput = document.getElementById('textInput');
    submitBtn = document.getElementById('submitBtn');
    fileSizeWarning = document.getElementById('fileSizeWarning');
    
    // 绑定事件处理程序
    bindEvents();
}

/**
 * 绑定各种事件处理函数
 */
function bindEvents() {
    // 监听表单提交
    form.addEventListener('submit', handleFormSubmit);
    
    // 监听文件选择变化，检查文件大小
    fileInput.addEventListener('change', handleFileSelection);
    
    // 监听字符集添加按钮点击
    document.getElementById('addSelectedChars').addEventListener('click', handleAddSelectedChars);
}

/**
 * 处理表单提交
 * @param {Event} e - 提交事件对象
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    showError('');

    if (!fileInput.files[0]) {
        showError('请选择字体文件');
        return;
    }

    const fontFile = fileInput.files[0];
    const textContent = textInput.value;

    if (!isValidFileType(fontFile)) {
        showError('只支持TTF和OTF格式的字体文件');
        return;
    }
    
    submitBtn.disabled = true;
    setLoading(true);
    // updateProgress(0, true); // 进度条由uploadFileToBlobStore内部管理

    let compressionProgressInterval = null;
    let compressAbortController = null;

    try {
        // 1. 上传文件到 Blob Store
        console.log('开始上传字体文件...');
        const blobUrl = await uploadFileToBlobStore(fontFile);
        
        // 文件上传到Blob成功后，显示消息并准备压缩
        showSuccess('字体文件已成功上传到Blob Store，正在准备压缩...');
        // 此时进度条应为100%，因为Blob上传已完成

        // 2. 准备发送到字体压缩API的数据 (只发送URL和文本)
        const payload = {
            blobUrl: blobUrl,
            text: textContent
        };
        
        console.log('发送到压缩API的数据:', payload);
        setLoading(true); // 重新显示加载指示器，因为现在是压缩阶段
        updateProgress(0, true); // 为压缩阶段重置进度条
        compressionProgressInterval = simulateCompressionProgress(); // 为压缩过程模拟进度

        // 创建AbortController用于请求超时控制
        compressAbortController = new AbortController();
        const timeoutId = setTimeout(() => {
            if (compressAbortController) {
                compressAbortController.abort();
                console.error('压缩请求超时，已中断');
            }
        }, 45000); // 45秒超时

        // 3. 调用压缩API
        console.log('开始调用压缩API...');
        try {
            const response = await fetch('/api/compress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                body: JSON.stringify(payload),
                signal: compressAbortController.signal
            });
            
            clearTimeout(timeoutId);
            
            if (compressionProgressInterval) {
                clearInterval(compressionProgressInterval);
                compressionProgressInterval = null;
            }
            updateProgress(100); // 压缩完成，设置进度到100%
            
            // 4. 处理API响应
            if (!response.ok) {
                // 如果响应不是OK，尝试解析错误信息
                let errorData;
                try {
                    errorData = await response.json();
                } catch (jsonError) {
                    // 如果响应体不是有效的JSON，则使用状态文本
                    throw new Error(`压缩服务错误: ${response.status} ${response.statusText}`);
                }
                throw new Error(errorData.error || `压缩服务返回错误: ${response.status}`);
            }
            
            // 5. 从响应头获取文件名
            const contentDisposition = response.headers.get('content-disposition');
            const filename = getFilenameFromContentDisposition(contentDisposition) || 'compressed-font.ttf';
            
            // 6. 将响应转换为blob并下载
            console.log('开始下载压缩后的字体文件...');
            const blobData = await response.blob();
            downloadFile(blobData, filename);
            
            // 7. 显示成功消息
            const stats = {
                originalSize: (fontFile.size / 1024).toFixed(1),
                compressedSize: (blobData.size / 1024).toFixed(1),
                ratio: (100 * (1 - blobData.size / fontFile.size)).toFixed(1)
            };
            
            showSuccess(`字体已成功压缩并下载！原始大小: ${stats.originalSize}KB, 压缩后: ${stats.compressedSize}KB (压缩率: ${stats.ratio}%)`);
        } catch (fetchError) {
            // 处理fetch错误
            if (fetchError.name === 'AbortError') {
                throw new Error('压缩请求超时，请尝试减少字符数量或使用较小的字体文件');
            } else {
                throw fetchError;
            }
        }
    } catch (error) {
        console.error('处理过程中出错:', error);
        
        // 对于关键错误使用弹窗提示
        const errorMessage = error.message || '处理失败，请检查控制台获取更多信息，或稍后重试';
        
        // 根据错误类型判断是否使用弹窗
        const isImportantError = 
            errorMessage.includes('超时') || 
            errorMessage.includes('timeout') || 
            errorMessage.includes('failed') || 
            errorMessage.includes('失败') ||
            errorMessage.includes('错误') ||
            errorMessage.includes('error');
        
        showError(errorMessage, isImportantError); // 第二个参数为true时使用弹窗
    } finally {
        // 清理资源
        if (compressionProgressInterval) {
            clearInterval(compressionProgressInterval);
        }
        if (compressAbortController) {
            compressAbortController = null;
        }
        
        submitBtn.disabled = false;
        setLoading(false);
        updateProgress(0, false); // 最终隐藏进度条
    }
}

// 可选：为压缩过程模拟进度 (如果压缩过程也比较耗时)
function simulateCompressionProgress() {
    let progress = 0;
    const maxProgress = 95;
    return setInterval(() => {
        if (progress < maxProgress) {
            const increment = Math.max(0.5, (maxProgress - progress) / 10);
            progress += increment;
            updateProgress(Math.min(progress, maxProgress));
        }
    }, 200);
}

/**
 * 处理API错误 (此函数在新的流程中可能不太需要，因为错误处理更具体化了)
 * @param {Response} response - Fetch API响应对象
 */
// async function handleApiError(response) { ... } // 可以考虑移除或重构

/**
 * 处理文件选择变化
 */
function handleFileSelection() {
    if (fileInput.files[0]) {
        const file = fileInput.files[0];
        
        if (isFileSizeExceeded(file)) {
            fileSizeWarning.style.display = 'block';
        } else {
            fileSizeWarning.style.display = 'none';
        }
        
        if (!isValidFileType(file)) {
            showError('只支持TTF和OTF格式的字体文件');
        } else {
            showError(''); // 清除之前的错误信息
        }
    }
}

/**
 * 处理添加选定字符集
 */
function handleAddSelectedChars() {
    const selectedIds = Array.from(
        document.querySelectorAll('.preset-checkbox:checked')
    ).map(checkbox => checkbox.getAttribute('data-id'));
    
    if (selectedIds.length === 0) return;
    
    const result = addCharsetsToText(textInput.value, selectedIds);
    
    if (result.hasNewChars) {
        textInput.value = result.text;
        textInput.focus();
        
        const addBtn = document.getElementById('addSelectedChars');
        addBtn.textContent = "已添加✓";
        addBtn.disabled = true;
        
        setTimeout(() => {
            addBtn.textContent = "添加所选字符集";
            addBtn.disabled = false;
        }, 1000);
    }
    
    document.querySelectorAll('.preset-checkbox:checked').forEach(checkbox => {
        checkbox.checked = false;
    });
} 