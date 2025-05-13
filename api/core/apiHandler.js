/**
 * API处理器封装 - 提供统一的错误处理、CORS和响应格式
 */

/**
 * 创建API处理器 - 包装原始处理函数，提供统一的错误处理和CORS
 * @param {Function} handler - 实际业务逻辑处理函数
 * @param {Array<string>} methods - 允许的HTTP方法
 * @returns {Function} 包装后的处理函数
 */
export function createApiHandler(handler, methods = ['POST']) {
  return async (req, res) => {
    // 设置通用响应头
    res.setHeader('Connection', 'close');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', methods.join(', ') + ', OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 处理OPTIONS请求
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // 检查请求方法
    if (!methods.includes(req.method)) {
      return res.status(405).json({
        success: false,
        error: `不支持的请求方法，只允许: ${methods.join(', ')}`
      });
    }
    
    try {
      // 调用实际的处理函数
      await handler(req, res);
    } catch (error) {
      console.error('API错误:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: '服务器内部错误',
          message: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
      }
    }
  };
}

/**
 * 统一的成功响应格式
 * @param {Object} res - HTTP响应对象
 * @param {Object} data - 响应数据
 * @param {number} status - HTTP状态码
 */
export function successResponse(res, data, status = 200) {
  return res.status(status).json({
    success: true,
    ...data
  });
}

/**
 * 统一的错误响应格式
 * @param {Object} res - HTTP响应对象
 * @param {string} message - 错误消息
 * @param {number} status - HTTP状态码
 */
export function errorResponse(res, message, status = 400) {
  return res.status(status).json({
    success: false,
    error: message
  });
} 