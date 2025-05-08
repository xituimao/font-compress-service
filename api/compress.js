/**
 * 字体压缩API - 用于将字体文件按指定文本进行子集化处理
 * 现在从Vercel Blob Store获取字体文件
 */
import Fontmin from 'fontmin';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os'; // 用于获取系统临时目录
import { fileURLToPath } from 'node:url'; // 如果需要模拟 __dirname 或 __filename

// 下载文件超时设置
const DOWNLOAD_TIMEOUT_MS = 15000; // 15秒

async function downloadFileFromBlob(blobUrl, downloadPath) {
    // 添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    
    try {
        const response = await fetch(blobUrl, { 
            signal: controller.signal 
        });
        
        if (!response.ok) {
            throw new Error(`从Blob Store下载文件失败: ${response.status} ${response.statusText}`);
        }
        
        const fileBuffer = await response.arrayBuffer();
        await fsp.writeFile(downloadPath, Buffer.from(fileBuffer));
        console.log(`文件已从 ${blobUrl} 下载到 ${downloadPath}`);
    } finally {
        clearTimeout(timeoutId);
    }
}

export default async (req, res) => { // 使用 export default
    // 设置响应头，防止连接挂起
    res.setHeader('Connection', 'close');
    
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    let tempInputDir = null;
    let tempOutputDir = null;
    let downloadedFilePath = null;
    let fontminTimeout = null;
    
    // 设置整体超时
    const GLOBAL_TIMEOUT_MS = 45000; // 45秒
    const abortController = new AbortController();
    const globalTimeoutId = setTimeout(() => {
        console.log('请求处理超时，正在中断操作...');
        abortController.abort();
        
        if (!res.headersSent) {
            res.status(504).json({ error: '请求处理超时' });
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
            cleanupPromises.push(fsp.unlink(downloadedFilePath).catch(e => console.warn(`删除下载的临时文件失败: ${downloadedFilePath}`, e.message)));
        }
        if (tempInputDir && fs.existsSync(tempInputDir)) {
            cleanupPromises.push(fsp.rm(tempInputDir, { recursive: true, force: true }).catch(e => console.warn(`删除临时输入目录失败: ${tempInputDir}`, e.message)));
        }
        if (tempOutputDir && fs.existsSync(tempOutputDir)) {
            cleanupPromises.push(fsp.rm(tempOutputDir, { recursive: true, force: true }).catch(e => console.warn(`删除临时输出目录失败: ${tempOutputDir}`, e.message)));
        }
        await Promise.all(cleanupPromises);
        console.log('临时文件和目录清理完毕。');
    }

    try {
        // 确保请求体是JSON
        if (!req.headers['content-type'] || !req.headers['content-type'].includes('application/json')) {
            return res.status(400).json({ error: '请求体必须是application/json' });
        }

        const { blobUrl, text: textToSubset } = req.body;

        if (!blobUrl || !textToSubset) {
            return res.status(400).json({ error: '缺少 "blobUrl" 或 "text" 参数。' });
        }

        // 创建临时目录来存放下载和处理的文件
        const baseTempDir = os.tmpdir();
        tempInputDir = await fsp.mkdtemp(path.join(baseTempDir, 'font-download-'));
        tempOutputDir = await fsp.mkdtemp(path.join(baseTempDir, 'fontmin-output-'));
        
        // 从blobUrl中提取文件名作为参考，或生成一个唯一文件名
        let tempFileName = 'downloaded-font';
        try {
            const urlPath = new URL(blobUrl).pathname;
            const decodedPath = decodeURIComponent(urlPath);
            tempFileName = path.basename(decodedPath);
            tempFileName = tempFileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
            if (!tempFileName.match(/\.(otf|ttf)$/i)) {
                tempFileName += '.ttf';
            }
        } catch (urlError) {
            console.warn('无法从blobUrl解析文件名，将使用默认名称:', urlError);
            if (!tempFileName.match(/\.(otf|ttf)$/i)) tempFileName += '.ttf';
        }

        downloadedFilePath = path.join(tempInputDir, tempFileName);

        console.log(`准备从 ${blobUrl} 下载字体文件到 ${downloadedFilePath}`);
        await downloadFileFromBlob(blobUrl, downloadedFilePath);
        console.log(`字体文件下载完成: ${downloadedFilePath}`);

        // 增加 Fontmin 处理超时
        const FONTMIN_TIMEOUT_MS = 30000; // 30秒
        
        const fontminInstance = new Fontmin()
            .src(downloadedFilePath)
            .dest(tempOutputDir)
            .use(Fontmin.glyph({
                text: textToSubset,
                hinting: false,
            }));
            
        // 设置 Fontmin 处理的超时
        let fontminCompleted = false;
        fontminTimeout = setTimeout(() => {
            if (!fontminCompleted) {
                console.error('Fontmin处理超时');
                if (!res.headersSent) {
                    res.status(504).json({ error: 'Fontmin处理超时，请尝试减少字符数量或使用较小的字体文件' });
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
                    return reject(new Error(`Fontmin处理错误: ${runErr.message || runErr}`));
                }
                resolve(outputFontFiles);
            });
        });

        const processedDirFiles = await fsp.readdir(tempOutputDir);
        if (processedDirFiles.length === 0) {
            throw new Error('在输出目录中找不到处理后的字体文件。');
        }
        
        const processedFontFileName = processedDirFiles[0];
        const processedFontPath = path.join(tempOutputDir, processedFontFileName);
        
        const baseNameWithoutExt = path.basename(tempFileName, path.extname(tempFileName));
        const processedFileExt = path.extname(processedFontFileName);
        const outputFileName = `compressed-${baseNameWithoutExt}${processedFileExt}`;

        res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);
        let contentType = 'application/octet-stream';
        const ext = processedFileExt.toLowerCase();
        if (ext === '.ttf') contentType = 'application/font-ttf';
        else if (ext === '.otf') contentType = 'application/font-otf';
        else if (ext === '.woff') contentType = 'application/font-woff';
        else if (ext === '.woff2') contentType = 'application/font-woff2';
        res.setHeader('Content-Type', contentType);
        
        const fileStats = await fsp.stat(processedFontPath);
        res.setHeader('Content-Length', fileStats.size);

        // 使用管道流返回文件
        const fileStream = fs.createReadStream(processedFontPath);
        
        // 改进文件流处理
        fileStream.on('error', (streamErr) => {
            console.error('文件流处理错误:', streamErr);
            if (!res.headersSent) {
                res.status(500).json({ error: `文件流错误: ${streamErr.message}` });
            }
            fileStream.destroy();
        });
        
        // 当响应结束或客户端断开连接时，确保清理资源
        res.on('close', () => {
            if (!fileStream.destroyed) {
                fileStream.destroy();
            }
        });
        
        // 启动流传输
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('字体压缩请求失败:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: `服务器错误: ${error.message || '未知错误'}` });
        }
    } finally {
        // 清除全局超时
        clearTimeout(globalTimeoutId);
        
        // 清理临时资源
        await cleanup();
    }
}; 