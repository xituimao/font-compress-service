/**
 * 直接上传API - 用于将字体文件上传到服务器
 * 在本地开发环境中使用，避免Vercel Blob客户端上传问题
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';

// 导入 formidable 处理文件上传
import formidable from 'formidable';

// 禁用 formidable 的 allowEmptyFiles 和 keepExtensions
export const config = {
  api: {
    bodyParser: false,
  },
};

// 确保上传目录存在
async function ensureUploadDir() {
  // 在生产环境使用系统临时目录，在开发环境使用项目内的目录
  const isProduction = process.env.NODE_ENV === 'production';
  let uploadDir;
  
  if (isProduction) {
    uploadDir = path.join(os.tmpdir(), 'font-uploads');
  } else {
    // 获取当前文件目录（在 ESM 中没有 __dirname）
    const modulePath = fileURLToPath(import.meta.url);
    const moduleDir = path.dirname(modulePath);
    const rootDir = path.resolve(moduleDir, '..');
    uploadDir = path.join(rootDir, 'uploads');
  }
  
  // 确保目录存在
  try {
    await fsp.mkdir(uploadDir, { recursive: true });
    console.log(`确保上传目录存在: ${uploadDir}`);
  } catch (err) {
    console.error('创建上传目录失败:', err);
  }
  
  return uploadDir;
}

// 用 formidable 解析文件上传
function parseFormWithFiles(req) {
  return new Promise(async (resolve, reject) => {
    const uploadDir = await ensureUploadDir();
    
    const form = new formidable.IncomingForm({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB 限制
    });
    
    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('解析表单错误:', err);
        return reject(err);
      }
      resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  // 设置响应头，防止连接挂起
  res.setHeader('Connection', 'close');
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  try {
    console.log('处理直接文件上传请求...');
    
    // 解析上传的文件
    const { files } = await parseFormWithFiles(req);
    const fontFile = files.fontFile;
    
    if (!fontFile) {
      return res.status(400).json({ error: '没有找到字体文件' });
    }
    
    console.log(`接收到文件: ${fontFile.originalFilename || fontFile.name}, 大小: ${fontFile.size} 字节`);
    
    // 生成唯一文件名
    const originalName = fontFile.originalFilename || fontFile.name || 'font.ttf';
    const fileExtension = path.extname(originalName);
    const uniqueFilename = `${path.basename(originalName, fileExtension)}-${randomUUID().substring(0, 8)}${fileExtension}`;
    
    let fileUrl;
    
    // 使用 Vercel Blob 把文件作为服务器上传
    try {
      // 从文件系统读取文件
      const fileBuffer = await fsp.readFile(fontFile.filepath);
      
      // 上传到 Vercel Blob
      const blob = await put(uniqueFilename, fileBuffer, {
        access: 'public',
      });
      
      console.log('文件已经上传到Blob存储:', blob);
      fileUrl = blob.url;
    } catch (blobError) {
      console.error('上传到Blob存储失败:', blobError);
      
      // 回退方案：返回临时文件路径作为URL（仅开发环境）
      if (process.env.NODE_ENV !== 'production') {
        const relativePath = path.relative(process.cwd(), fontFile.filepath);
        fileUrl = `/${relativePath.replace(/\\/g, '/')}`;
        console.log('使用本地文件路径作为URL:', fileUrl);
      } else {
        throw blobError;
      }
    }
    
    // 返回文件URL
    return res.status(200).json({
      success: true,
      fileUrl: fileUrl,
      originalName: originalName
    });
    
  } catch (error) {
    console.error('处理上传失败:', error);
    return res.status(500).json({ error: `上传处理错误: ${error.message}` });
  }
} 