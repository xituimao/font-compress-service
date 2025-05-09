/**
 * upload.js
 * 处理文件上传到 Vercel Blob Store 的逻辑
 */
import { upload } from "@vercel/blob/client";
import { updateProgress, showError } from "./ui.js";

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
function promiseWithTimeout(promise, timeoutMs, errorMessage = "操作超时") {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

// 获取当前环境
function getEnvironmentPrefix() {
  return window.location.hostname.includes("localhost") ? "development" : "production";
}

// 生成安全的文件名
function generateSafeName(originalName) {
  const safeName = originalName.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  
  const extensionMatch = safeName.match(/\.(ttf|otf)$/i);
  const extension = extensionMatch ? extensionMatch[0] : '.ttf';
  const baseName = extensionMatch ? 
    safeName.substring(0, safeName.length - extension.length) : safeName;
  
  return `${baseName}_${timestamp}_${randomString}${extension}`;
}

/**
 * 将文件上传到 Vercel Blob Store
 * @param {File} file - 要上传的文件
 * @returns {Promise<string>} 包含上传文件URL的Promise
 */
export async function uploadFileToBlobStore(file) {
  try {
    updateProgress(0, true);
    console.log(`开始上传字体: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    const envPrefix = getEnvironmentPrefix();
    const fileName = generateSafeName(file.name);
    
    const uploadPromise = upload(
      `${envPrefix}/original/${fileName}`,
      file,
      {
        access: "public",
        handleUploadUrl: "/api/upload-font",
        multipart: true,
        onUploadProgress: (progress) => {
          const percent = (progress.loaded / progress.total) * 100;
          updateProgress(percent);
        },
      }
    );

    // 根据文件大小设置超时
    const timeoutSeconds = Math.min(
      600,
      Math.max(60, Math.ceil(file.size / (1024 * 1024) * 10))
    );
    
    const newBlob = await promiseWithTimeout(
      uploadPromise,
      timeoutSeconds * 1000,
      `上传字体文件超时(${timeoutSeconds}秒)`
    );

    if (!newBlob || !newBlob.url) {
      throw new Error("上传成功但未获得有效的URL");
    }

    updateProgress(100);
    return newBlob.url;
  } catch (error) {
    console.error("上传失败:", error);
    updateProgress(0, false);
    
    let errorMessage = "字体上传失败，请检查网络或文件类型，然后重试。";
    if (error.message) {
      if (error.message.includes("timeout") || error.message.includes("超时")) {
        errorMessage = `${error.message}。建议使用更好的网络连接或较小文件。`;
      } else if (error.message.includes("network") || error.message.includes("网络")) {
        errorMessage = "网络错误，请检查您的互联网连接并重试。";
      } else {
        errorMessage = error.message;
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
export function isValidFileType(
  file,
  allowedTypes = [
    "font/ttf",
    "font/otf",
    "application/octet-stream",
    "application/vnd.ms-opentype",
  ]
) {
  return allowedTypes.includes(file.type) || /\.(ttf|otf)$/i.test(file.name); // 也检查文件扩展名作为后备
}
