/**
 * upload.js
 * 处理文件上传到 Vercel Blob Store 的逻辑
 */
import { upload as vercelUpload } from '@vercel/blob/client';
import { updateProgress, showError } from './ui.js';

// 声明上传函数，将在初始化时设置
let uploadFunction;

// 加载 Vercel Blob 客户端
async function loadBlobClient() {
    if (uploadFunction) return uploadFunction;
    
    try {
        // 从全局变量中获取upload函数（通过HTML脚本标签加载）
        if (window.vercelBlob && typeof window.vercelBlob.upload === 'function') {
            uploadFunction = window.vercelBlob.upload;
            return uploadFunction;
        } else {
            throw new Error('Vercel Blob客户端未正确加载');
        }
    } catch (error) {
        console.error('Failed to load Vercel Blob client:', error);
        throw new Error('字体上传SDK加载失败，请检查网络连接。');
    }
}

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
 * 将文件上传到 Vercel Blob Store
 * @param {File} file - 要上传的文件
 * @returns {Promise<string>} 包含上传文件URL的Promise
 */
export async function uploadFileToBlobStore(file) {
    try {
        updateProgress(0, true); // 显示进度条并重置
        console.log(`开始上传字体 ${file.name} 到 Blob Store...`);

        // 模拟上传进度，因为 @vercel/blob/client 的 upload 方法目前不直接提供细粒度进度事件
        // 真正的进度由浏览器处理，但我们可以模拟一个视觉反馈
        const progressInterval = simulateUploadProgress();

        const newBlob = await vercelUpload(
            file.name, // 文件名将用作Blob的路径名一部分
            file,      // 要上传的实际文件对象
            {
                access: 'public', // 文件应该是公开可访问的
                handleUploadUrl: '/api/upload-font', // 我们新创建的API端点
                // clientPayload: '可选的客户端负载，如果需要的话'
            }
        );

        // 上传完成，停止进度模拟并显示100%
        clearInterval(progressInterval);
        updateProgress(100);

        console.log('字体成功上传到 Blob Store:', newBlob);
        return newBlob.url; // 返回Blob的URL
    } catch (uploadError) {
        console.error("Blob Store上传失败:", uploadError);
        updateProgress(0, false); // 隐藏进度条
        
        const message = uploadError.message || '字体上传到 Blob Store 失败，请检查网络或文件类型，然后重试。';
        showError(message + ' (详细信息见控制台)');
        throw new Error(message);
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