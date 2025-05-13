/**
 * 字体压缩处理器 - 提供字体子集化压缩功能
 */
import Fontmin from "fontmin";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import https from "node:https";
import http from "node:http";
import { put } from "@vercel/blob";
import otf2ttf from "fontmin/plugins/otf2ttf.js";
import { getCharset } from "../charsets.js";
import Logger from "../core/logger.js";
import { generateSafeName, getEnvironmentPrefix } from "../core/utils.js";

// 设置常量
const DOWNLOAD_TIMEOUT_MS = 30000; // 30秒
const GLOBAL_TIMEOUT_MS = 60000; // 60秒
const FONTMIN_TIMEOUT_MS = 30000; // 30秒

/**
 * 从指定URL下载文件到本地路径
 * @param {string} url - 文件URL
 * @param {string} destination - 本地保存路径
 * @returns {Promise<void>}
 */
async function downloadFile(url, destination) {
  Logger.info(`开始从URL下载文件: ${url}`);

  // 最大重试次数
  const MAX_RETRIES = 2;
  let retries = 0;

  while (retries <= MAX_RETRIES) {
    try {
      // 尝试使用URL对象解析URL
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch (error) {
        throw new Error(`无效的URL: ${url}, 错误: ${error.message}`);
      }

      // 选择HTTP或HTTPS模块
      const httpModule = parsedUrl.protocol === "https:" ? https : http;

      // 创建请求，设置超时，并添加适当的请求头
      const options = {
        timeout: DOWNLOAD_TIMEOUT_MS,
        headers: {
          "User-Agent": "FontCompressService/1.0",
          Accept: "*/*",
        },
      };

      return await new Promise((resolve, reject) => {
        const request = httpModule.get(url, options, (response) => {
          // 检查状态码
          if (response.statusCode < 200 || response.statusCode >= 300) {
            return reject(
              new Error(`下载失败，状态码: ${response.statusCode}`)
            );
          }

          // 创建文件写入流
          const file = fs.createWriteStream(destination);

          // 处理文件写入错误
          file.on("error", (err) => {
            fs.unlink(destination, () => {});
            reject(err);
          });

          // 将响应管道到文件
          response.pipe(file);

          // 文件下载完成
          file.on("finish", () => {
            file.close();
            Logger.info(`文件下载完成，保存到: ${destination}`);
            resolve();
          });
        });

        // 处理请求错误
        request.on("error", (err) => {
          fs.unlink(destination, () => {});
          reject(err);
        });

        // 处理超时
        request.on("timeout", () => {
          request.destroy();
          fs.unlink(destination, () => {});
          reject(new Error(`下载文件超时（${DOWNLOAD_TIMEOUT_MS}ms）`));
        });
      });
    } catch (error) {
      retries++;
      if (retries > MAX_RETRIES) {
        Logger.error(`文件下载失败，重试${MAX_RETRIES}次后放弃`, error);
        throw error;
      }

      Logger.warn(
        `下载失败 (尝试 ${retries}/${MAX_RETRIES})`,
        { error: error.message }
      );
      // 等待短暂时间后重试
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

/**
 * 字体压缩处理函数
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象 
 */
export default async function compressHandler(req, res) {
  let tempInputDir = null;
  let tempOutputDir = null;
  let downloadedFilePath = null;
  let fontminTimeout = null;

  // 设置整体超时
  const abortController = new AbortController();
  const globalTimeoutId = setTimeout(() => {
    Logger.warn("请求处理超时，正在中断操作...");
    abortController.abort();

    if (!res.headersSent) {
      res.status(504).json({ 
        success: false,
        error: "请求处理超时" 
      });
    }

    // 确保资源清理
    cleanup();
  }, GLOBAL_TIMEOUT_MS);

  // 资源清理函数
  async function cleanup() {
    if (fontminTimeout) {
      clearTimeout(fontminTimeout);
    }

    const cleanupPromises = [];
    if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
      cleanupPromises.push(
        fsp
          .unlink(downloadedFilePath)
          .catch((e) =>
            Logger.warn(
              `删除下载的临时文件失败: ${downloadedFilePath}`,
              { error: e.message }
            )
          )
      );
    }
    if (tempInputDir && fs.existsSync(tempInputDir)) {
      cleanupPromises.push(
        fsp
          .rm(tempInputDir, { recursive: true, force: true })
          .catch((e) =>
            Logger.warn(`删除临时输入目录失败: ${tempInputDir}`, 
              { error: e.message }
            )
          )
      );
    }
    if (tempOutputDir && fs.existsSync(tempOutputDir)) {
      cleanupPromises.push(
        fsp
          .rm(tempOutputDir, { recursive: true, force: true })
          .catch((e) =>
            Logger.warn(`删除临时输出目录失败: ${tempOutputDir}`, 
              { error: e.message }
            )
          )
      );
    }
    await Promise.all(cleanupPromises);
    Logger.info("临时文件和目录清理完毕。");
  }

  try {
    // 统一使用url参数（兼容旧的blobUrl、fontUrl）
    const {
      url,
      blobUrl,
      fontUrl: remoteUrl,
      text: userText,
      charsets: charsetIds = [],
    } = req.body;
    const fontUrl = url || blobUrl || remoteUrl;

    // 验证参数
    if (!fontUrl || (!userText && (!Array.isArray(charsetIds) || charsetIds.length === 0))) {
      return res.status(400).json({ 
        success: false,
        error: '缺少 "url" 参数或未提供文本/字符集。' 
      });
    }

    // 验证URL格式
    try {
      new URL(fontUrl);
    } catch (urlError) {
      Logger.error(`无效的字体URL: ${fontUrl}`, urlError);
      return res.status(400).json({ 
        success: false,
        error: `提供的URL格式无效: ${urlError.message}` 
      });
    }

    Logger.info(
      `收到字体压缩请求，URL: ${fontUrl.substring(0, 100)}${
        fontUrl.length > 100 ? "..." : ""
      }`
    );
    Logger.info(
      `选择的字符集: ${
        Array.isArray(charsetIds) ? charsetIds.join(", ") : "无"
      }`
    );
    Logger.info(`提供的文本长度: ${userText ? userText.length : 0} 字符`);

    // 合并用户提供的文本和选择的字符集
    let textToSubset = userText || "";

    // 处理字符集
    if (Array.isArray(charsetIds) && charsetIds.length > 0) {
      Logger.info(`处理字符集: ${charsetIds.join(", ")}`);
      for (const id of charsetIds) {
        const charsetText = getCharset(id);
        if (charsetText) {
          // 添加字符集中未包含在用户文本中的字符
          const charsToAdd = Array.from(charsetText).filter(
            (char) => !textToSubset.includes(char)
          );

          textToSubset += charsToAdd.join("");
          Logger.info(`添加字符集 ${id}: 新增 ${charsToAdd.length} 个字符`);
        } else {
          Logger.warn(`未找到指定的字符集: ${id}`);
        }
      }
    }

    if (!textToSubset || textToSubset.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: "无有效文本进行压缩。请提供文本或有效的字符集ID。" 
      });
    }

    // 创建临时目录
    const baseTempDir = os.tmpdir();
    tempInputDir = await fsp.mkdtemp(path.join(baseTempDir, "font-download-"));
    tempOutputDir = await fsp.mkdtemp(path.join(baseTempDir, "fontmin-output-"));

    // 从URL中提取文件名
    let tempFileName = "font";
    try {
      const urlPath = new URL(fontUrl).pathname;
      const decodedPath = decodeURIComponent(urlPath);
      let extractedName = path.basename(decodedPath);

      // 检查是否成功提取到文件名
      if (!extractedName || extractedName === "/" || extractedName === ".") {
        const parts = decodedPath.split("/").filter((p) => p);
        if (parts.length > 0) {
          extractedName = parts[parts.length - 1];
        } else {
          extractedName = "font"; // 默认名称
        }
      }

      tempFileName = extractedName;
      tempFileName = tempFileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
      if (!tempFileName.match(/\.(otf|ttf)$/i)) {
        tempFileName += ".ttf";
      }

      Logger.info(
        `从URL提取的文件名: ${extractedName} -> 处理后: ${tempFileName}`
      );
    } catch (urlError) {
      Logger.warn("无法从URL解析文件名，将使用默认名称", { error: urlError.message });
      if (!tempFileName.match(/\.(otf|ttf)$/i)) tempFileName += ".ttf";
    }

    downloadedFilePath = path.join(tempInputDir, tempFileName);

    Logger.info(`准备从 ${fontUrl} 下载字体文件到 ${downloadedFilePath}`);
    await downloadFile(fontUrl, downloadedFilePath);
    Logger.info(`字体文件下载完成: ${downloadedFilePath}`);

    // 创建Fontmin实例
    const fontminInstance = new Fontmin()
      .src(downloadedFilePath)
      .dest(tempOutputDir);
    
    // 检查是否为OTF格式，如是则添加otf2ttf转换
    const isOtfFont = downloadedFilePath.toLowerCase().endsWith('.otf');
    if (isOtfFont) {
      Logger.info('检测到OTF格式字体，将先转换为TTF格式');
      fontminInstance.use(otf2ttf());
    }
    
    // 添加子集化处理
    fontminInstance.use(
      Fontmin.glyph({
        text: textToSubset,
        hinting: false,
      })
    );

    // 设置 Fontmin 处理的超时
    let fontminCompleted = false;
    fontminTimeout = setTimeout(() => {
      if (!fontminCompleted) {
        Logger.error("Fontmin处理超时");
        if (!res.headersSent) {
          res.status(504).json({
            success: false,
            error: "Fontmin处理超时，请尝试减少字符数量或使用较小的字体文件",
          });
        }
      }
    }, FONTMIN_TIMEOUT_MS);

    // Fontmin 处理
    const outputFontFiles = await new Promise((resolve, reject) => {
      fontminInstance.run((runErr, outputFontFiles) => {
        fontminCompleted = true;
        if (fontminTimeout) {
          clearTimeout(fontminTimeout);
          fontminTimeout = null;
        }

        if (runErr) {
          return reject(
            new Error(`Fontmin处理错误: ${runErr.message || runErr}`)
          );
        }
        resolve(outputFontFiles);
      });
    });

    const processedDirFiles = await fsp.readdir(tempOutputDir);
    if (processedDirFiles.length === 0) {
      throw new Error("在输出目录中找不到处理后的字体文件。");
    }

    const processedFontFileName = processedDirFiles[0];
    const processedFontPath = path.join(tempOutputDir, processedFontFileName);

    const baseNameWithoutExt = path.basename(
      tempFileName,
      path.extname(tempFileName)
    );
    const processedFileExt = path.extname(processedFontFileName);
    const safeOutputName = generateSafeName(
      `compressed-${baseNameWithoutExt}${processedFileExt}`
    );

    // 读取压缩后的文件
    const fileContent = await fsp.readFile(processedFontPath);

    // 获取当前环境前缀
    const envPrefix = getEnvironmentPrefix();
    Logger.info(`当前环境: ${envPrefix}`);

    // 构建存储路径
    const storagePath = `${envPrefix}/compressed/${safeOutputName}`;
    Logger.info(`压缩文件存储路径: ${storagePath}`);

    // 上传到存储服务并获取URL
    const blob = await put(storagePath, fileContent, {
      access: "public",
      addRandomSuffix: true, 
      contentType:
        processedFileExt === ".ttf"
          ? "application/font-ttf"
          : processedFileExt === ".otf"
          ? "application/font-otf"
          : "application/octet-stream",
    });

    Logger.info(`压缩文件已上传至: ${blob.url}`);

    // 返回压缩后的字体文件链接
    res.status(200).json({
      success: true,
      fontName: safeOutputName || `compressed-${baseNameWithoutExt}${processedFileExt}` || 'compressed-font.ttf',
      fileSize: fileContent.length,
      downloadUrl: blob.url,
    });
  } catch (error) {
    Logger.error("字体压缩请求失败", error);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: `服务器错误: ${error.message || "未知错误"}` 
      });
    }
  } finally {
    // 清除全局超时
    clearTimeout(globalTimeoutId);

    // 清理临时文件和目录
    await cleanup();
  }
} 