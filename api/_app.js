/**
 * API应用入口 - 使用Express框架统一处理跨域、错误和请求
 */
import express from 'express';
import cors from 'cors';
import Logger from './core/logger.js';

// 导入处理器
import uploadHandler from './handlers/upload.js';
import compressHandler from './handlers/compress.js';
import charsetsHandler from './handlers/charsets.js';

// 创建Express应用
const app = express();

// 配置中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// 请求体解析
app.use(express.json({ limit: '4.5mb' }));

// 请求日志
app.use((req, res, next) => {
  Logger.info(`收到${req.method}请求: ${req.url}`, {
    headers: req.headers,
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
  });
  
  // 记录响应时间
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    Logger.debug(`请求处理完成: ${req.method} ${req.url}`, {
      status: res.statusCode,
      duration: `${duration}ms`
    });
  });
  
  next();
});

// 路由定义
app.post('/api/upload-font', uploadHandler);
app.post('/api/compress', compressHandler);
app.get('/api/get-charsets', charsetsHandler);

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  Logger.error('请求处理错误', err, {
    url: req.url,
    method: req.method
  });
  
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: process.env.NODE_ENV !== 'production' ? err.message : undefined
    });
  }
});

// 处理404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `未找到路径: ${req.path}`
  });
});

export default app; 