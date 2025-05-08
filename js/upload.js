/**
 * upload.js
 * 处理文件上传到 Vercel Blob Store 的逻辑
 */
import { upload as vercelUpload } from '@vercel/blob/client';
import { updateProgress, showError } from './ui.js';

/**
 * 检查文件大小是否超过特定大小
 * 注意：此函数仅用于信息提示，不会限制上传，因为使用了Vercel Blob客户端上传
 * @param {File} file - 要检查的文件
 * @param {number} maxSizeMB - 显示信息的参考大小(MB)
 * @returns {boolean} 文件是否超过参考大小
 */
export function isFileSizeExceeded(file, maxSizeMB = 10) {
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
 * 模拟上传进度，根据文件大小调整模拟速度
 * @param {number} fileSize - 文件大小（字节）
 * @returns {number} interval ID (用于后续清除)
 */
function simulateUploadProgress(fileSize = 0) {
    let progress = 0;
    const maxProgress = 95; // 最大模拟进度为95%
    
    // 根据文件大小调整模拟速度
    const fileSizeMB = fileSize / (1024 * 1024);
    // 每MB估计上传时间（毫秒）- 大文件上传较慢
    const estimatedTimePerMB = fileSizeMB > 10 ? 2000 : 1000; 
    // 总估计时间（毫秒）
    const estimatedTotalTime = Math.max(10000, Math.min(300000, fileSizeMB * estimatedTimePerMB));
    // 更新间隔（毫秒）
    const updateInterval = Math.max(100, Math.min(1000, estimatedTotalTime / 100));
    
    console.log(`估计上传时间: ${Math.round(estimatedTotalTime/1000)}秒，更新间隔: ${updateInterval}ms`);
    
    return setInterval(() => {
        if (progress < maxProgress) {
            // 越接近maxProgress，增量越小
            const remainingProgress = maxProgress - progress;
            const increment = Math.max(0.1, remainingProgress / 50);
            progress += increment;
            updateProgress(Math.min(progress, maxProgress));
        }
    }, updateInterval);
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
        console.log(`文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

        // 模拟上传进度，因为 @vercel/blob/client 的 upload 方法目前不直接提供细粒度进度事件
        progressInterval = simulateUploadProgress(file.size);
        
        // 使用Vercel Blob客户端上传
        const uploadPromise = vercelUpload(
            file.name, // 文件名将用作Blob的路径名一部分
            file,      // 要上传的实际文件对象
            {
                access: 'public', // 文件应该是公开可访问的
                handleUploadUrl: '/api/upload-font', // 处理上传的API端点
            }
        );
        
        // 根据文件大小动态调整超时时间 - 每MB大约10秒
        const fileSize = file.size / (1024 * 1024); // 换算为MB
        // 最低60秒，每MB增加10秒，最高10分钟
        const timeoutSeconds = Math.min(600, Math.max(60, Math.ceil(fileSize * 10)));
        console.log(`根据文件大小设置上传超时: ${timeoutSeconds}秒`);
        
        // 添加动态超时控制
        const newBlob = await promiseWithTimeout(
            uploadPromise,
            timeoutSeconds * 1000, // 转换为毫秒
            `上传字体文件超时(${timeoutSeconds}秒)，请检查网络连接或尝试较小的文件`
        );
        
        // 验证返回的blob对象
        if (!newBlob || !newBlob.url) {
            throw new Error('上传成功但未获得有效的Blob URL');
        }
        
        // 上传完成，停止进度模拟并显示100%
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
        updateProgress(100);
        
        console.log('字体成功上传到 Blob Store:', newBlob);
        return newBlob.url;
    } catch (uploadError) {
        console.error("文件上传失败:", uploadError);
        if (progressInterval) {
            clearInterval(progressInterval);
        }
        updateProgress(0, false); // 隐藏进度条
        
        // 添加更具体的错误处理
        let errorMessage = '字体上传失败，请检查网络或文件类型，然后重试。';
        
        if (uploadError.message) {
            if (uploadError.message.includes('timeout') || uploadError.message.includes('超时')) {
                errorMessage = uploadError.message + '。建议使用更好的网络连接或尝试分割字体文件。';
            } else if (uploadError.message.includes('network') || uploadError.message.includes('网络')) {
                errorMessage = '网络错误，请检查您的互联网连接并重试。';
            } else if (uploadError.message.includes('CORS') || uploadError.message.includes('cross-origin')) {
                errorMessage = '跨域请求错误，请确保浏览器允许跨域请求。';
            } else {
                errorMessage = uploadError.message;
            }
        }
        
        showError(errorMessage, true);
        throw new Error(errorMessage);
    }
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