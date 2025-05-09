/**
 * charsets.js
 * 包含所有预定义的字符集及其相关操作
 */

// 预定义字符集
export const charsets = {
    cn: '零一二三四五六七八九十百千万亿', // 中文数字
    an: '0123456789', // 阿拉伯数字
    el: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', // 英文字母
    cp: '！？。，、；：\'\""（）【】《》…—～·', // 中文标点
    ep: '!?,.:;+-=_*&^%$#@<>/\\|', // 英文符号
    cc: '春夏秋冬东南西北天地人你我他是不了在有和就要这一了我不人在他有为这个上们来到时大地为子中你说生国年着就那和要她出也得里后自以会家可下而过天去能对小多然于心学么之都好看起发当没成只如事把还用第样道想作种开美总从无情己面最女但现前些所同日手又行意动方期它头经长儿回位分爱老因很给名法间斯知世什两次使身者被高已亲其进此话常与活正感见明问力理尔点文几定本公特做外孩相西果走将月十实向声车全信重三机工物气每并别真打太新比才便夫再书部水像眼等才更关应表性气你主题命给制度变海业即画设及管京色强字医建谓何广纪况即组精改较次别住证近失老步断带何城相书号须据系科集且观转什山金资济白需株须铁无氧' // 常用汉字500
};

/**
 * 为文本添加字符集
 * @param {string} text - 原始文本
 * @param {Array<string>} charsetIds - 要添加的字符集ID数组
 * @returns {Object} 包含结果文本和是否添加新字符的信息
 */
export function addCharsetsToText(text, charsetIds) {
    let currentText = text;
    let newCharsAdded = false;
    
    charsetIds.forEach(charsetId => {
        const charsToAdd = charsets[charsetId];
        
        if (charsToAdd) {
            const newCharsArray = Array.from(charsToAdd).filter(char => !currentText.includes(char));
            if (newCharsArray.length > 0) {
                currentText += newCharsArray.join('');
                newCharsAdded = true;
            }
        }
    });
    
    return {
        text: currentText,
        hasNewChars: newCharsAdded
    };
}

/**
 * 获取预定义字符集的名称
 * @param {string} charsetId - 字符集ID
 * @returns {string} 字符集的显示名称
 */
export function getCharsetName(charsetId) {
    const names = {
        cn: '中文数字',
        an: '阿拉伯数字',
        el: '英文字母',
        cp: '中文标点',
        ep: '英文符号',
        cc: '常用汉字500'
    };
    
    return names[charsetId] || charsetId;
}

/**
 * 获取字符集统计信息
 * @param {string} text - 要分析的文本
 * @returns {Object} 字符统计信息
 */
export function getTextStats(text) {
    return {
        total: text.length,
        unique: new Set(text).size
    };
}

/**
 * 前端字符集管理模块
 * 用于从API获取字符集信息并生成界面元素
 */

// 存储从服务器获取的字符集信息
let availableCharsets = {
  standard: [],
  combined: []
};

// 字符集分类显示名称映射
const CHARSET_CATEGORY_NAMES = {
  standard: "标准字符集",
  combined: "组合字符集"
};

// 字符集显示名称映射
const CHARSET_DISPLAY_NAMES = {
  // 基础符号集
  digits: "数字 (0-9)",
  latin_basic: "基本拉丁字母 (a-z, A-Z)",
  punctuation_basic: "基本标点符号",
  
  // Google Fonts API 字符集
  latin: "拉丁字符集",
  latin_ext: "扩展拉丁字符集",
  cyrillic: "西里尔字符集",
  cyrillic_ext: "扩展西里尔字符集",
  greek: "希腊字符集",
  greek_ext: "扩展希腊字符集",
  vietnamese: "越南文字符集",
  
  // 中文字符集
  chinese_level1: "常用汉字（基础）",
  chinese_common: "常用汉字（扩展）",
  
  // 标准化字符集
  wgl4: "WGL4 泛欧洲字符集",
  w1g: "W1G 专业排版字符集",
  
  // 专业符号集
  math: "数学符号",
  currency: "货币符号",
  arrows: "箭头符号",
  
  // 组合字符集
  basic: "基础组合字符集",
  web_safe: "网页安全字符集",
  european: "欧洲语言字符集",
  "pan-european": "泛欧洲全面字符集",
  
  // 兼容旧字符集ID (仅用于向后兼容)
  // 新代码不应该使用这些ID
  cn: "[旧] 中文数字",
  an: "[旧] 阿拉伯数字",
  el: "[旧] 英文字母",
  cp: "[旧] 中文标点",
  ep: "[旧] 英文符号",
  cc: "[旧] 常用汉字500",
  cn1000: "[旧] 常用汉字1000+",
  tech: "[旧] 技术符号"
};

/**
 * 从服务器获取所有可用字符集信息
 * @returns {Promise<Object>} 字符集信息对象
 */
async function fetchAvailableCharsets() {
  try {
    const response = await fetch('/api/get-charsets');
    if (!response.ok) {
      throw new Error(`获取字符集失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    if (data.success && data.charsets) {
      availableCharsets = data.charsets;
      return data.charsets;
    } else {
      throw new Error('获取字符集信息失败，服务器未返回有效数据');
    }
  } catch (error) {
    console.error('获取字符集失败:', error);
    throw error;
  }
}

/**
 * 获取字符集的显示名称
 * @param {string} charsetId 字符集ID
 * @returns {string} 显示名称
 */
function getCharsetDisplayName(charsetId) {
  return CHARSET_DISPLAY_NAMES[charsetId] || charsetId;
}

/**
 * 获取特定字符集的字符信息
 * @param {string} charsetId 字符集ID
 * @returns {Promise<Object>} 字符集详细信息
 */
async function fetchCharsetDetails(charsetId) {
  try {
    const response = await fetch(`/api/get-charsets?name=${encodeURIComponent(charsetId)}`);
    if (!response.ok) {
      throw new Error(`获取字符集详情失败: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`获取字符集 ${charsetId} 详情失败:`, error);
    throw error;
  }
}

/**
 * 生成字符集选择界面
 * @param {string} containerId 要插入界面的容器元素ID
 * @returns {Promise<void>}
 */
async function generateCharsetSelectors(containerId) {
  try {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`找不到容器元素: ${containerId}`);
    }
    
    // 如果尚未加载字符集，先加载
    if (availableCharsets.standard.length === 0) {
      await fetchAvailableCharsets();
    }
    
    // 清空容器
    container.innerHTML = '<h4>字符集选择：</h4>';
    
    // 为每个分类创建字符集选择区
    for (const [category, charsets] of Object.entries(availableCharsets)) {
      // 如果该分类没有字符集，跳过
      if (!charsets || charsets.length === 0) continue;
      
      // 创建分类标题
      const categoryTitle = document.createElement('h5');
      categoryTitle.textContent = CHARSET_CATEGORY_NAMES[category] || category;
      categoryTitle.className = 'charset-category';
      container.appendChild(categoryTitle);
      
      // 创建字符集选择区
      const charsetsContainer = document.createElement('div');
      charsetsContainer.className = 'preset-options';
      
      // 添加每个字符集的选择框
      for (const charsetId of charsets) {
        // 创建字符集选择项
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'checkbox-item';
        
        // 创建复选框
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `charset-${charsetId}`;
        checkbox.className = 'preset-checkbox';
        checkbox.setAttribute('data-id', charsetId);
        
        // 创建标签
        const label = document.createElement('label');
        label.htmlFor = `charset-${charsetId}`;
        label.textContent = getCharsetDisplayName(charsetId);
        
        // 添加提示信息
        label.title = `点击查看 ${getCharsetDisplayName(charsetId)} 包含的字符`;
        
        // 添加点击事件以显示字符集详情
        label.addEventListener('click', async (e) => {
          e.preventDefault(); // 防止立即切换复选框状态
          
          try {
            const details = await fetchCharsetDetails(charsetId);
            if (details.success && details.characters) {
              alert(`${getCharsetDisplayName(charsetId)}\n包含 ${details.length} 个字符\n示例: ${details.characters.slice(0, 50)}${details.characters.length > 50 ? '...' : ''}`);
            } else {
              alert(`无法获取字符集 ${charsetId} 的详细信息`);
            }
          } catch (error) {
            console.error(`显示字符集 ${charsetId} 详情失败:`, error);
          }
          
          // 允许复选框切换状态
          setTimeout(() => {
            checkbox.checked = !checkbox.checked;
          }, 100);
        });
        
        // 组装元素
        checkboxItem.appendChild(checkbox);
        checkboxItem.appendChild(label);
        charsetsContainer.appendChild(checkboxItem);
      }
      
      container.appendChild(charsetsContainer);
    }
  } catch (error) {
    console.error('生成字符集选择界面失败:', error);
    
    // 创建错误提示
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.textContent = '加载字符集失败，请刷新页面重试';
    
    const container = document.getElementById(containerId);
    if (container) {
      container.appendChild(errorMessage);
    }
  }
}

/**
 * 获取所有选中的字符集ID
 * @returns {string[]} 选中的字符集ID数组
 */
function getSelectedCharsets() {
  const checkboxes = document.querySelectorAll('.preset-checkbox:checked');
  return Array.from(checkboxes).map(checkbox => checkbox.getAttribute('data-id'));
}

// 导出函数
export {
  fetchAvailableCharsets,
  generateCharsetSelectors,
  getSelectedCharsets,
  fetchCharsetDetails
}; 