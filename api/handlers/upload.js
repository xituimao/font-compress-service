/**
 * 字体上传处理器 - 基于Vercel Blob支持字体文件上传
 */
import { handleUpload } from "@vercel/blob/client";
import Logger from "../core/logger.js";
import { generateSafeName, getEnvironmentPrefix } from "../core/utils.js";

// 允许的字体MIME类型
const ALLOWED_MIME_TYPES = [
  "font/ttf",
  "font/otf",
  "application/octet-stream",
  "application/vnd.ms-opentype",
];

/**
 * 处理字体上传请求
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
export default async function uploadHandler(req, res) {
  try {
    Logger.info("开始处理字体上传请求");
    
    // 获取环境前缀
    const envPrefix = getEnvironmentPrefix();
    Logger.info(`当前环境: ${envPrefix}`);

    // 处理上传请求
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        Logger.debug("生成上传令牌，原始路径:", { pathname });

        // 获取原始文件名 - 从任意深度的路径中提取
        const pathParts = pathname.split("/");
        const originalFileName = pathParts[pathParts.length - 1];

        Logger.debug("从路径提取的文件名:", { originalFileName });

        // 创建安全的文件名
        const safeFileName = generateSafeName(originalFileName);

        // 强制添加环境和文件夹前缀
        const prefixedPathname = `${envPrefix}/original/${safeFileName}`;

        Logger.debug("强制设置完整存储路径:", { prefixedPathname });

        return {
          allowedContentTypes: ALLOWED_MIME_TYPES,
          pathname: prefixedPathname,
          tokenPayload: {
            timestamp: Date.now(),
            environment: envPrefix,
            originalFileName,
            safeFileName
          },
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // 客户端上传完成的通知
        Logger.info("上传完成回调触发", { 
          url: blob ? blob.url : "blob为空" 
        });

        try {
          // 文件上传完成后可以执行任何逻辑
          const parsedPayload = JSON.parse(tokenPayload || "{}");
          if (parsedPayload.timestamp) {
            const processingTime = Math.round((Date.now() - parsedPayload.timestamp) / 1000);
            Logger.info(`文件上传处理耗时: ${processingTime}秒`, {
              environment: parsedPayload.environment,
              originalFileName: parsedPayload.originalFileName,
              safeFileName: parsedPayload.safeFileName
            });
          }
        } catch (error) {
          Logger.error("上传完成后处理失败", error);
        }
      },
    });

    // 返回JSON响应
    Logger.info("处理成功，返回响应");
    return res.status(200).json(jsonResponse);
  } catch (error) {
    Logger.error("处理上传请求失败", error);
    return res.status(400).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    });
  }
} 