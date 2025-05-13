/**
 * 字符集信息处理器 - 提供字符集查询服务
 */
import { getAvailableCharsets, getCharset } from '../charsets.js';
import Logger from '../core/logger.js';

/**
 * 获取可用的字符集列表或者指定字符集的内容
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
export default async function charsetsHandler(req, res) {
  try {
    Logger.debug('处理字符集请求', { query: req.query });
    
    // 如果指定了charsetName，返回该字符集的内容
    if (req.query.name) {
      const charsetName = req.query.name;
      const charset = getCharset(charsetName);
      
      if (!charset) {
        Logger.warn(`字符集不存在: ${charsetName}`);
        return res.status(404).json({
          success: false,
          error: `字符集 '${charsetName}' 不存在`
        });
      }
      
      Logger.debug(`返回字符集: ${charsetName}`, { length: charset.length });
      return res.status(200).json({
        success: true,
        name: charsetName,
        characters: charset,
        length: charset.length
      });
    }
    
    // 如果没有指定字符集名称，返回所有可用的字符集列表
    const charsets = getAvailableCharsets();
    
    Logger.debug('返回所有可用字符集列表');
    res.status(200).json({
      success: true,
      charsets
    });
  } catch (error) {
    Logger.error('获取字符集信息失败', error);
    res.status(500).json({
      success: false,
      error: '获取字符集信息时发生错误'
    });
  }
} 