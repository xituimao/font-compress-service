import { handleUpload } from '@vercel/blob/client';

// 允许的字体MIME类型
const ALLOWED_MIME_TYPES = [
  'font/ttf', 
  'font/otf', 
  'application/octet-stream', 
  'application/vnd.ms-opentype'
];

// 获取当前环境
function getEnvironmentPrefix() {
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
  return env; // 可能的值: 'production', 'preview', 'development'
}

// 设置详细日志
const DEBUG = true;
function log(...args) {
  if (DEBUG) {
    console.log(`[BLOB-UPLOAD ${new Date().toISOString()}]`, ...args);
  }
}

// 从请求体读取JSON
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        if (body) {
          const parsed = JSON.parse(body);
          log('解析请求体成功:', JSON.stringify(parsed).substring(0, 100) + '...');
          resolve(parsed);
        } else {
          log('请求体为空，返回空对象');
          resolve({});
        }
      } catch (error) {
        log('无法解析请求体:', error);
        reject(new Error('无效的JSON请求体: ' + error.message));
      }
    });
    req.on('error', (err) => {
      log('请求流错误:', err);
      reject(err);
    });
  });
}

export default async function handler(req, res) {
  // 设置更长的超时
  req.setTimeout(300000); // 5分钟超时
  
  // 设置CORS和其他响应头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Connection', 'keep-alive');
  
  log('收到上传请求', req.method);
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    log('处理OPTIONS预检请求');
    return res.status(200).end();
  }
  
  // 只允许POST请求
  if (req.method !== 'POST') {
    log('拒绝非POST请求:', req.method);
    return res.status(405).json({ error: '只允许POST方法' });
  }

  try {
    // 解析请求体
    log('开始读取请求体');
    const body = await readRequestBody(req);
    
    // 获取环境前缀
    const envPrefix = getEnvironmentPrefix();
    log('当前环境:', envPrefix);
    
    // 处理上传请求
    log('开始处理上传请求');
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        log('生成上传令牌，原始路径:', pathname);
        
        // 在路径中添加环境前缀
        const fileName = pathname.split('/').pop();
        const prefixedPathname = `fonts/${envPrefix}/${fileName}`;
        log('添加环境前缀后的路径:', prefixedPathname);
        
        return {
          allowedContentTypes: ALLOWED_MIME_TYPES,
          addRandomSuffix: true, // 添加随机后缀以避免文件名冲突
          maxSize: 100 * 1024 * 1024, // 允许最大100MB
          pathname: prefixedPathname, // 使用添加了环境前缀的路径
          tokenPayload: JSON.stringify({
            // 可选，在上传完成时发送到你的服务器
            timestamp: Date.now(),
            environment: envPrefix
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // 客户端上传完成的通知
        // 注意：此回调在localhost网站上不会工作
        // 需要使用ngrok或类似工具获得完整的上传流程体验
        
        log('上传完成回调触发', blob ? blob.url : 'blob为空');
        
        try {
          // 文件上传完成后可以执行任何逻辑
          const { timestamp, environment } = JSON.parse(tokenPayload || '{}');
          if (timestamp) {
            const processingTime = Math.round((Date.now() - timestamp) / 1000);
            log(`文件上传处理耗时: ${processingTime}秒，环境: ${environment}`);
          }
        } catch (error) {
          log('上传完成后处理失败:', error);
        }
      },
    });

    // 返回JSON响应
    log('处理成功，返回响应');
    return res.status(200).json(jsonResponse);
  } catch (error) {
    log('处理上传请求失败:', error);
    return res.status(400).json({ 
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
} 