/**
 * upload.js
 * 处理文件上传到 Vercel Blob Store 的逻辑
 */

import { upload } from '@vercel/blob/client';
import { updateProgress, showError } from './ui.js';

/**
 * 检查文件大小是否超过限制
 * @param {File} file - 要检查的文件
 * @param {number} maxSizeMB - 最大允许大小(MB)
 * @returns {boolean} 文件是否超过限制
 */
export function isFileSizeExceeded(file, maxSizeMB = 4.5) {
    return file.size > maxSizeMB * 1024 * 1024;
}

/**
 * 将文件上传到 Vercel Blob Store
 * @param {File} file - 要上传的文件
 * @param {Object} options - 上传选项
 * @returns {Promise<string>} 包含上传文件URL的Promise
 */
export async function uploadFileToBlobStore(file, options = {}) {
    try {
        updateProgress(0, true);
        console.log(`Starting upload for ${file.name}...`);
        
        // 模拟上传进度，因为实际上传进度可能无法获取
        // 在真实场景中，如果能获取到上传进度事件，这里可以替换为实际进度
        const progressInterval = simulateUploadProgress();
        
        const newBlob = await upload(
            file.name,
            file,
            {
                access: 'public',
                handleUploadUrl: '/api/blob-upload-handler',
                ...options
            }
        );
        
        // 上传完成，停止进度模拟并显示100%
        clearInterval(progressInterval);
        updateProgress(100);
        
        console.log('Upload successful:', newBlob);
        return newBlob.url;
    } catch (uploadError) {
        console.error("Blob upload failed:", uploadError);
        updateProgress(0, false); // 隐藏进度条
        
        const message = uploadError.message || '字体上传到 Blob Store 失败，请检查网络或文件类型，然后重试。';
        showError(message + ' (详细信息见控制台)');
        throw new Error(message);
    }
}

/**
 * 模拟上传进度
 * 由于 Vercel Blob client 的 upload 方法没有提供进度回调，
 * 这个函数模拟一个渐进的上传进度
 * @returns {number} interval ID (用于后续清除)
 */
function simulateUploadProgress() {
    let progress = 0;
    const maxProgress = 90; // 最大模拟进度为90%，留10%给实际上传完成
    
    return setInterval(() => {
        if (progress < maxProgress) {
            // 进度增长速度随进度增加而减缓
            const increment = Math.max(0.5, (maxProgress - progress) / 20);
            progress += increment;
            updateProgress(progress);
        }
    }, 200);
}

/**
 * 验证文件类型是否被允许
 * @param {File} file - 要验证的文件
 * @param {Array<string>} allowedTypes - 允许的MIME类型数组
 * @returns {boolean} 文件类型是否被允许
 */
export function isValidFileType(file, allowedTypes = ['font/ttf', 'font/otf', 'application/octet-stream', 'application/vnd.ms-opentype']) {
    return allowedTypes.includes(file.type) || 
           // 检查文件扩展名作为后备
           /\.(ttf|otf)$/i.test(file.name);
} 