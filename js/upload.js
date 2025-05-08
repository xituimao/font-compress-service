/**
 * upload.js
 * 处理文件上传到 Vercel Blob Store 的逻辑
 */
import { upload as vercelUpload } from '@vercel/blob/client';
import { updateProgress, showError } from './ui.js';

// 添加开发环境检测
const isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';

/**
 * 检查文件大小是否超过限制
 * @param {File} file - 要检查的文件
 * @param {number} maxSizeMB - 最大允许大小(MB)
 * @returns {boolean} 文件是否超过限制
 */
export function isFileSizeExceeded(file, maxSizeMB = 4.5) {
    // 这个检查现在更多是提示性的，因为实际大文件上传由Blob Store处理
    // 但保留它可以给用户即时反馈
    return file.size > maxSizeMB * 1024 * 1024;
}

/**
 * 创建一个带超时的Promise
 * @param {Promise} promise - 原始Promise
 * @param {number} timeoutMs - 超时时间(毫秒)
 * @param {string} errorMessage - 超时错误信息
 * @returns {Promise} 带超时控制的Promise
 */
function promiseWithTimeout(promise, timeoutMs, errorMessage = '操作超时') {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(errorMessage));
        }, timeoutMs);
    });

    return Promise.race([
        promise,
        timeoutPromise
    ]).finally(() => {
        clearTimeout(timeoutId);
    });
}

/**
 * 将文件直接上传到服务器（本地环境使用）
 * @param {File} file - 要上传的文件
 * @returns {Promise<string>} 包含上传文件URL的Promise
 */
async function uploadFileDirectly(file) {
    console.log('使用直接上传模式...');
    
    const formData = new FormData();
    formData.append('fontFile', file);
    
    // 发送到后端的直接上传API
    const response = await fetch('/api/direct-upload', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
            throw new Error(errorData.error || `上传失败: ${response.status}`);
        } catch (e) {
            throw new Error(`上传失败: ${response.status} ${response.statusText}`);
        }
    }
    
    const data = await response.json();
    return data.fileUrl; // 后端应该返回上传后的文件URL
}

/**
 * 将文件上传到 Vercel Blob Store
 * @param {File} file - 要上传的文件
 * @returns {Promise<string>} 包含上传文件URL的Promise
 */
export async function uploadFileToBlobStore(file) {
    let progressInterval = null;
    
    try {
        updateProgress(0, true); // 显示进度条并重置
        console.log(`开始上传字体 ${file.name} 到 Blob Store...`);

        // 模拟上传进度，因为 @vercel/blob/client 的 upload 方法目前不直接提供细粒度进度事件
        progressInterval = simulateUploadProgress();

        let blobUrl = null;
        
        // 开发环境尝试直接上传
        if (isDevelopment) {
            try {
                console.log('本地开发环境，优先尝试直接上传...');
                blobUrl = await promiseWithTimeout(
                    uploadFileDirectly(file),
                    30000, // 30秒超时
                    '直接上传字体文件超时，请检查网络连接或尝试较小的文件'
                );
                console.log('直接上传成功，URL:', blobUrl);
            } catch (directUploadError) {
                console.warn('直接上传失败，尝试使用Vercel Blob上传:', directUploadError);
                // 继续使用Vercel Blob上传
            }
        }
        
        // 如果直接上传失败或生产环境，使用Vercel Blob
        if (!blobUrl) {
            console.log('使用Vercel Blob上传...');
            // 添加上传超时控制 - 30秒
            const uploadPromise = vercelUpload(
                file.name, // 文件名将用作Blob的路径名一部分
                file,      // 要上传的实际文件对象
                {
                    access: 'public', // 文件应该是公开可访问的
                    handleUploadUrl: '/api/upload-font', // 我们新创建的API端点
                }
            );
            
            console.log("正在等待上传完成...");
            const newBlob = await promiseWithTimeout(
                uploadPromise,
                30000, // 30秒超时
                '上传字体文件超时，请检查网络连接或尝试较小的文件'
            );
            
            // 验证返回的blob对象
            if (!newBlob || !newBlob.url) {
                throw new Error('上传成功但未获得有效的Blob URL');
            }
            
            blobUrl = newBlob.url;
            console.log('字体成功上传到 Blob Store:', newBlob);
        }

        // 上传完成，停止进度模拟并显示100%
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
        updateProgress(100);
        
        return blobUrl;
    } catch (uploadError) {
        console.error("文件上传失败:", uploadError);
        if (progressInterval) {
            clearInterval(progressInterval);
        }
        updateProgress(0, false); // 隐藏进度条
        
        // 添加更具体的错误处理
        let errorMessage = '字体上传失败，请检查网络或文件类型，然后重试。';
        
        if (uploadError.message) {
            // 尝试提供更具体的错误信息
            if (uploadError.message.includes('timeout') || uploadError.message.includes('超时')) {
                errorMessage = '上传超时，请检查网络连接或尝试较小的文件';
            } else if (uploadError.message.includes('network') || uploadError.message.includes('网络')) {
                errorMessage = '网络错误，请检查您的互联网连接并重试';
            } else {
                errorMessage = uploadError.message;
            }
        }
        
        showError(errorMessage + ' (详细信息见控制台)', true);
        throw new Error(errorMessage);
    }
}

/**
 * 模拟上传进度
 * @returns {number} interval ID (用于后续清除)
 */
function simulateUploadProgress() {
    let progress = 0;
    const maxProgress = 95; // 最大模拟进度为95%，因为实际上传可能需要一点时间完成最终确认
    
    return setInterval(() => {
        if (progress < maxProgress) {
            const increment = Math.max(0.5, (maxProgress - progress) / 15); // 调整以获得合适的视觉效果
            progress += increment;
            updateProgress(Math.min(progress, maxProgress)); // 确保不超过maxProgress
        }
    }, 150); // 调整间隔以获得合适的视觉效果
}

/**
 * 验证文件类型是否被允许
 * @param {File} file - 要验证的文件
 * @param {Array<string>} allowedTypes - 允许的MIME类型数组
 * @returns {boolean} 文件类型是否被允许
 */
export function isValidFileType(file, allowedTypes = ['font/ttf', 'font/otf', 'application/octet-stream', 'application/vnd.ms-opentype']) {
    return allowedTypes.includes(file.type) || 
           /\.(ttf|otf)$/i.test(file.name); // 也检查文件扩展名作为后备
} 