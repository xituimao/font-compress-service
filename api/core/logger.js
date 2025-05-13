/**
 * 日志记录工具 - 统一管理API日志
 */

/**
 * 日志级别枚举
 */
export const LogLevel = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * 判断是否为生产环境
 * @returns {boolean}
 */
const isProduction = () => {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
};

/**
 * 日志管理类
 */
export default class Logger {
  /**
   * 记录错误日志
   * @param {string} message - 错误消息
   * @param {Error|null} error - 错误对象
   * @param {Object} metadata - 额外元数据
   */
  static error(message, error = null, metadata = {}) {
    const logData = {
      level: LogLevel.ERROR,
      timestamp: new Date().toISOString(),
      message,
      ...metadata
    };
    
    if (error) {
      logData.error = error.message;
      if (!isProduction()) {
        logData.stack = error.stack;
      }
    }
    
    console.error(`[${logData.timestamp}] [${logData.level}] ${message}`, logData);
    
    // 这里可以添加外部日志服务集成
    // 例如Sentry、Datadog等
  }
  
  /**
   * 记录警告日志
   * @param {string} message - 警告消息
   * @param {Object} metadata - 额外元数据
   */
  static warn(message, metadata = {}) {
    const logData = {
      level: LogLevel.WARN,
      timestamp: new Date().toISOString(),
      message,
      ...metadata
    };
    
    console.warn(`[${logData.timestamp}] [${logData.level}] ${message}`, metadata);
  }
  
  /**
   * 记录信息日志
   * @param {string} message - 日志消息
   * @param {Object} metadata - 额外元数据
   */
  static info(message, metadata = {}) {
    const logData = {
      level: LogLevel.INFO,
      timestamp: new Date().toISOString(),
      message,
      ...metadata
    };
    
    console.log(`[${logData.timestamp}] [${logData.level}] ${message}`, metadata);
  }
  
  /**
   * 记录调试日志
   * @param {string} message - 日志消息
   * @param {Object} metadata - 额外元数据
   */
  static debug(message, metadata = {}) {
    // 生产环境不输出调试日志
    if (isProduction()) return;
    
    const logData = {
      level: LogLevel.DEBUG,
      timestamp: new Date().toISOString(),
      message,
      ...metadata
    };
    
    console.log(`[${logData.timestamp}] [${logData.level}] ${message}`, metadata);
  }
} 