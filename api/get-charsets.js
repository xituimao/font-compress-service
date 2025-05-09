/**
 * 字符集信息API端点
 * 提供字符集查询服务
 */

import { getAvailableCharsets, getCharset } from './charsets.js';

/**
 * 获取可用的字符集列表或者指定字符集的内容
 * @param {Object} req - HTTP请求对象
 * @param {Object} res - HTTP响应对象
 */
export default async function handler(req, res) {
  try {
    // 设置CORS头，允许前端访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 处理OPTIONS请求
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // 如果指定了charsetName，返回该字符集的内容
    if (req.query.name) {
      const charsetName = req.query.name;
      const charset = getCharset(charsetName);
      
      if (!charset) {
        return res.status(404).json({
          success: false,
          error: `字符集 '${charsetName}' 不存在`
        });
      }
      
      return res.status(200).json({
        success: true,
        name: charsetName,
        characters: charset,
        length: charset.length
      });
    }
    
    // 如果没有指定字符集名称，返回所有可用的字符集列表
    const charsets = getAvailableCharsets();
    
    res.status(200).json({
      success: true,
      charsets
    });
  } catch (error) {
    console.error('获取字符集信息失败:', error);
    res.status(500).json({
      success: false,
      error: '获取字符集信息时发生错误'
    });
  }
}; 