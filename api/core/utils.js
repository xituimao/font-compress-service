/**
 * API通用工具函数
 */

/**
 * 生成安全的文件名
 * @param {string} originalName - 原始文件名
 * @param {string} extension - 默认扩展名
 * @returns {string} 安全的文件名
 */
export function generateSafeName(originalName, extension = ".ttf") {
  // 移除不安全字符，保留字母、数字、下划线和点
  const safeName = originalName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  
  // 添加时间戳和随机字符串，确保文件名唯一性
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);

  // 提取扩展名
  const extensionMatch = safeName.match(/\.(ttf|otf)$/i);
  const fileExtension = extensionMatch ? extensionMatch[0] : extension;

  // 构建基础名称（不包含扩展名）
  const baseName = extensionMatch
    ? safeName.substring(0, safeName.length - fileExtension.length)
    : safeName;

  return `${baseName}_${timestamp}_${randomString}${fileExtension}`;
}

/**
 * 获取当前环境前缀
 * @returns {string} 环境名称
 */
export function getEnvironmentPrefix() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
}

/**
 * 从请求体读取JSON
 * @param {Object} req - HTTP请求对象
 * @returns {Promise<Object>} 解析后的JSON对象
 */
export function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        if (body) {
          const parsed = JSON.parse(body);
          console.log(
            "解析请求体成功:",
            JSON.stringify(parsed).substring(0, 100) + "..."
          );
          resolve(parsed);
        } else {
          console.log("请求体为空，返回空对象");
          resolve({});
        }
      } catch (error) {
        console.log("无法解析请求体:", error);
        reject(new Error("无效的JSON请求体: " + error.message));
      }
    });
    req.on("error", (err) => {
      console.log("请求流错误:", err);
      reject(err);
    });
  });
} 