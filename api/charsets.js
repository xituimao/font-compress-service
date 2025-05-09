/**
 * 字体子集化系统字符集定义
 * 包含多种标准字符集与分类定义
 */

// 基础符号集
const DIGITS = "0123456789";
const LATIN_BASIC = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PUNCTUATION_BASIC = ",.?!;:'\"-()[]{}<>/\\|`~@#$%^&*+=_";

// 标准语言字符集 (Google Fonts API 兼容)
const LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?'\"\\/|_-+=()<>[]{}#%^*~`@&$€£¥¢¤°©®™§¶†‡•…‰←↑→↓◊ÆæÐðØøÞþßÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿ";
const LATIN_EXT = "ĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃńŅņŇňŉŊŋŌōŎŏŐőŒœŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŦŧŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžſƒǰǺǻǼǽǾǿȘșȚțȷʼˆˇˉ˘˙˚˛˜˝ẀẁẂẃẄẅỲỳ";
const CYRILLIC = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюяЁёЂђЃѓЄєЅѕІіЇїЈјЉљЊњЋћЌќЍѝЎўЏџҐґ";
const CYRILLIC_EXT = "ҐґҒғҖҗҚқҢңҮүҰұҲҳҶҷӘәӨөӮӯ";
const GREEK = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρςστυφχψωάέήίόύώΆΈΉΊΌΎΏΐΰϊϋΪΫ";
const VIETNAMESE = "ẠạẢảẤấẦầẨẩẪẫẬậẮắẰằẲẳẴẵẶặẸẹẺẻẼẽẾếỀềỂểỄễỆệỈỉỊịỌọỎỏỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỤụỦủỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹ";

// 中文字符集 (简化版展示)
const CHINESE_LEVEL1 = "一二三四五六七八九十百千万亿元年月日时分秒";
const CHINESE_COMMON = "的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平";

// 专业符号集
const MATH = "±×÷≠≈≤≥∑∏√∞∫∆∂∇∥∠∟∣∥∦∧∨∩∪∈∉⊂⊃⊆⊇⊕⊗⊥⋅⌈⌉⌊⌋";
const CURRENCY = "¤$¢£¥€₽₨₩₪₫₭₮₯₱₲₳₴₵₸₹₺₼₽₾";
const ARROWS = "←↑→↓↔↕↖↗↘↙⇐⇒⇔⇧⇩⇦⇨";

// 构建字符集对象
const CHARSETS = {
  // 基础符号集
  digits: DIGITS,
  latin_basic: LATIN_BASIC,
  punctuation_basic: PUNCTUATION_BASIC,
  
  // 标准语言字符集
  latin: LATIN,
  latin_ext: LATIN_EXT,
  cyrillic: CYRILLIC,
  cyrillic_ext: CYRILLIC_EXT,
  greek: GREEK,
  vietnamese: VIETNAMESE,
  
  // 中文字符集
  chinese_level1: CHINESE_LEVEL1,
  chinese_common: CHINESE_COMMON,
  
  // 专业符号集
  math: MATH,
  currency: CURRENCY,
  arrows: ARROWS
};

// 一些常用的组合字符集
const COMBINED_CHARSETS = {
  basic: DIGITS + LATIN_BASIC + PUNCTUATION_BASIC,
  web_safe: LATIN,
  european: LATIN + LATIN_EXT,
  "pan-european": LATIN + LATIN_EXT + CYRILLIC + GREEK
};

/**
 * 获取所有可用的字符集名称
 * @returns {Object} 包含所有字符集类别和名称的对象
 */
function getAvailableCharsets() {
  return {
    standard: Object.keys(CHARSETS),
    combined: Object.keys(COMBINED_CHARSETS)
  };
}

/**
 * 获取特定字符集
 * @param {string} name 字符集名称
 * @returns {string|null} 返回字符集字符串或者null
 */
function getCharset(name) {
  // 处理下划线/连字符命名差异
  const normalizedName = name.replace(/-/g, '_');
  return CHARSETS[normalizedName] || CHARSETS[name] || COMBINED_CHARSETS[name] || null;
}

/**
 * 合并多个字符集
 * @param {...string} charsetNames 要合并的字符集名称
 * @returns {string} 合并后的字符集
 */
function combineCharsets(...charsetNames) {
  return charsetNames.map(name => getCharset(name) || "").join("");
}

export {
  CHARSETS,
  COMBINED_CHARSETS,
  getAvailableCharsets,
  getCharset,
  combineCharsets
}; 