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