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

// Vercel特定配置 - 在 type: module 项目中通常不需要

async function downloadFileFromBlob(blobUrl, downloadPath) {
    const response = await fetch(blobUrl);
    if (!response.ok) {
        throw new Error(`从Blob Store下载文件失败: ${response.status} ${response.statusText}`);
    }
    const fileBuffer = await response.arrayBuffer();
    await fsp.writeFile(downloadPath, Buffer.from(fileBuffer));
    console.log(`文件已从 ${blobUrl} 下载到 ${downloadPath}`);
}

export default async (req, res) => { // 使用 export default
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    let tempInputDir = null;
    let tempOutputDir = null;
    let downloadedFilePath = null;

    try {
        // 确保请求体是JSON
        if (!req.headers['content-type'] || !req.headers['content-type'].includes('application/json')) {
            return res.status(400).json({ error: '请求体必须是application/json' });
        }

        // Vercel Serverless函数会自动解析JSON请求体到req.body (在 ESM 环境下也一样)
        // 如果 Vercel 的请求对象 req 没有自动解析，可能需要手动解析:
        // let body = '';
        // for await (const chunk of req) {
        //     body += chunk;
        // }
        // const { blobUrl, text: textToSubset } = JSON.parse(body);
        // 但通常 Vercel 会处理好，我们先假设 req.body 可用
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

        const fontminInstance = new Fontmin()
            .src(downloadedFilePath)
            .dest(tempOutputDir)
            .use(Fontmin.glyph({
                text: textToSubset,
                hinting: false,
            }));
            
        // Fontmin 的 .run() 返回的是 stream 或 promise，取决于插件
        // 它的 API 文档不够清晰，之前的 Promise 包装可能是对的
        // 我们先保持 Promise 包装
        await new Promise((resolve, reject) => {
            fontminInstance.run((runErr, outputFontFiles) => {
                if (runErr) {
                    return reject(new Error(`Fontmin处理错误: ${runErr.message || runErr}`));
                }
                // 检查 outputFontFiles 是否真的有内容，或者只是 stream 完成的信号
                // Fontmin 文档需要进一步确认，但之前的检查可能是对的
                if (!outputFontFiles || (Array.isArray(outputFontFiles) && outputFontFiles.length === 0)) {
                    // return reject(new Error('Fontmin没有产生任何输出文件。请检查输入字体(必须是TTF/OTF)和字符。'));
                    // 也许 run() 成功时不一定返回 files 数组，而是只表示 stream 完成了？
                    // 先假设之前的逻辑是对的，如果这里报错再调整
                }
                resolve(outputFontFiles); // 即使是 undefined 或空数组也 resolve
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

        const fileStream = fs.createReadStream(processedFontPath);
        fileStream.pipe(res);
        
        await new Promise((resolveStream, rejectStream) => {
            fileStream.on('finish', resolveStream);
            fileStream.on('error', rejectStream);
            res.on('close', () => {
                if (!fileStream.destroyed) {
                    fileStream.destroy(new Error('客户端提前关闭了连接'));
                }
                resolveStream(); 
            });
        });

    } catch (error) {
        console.error('字体压缩请求失败:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: `服务器错误: ${error.message || '未知错误'}` });
        }
    } finally {
        const cleanupPromises = [];
        if (downloadedFilePath && tempInputDir) {
             cleanupPromises.push(fsp.unlink(downloadedFilePath).catch(e => console.warn(`删除下载的临时文件失败: ${downloadedFilePath}`, e.message)));
        }
        if (tempInputDir) {
            cleanupPromises.push(fsp.rm(tempInputDir, { recursive: true, force: true }).catch(e => console.warn(`删除临时输入目录失败: ${tempInputDir}`, e.message)));
        }
        if (tempOutputDir) {
            cleanupPromises.push(fsp.rm(tempOutputDir, { recursive: true, force: true }).catch(e => console.warn(`删除临时输出目录失败: ${tempOutputDir}`, e.message)));
        }
        await Promise.all(cleanupPromises);
        console.log('临时文件和目录清理完毕。');
    }
}; 