/**
 * 字体压缩API - 用于将字体文件按指定文本进行子集化处理
 */
import Fontmin from "fontmin";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import https from "node:https";
import http from "node:http";
import { put } from "@vercel/blob";
// 导入otf2ttf插件
import otf2ttf from "fontmin/plugins/otf2ttf.js";
// 导入字符集模块
import { getCharset } from "./charsets.js";

// 下载文件超时设置
const DOWNLOAD_TIMEOUT_MS = 30000; // 30秒

/**
 * 从指定URL下载文件到本地路径
 * @param {string} url - 文件URL
 * @param {string} destination - 本地保存路径
 * @returns {Promise<void>}
 */
async function downloadFile(url, destination) {
  console.log(`开始从URL下载文件: ${url}`);

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
            console.log(`文件下载完成，保存到: ${destination}`);
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
        console.error(`文件下载失败，重试${MAX_RETRIES}次后放弃`, error);
        throw error;
      }

      console.warn(
        `下载失败 (尝试 ${retries}/${MAX_RETRIES})，错误:`,
        error.message
      );
      // 等待短暂时间后重试
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export default async (req, res) => {
  // 设置响应头，防止连接挂起
  res.setHeader("Connection", "close");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "只允许POST请求" });
  }

  let tempInputDir = null;
  let tempOutputDir = null;
  let downloadedFilePath = null;
  let fontminTimeout = null;

  // 设置整体超时
  const GLOBAL_TIMEOUT_MS = 60000; // 60秒
  const abortController = new AbortController();
  const globalTimeoutId = setTimeout(() => {
    console.log("请求处理超时，正在中断操作...");
    abortController.abort();

    if (!res.headersSent) {
      res.status(504).json({ error: "请求处理超时" });
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
            console.warn(
              `删除下载的临时文件失败: ${downloadedFilePath}`,
              e.message
            )
          )
      );
    }
    if (tempInputDir && fs.existsSync(tempInputDir)) {
      cleanupPromises.push(
        fsp
          .rm(tempInputDir, { recursive: true, force: true })
          .catch((e) =>
            console.warn(`删除临时输入目录失败: ${tempInputDir}`, e.message)
          )
      );
    }
    if (tempOutputDir && fs.existsSync(tempOutputDir)) {
      cleanupPromises.push(
        fsp
          .rm(tempOutputDir, { recursive: true, force: true })
          .catch((e) =>
            console.warn(`删除临时输出目录失败: ${tempOutputDir}`, e.message)
          )
      );
    }
    await Promise.all(cleanupPromises);
    console.log("临时文件和目录清理完毕。");
  }

  try {
    // 确保请求体是JSON
    if (
      !req.headers["content-type"] ||
      !req.headers["content-type"].includes("application/json")
    ) {
      return res.status(400).json({ error: "请求体必须是application/json" });
    }

    // 统一使用url参数（兼容旧的blobUrl、fontUrl）
    const {
      url,
      blobUrl,
      fontUrl: remoteUrl,
      text: userText,
      charsets: charsetIds = [],
    } = req.body;
    const fontUrl = url || blobUrl || remoteUrl;

    if (
      !fontUrl ||
      (!userText && (!Array.isArray(charsetIds) || charsetIds.length === 0))
    ) {
      return res
        .status(400)
        .json({ error: '缺少 "url" 参数或未提供文本/字符集。' });
    }

    // 验证URL格式
    try {
      new URL(fontUrl);
    } catch (urlError) {
      console.error(`无效的字体URL: ${fontUrl}`, urlError);
      return res
        .status(400)
        .json({ error: `提供的URL格式无效: ${urlError.message}` });
    }

    console.log(
      `收到字体压缩请求，URL: ${fontUrl.substring(0, 100)}${
        fontUrl.length > 100 ? "..." : ""
      }`
    );
    console.log(
      `选择的字符集: ${
        Array.isArray(charsetIds) ? charsetIds.join(", ") : "无"
      }`
    );
    console.log(`提供的文本长度: ${userText ? userText.length : 0} 字符`);

    // 合并用户提供的文本和选择的字符集
    let textToSubset = userText || "";

    // 处理字符集，使用新的字符集模块
    if (Array.isArray(charsetIds) && charsetIds.length > 0) {
      console.log(`处理字符集: ${charsetIds.join(", ")}`);
      for (const id of charsetIds) {
        const charsetText = getCharset(id);
        if (charsetText) {
          // 添加字符集中未包含在用户文本中的字符
          const charsToAdd = Array.from(charsetText).filter(
            (char) => !textToSubset.includes(char)
          );

          textToSubset += charsToAdd.join("");
          console.log(`添加字符集 ${id}: 新增 ${charsToAdd.length} 个字符`);
        } else {
          console.warn(`未找到指定的字符集: ${id}`);
        }
      }
    }

    if (!textToSubset || textToSubset.length === 0) {
      return res
        .status(400)
        .json({ error: "无有效文本进行压缩。请提供文本或有效的字符集ID。" });
    }

    // 创建临时目录来存放下载和处理的文件
    const baseTempDir = os.tmpdir();
    tempInputDir = await fsp.mkdtemp(path.join(baseTempDir, "font-download-"));
    tempOutputDir = await fsp.mkdtemp(
      path.join(baseTempDir, "fontmin-output-")
    );

    // 从URL中提取文件名
    let tempFileName = "font";
    try {
      const urlPath = new URL(fontUrl).pathname;
      const decodedPath = decodeURIComponent(urlPath);
      // 确保文件名提取正确，特别是对于包含中文字符的URL
      let extractedName = path.basename(decodedPath);

      // 检查是否成功提取到文件名
      if (!extractedName || extractedName === "/" || extractedName === ".") {
        // 尝试从URL的最后部分获取文件名
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

      console.log(
        `从URL提取的文件名: ${extractedName} -> 处理后: ${tempFileName}`
      );
    } catch (urlError) {
      console.warn("无法从URL解析文件名，将使用默认名称:", urlError);
      if (!tempFileName.match(/\.(otf|ttf)$/i)) tempFileName += ".ttf";
    }

    downloadedFilePath = path.join(tempInputDir, tempFileName);

    console.log(`准备从 ${fontUrl} 下载字体文件到 ${downloadedFilePath}`);
    await downloadFile(fontUrl, downloadedFilePath);
    console.log(`字体文件下载完成: ${downloadedFilePath}`);

    // 增加 Fontmin 处理超时
    const FONTMIN_TIMEOUT_MS = 30000; // 30秒

    // 创建Fontmin实例
    const fontminInstance = new Fontmin()
      .src(downloadedFilePath)
      .dest(tempOutputDir);
    
    // 检查是否为OTF格式，如是则添加otf2ttf转换
    const isOtfFont = downloadedFilePath.toLowerCase().endsWith('.otf');
    if (isOtfFont) {
      console.log('检测到OTF格式字体，将先转换为TTF格式');
      // 使用导入的otf2ttf插件
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
        console.error("Fontmin处理超时");
        if (!res.headersSent) {
          res.status(504).json({
            error: "Fontmin处理超时，请尝试减少字符数量或使用较小的字体文件",
          });
        }
      }
    }, FONTMIN_TIMEOUT_MS);

    // Fontmin 处理
    await new Promise((resolve, reject) => {
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

    // 获取当前环境
    const getEnvironmentPrefix = () => {
      return process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
    };

    // 获取当前环境前缀
    const envPrefix = getEnvironmentPrefix();
    console.log(`当前环境: ${envPrefix}`);

    // 构建存储路径 - 确保目录结构正确且一致
    // 1. 环境目录（production/development）
    // 2. 文件类型目录（compressed）
    // 3. 安全的唯一文件名
    const storagePath = `${envPrefix}/compressed/${safeOutputName}`;
    console.log(`压缩文件存储路径: ${storagePath}`);

    // 上传到存储服务并获取URL
    const blob = await put(storagePath, fileContent, {
      access: "public",
      addRandomSuffix: true, // safeOutputName已经包含时间戳和随机字符串
      contentType:
        processedFileExt === ".ttf"
          ? "application/font-ttf"
          : processedFileExt === ".otf"
          ? "application/font-otf"
          : "application/octet-stream",
    });

    console.log(`压缩文件已上传至: ${blob.url}`);

    // 返回压缩后的字体文件链接
    res.status(200).json({
      success: true,
      fontName: safeOutputName || `compressed-${baseNameWithoutExt}${processedFileExt}` || 'compressed-font.ttf',
      fileSize: fileContent.length,
      downloadUrl: blob.url,
    });
  } catch (error) {
    console.error("字体压缩请求失败:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: `服务器错误: ${error.message || "未知错误"}` });
    }
  } finally {
    // 清除全局超时
    clearTimeout(globalTimeoutId);

    // 清理临时文件和目录
    await cleanup();
  }
};

// 生成安全的文件名
function generateSafeName(originalName) {
  // 移除不安全字符，保留字母、数字、下划线和点
  const safeName = originalName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  // 添加时间戳和随机字符串，确保文件名唯一性
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);

  // 提取扩展名
  const extensionMatch = safeName.match(/\.(ttf|otf)$/i);
  const extension = extensionMatch ? extensionMatch[0] : ".ttf";

  // 构建基础名称（不包含扩展名）
  const baseName = extensionMatch
    ? safeName.substring(0, safeName.length - extension.length)
    : safeName;

  return `${baseName}_${timestamp}_${randomString}${extension}`;
}
