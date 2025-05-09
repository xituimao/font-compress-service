/**
 * 字体压缩API - 用于将字体文件按指定文本进行子集化处理
 */
import Fontmin from "fontmin";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import https from "node:https";
import http from "node:http";
import { put } from "@vercel/blob";
// 导入otf2ttf插件
import otf2ttf from "fontmin/plugins/otf2ttf.js";

// 后端预定义字符集
const BUILTIN_CHARSETS = {
  // 基础字符集
  cn: "零一二三四五六七八九十百千万亿", // 中文数字
  an: "0123456789", // 阿拉伯数字
  el: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", // 英文字母
  cp: '！？。，、；：\'""（）【】《》…—～·', // 中文标点
  ep: "!?,.:;+-=_*&^%$#@<>/\\|", // 英文符号
  cc: "春夏秋冬东南西北天地人你我他是不了在有和就要这一了我不人在他有为这个上们来到时大地为子中你说生国年着就那和要她出也得里后自以会家可下而过天去能对小多然于心学么之都好看起发当没成只如事把还用第样道想作种开美总从无情己面最女但现前些所同日手又行意动方期它头经长儿回位分爱老因很给名法间斯知世什两次使身者被高已亲其进此话常与活正感见明问力理尔点文几定本公特做外孩相西果走将月十实向声车全信重三机工物气每并别真打太新比才便夫再书部水像眼等才更关应表性气你主题命给制度变海业即画设及管京色强字医建谓何广纪况即组精改较次别住证近失老步断带何城相书号须据系科集且观转什山金资济白需株须铁无氧", // 常用汉字500

  // 新增标准字符集
  cn1000:
    "一二三四五六七八九十百千万亿个乙也于以元云专业不世丝两丫严个中丰临为乃久么义之乌乍九书乱乾了予争事二于亏云互五井亚些交亩享京亭亮亲亿什仁仅仆今介仍仓从他付代以众令仪件任企休众优伊伍伏伐休会伞伟伦伯伴伸似但位低住体何余佛作佩你佳使例侍供依侦侧侨侮侯便促俄俊俘保信俭修俱俺倍倒候借假做停健偏值偷傅备傲傻像允充先光克免入八公六兴内全两关兵其具典兹养兼药前剑剪副割力加务动助努劫勃勉勤勺勿包匆北匙匪医匹区匿十千升半协南单卖占卡卫卯印危即卷厂历去县参叉及友双反发叔受变叠叙口古句另叫叭台史右叶号司吃各合吉同名后吐向吓吗君吧吨含听启吴吵吸呆呈告员呜呢周味呵呻和咖咦咧咱咳响哀品哄哎哑哗哟员唱商啊啡啤啥啦啪善喂善喊喘喜喝嗓嗯嘉嘛嘴器四回因困固圆圈国图圳地在场址均坏坐块坚坛坠垂型埋城培基堂堆塔境墨壮声处备复夏外多夜夠够大太央失奇奉奋套奖奥好如妃妄妇妈妙妥妨妹姆姊始姐姑姓委姨姻姿威娃娘娱婆婚婶婿媒嫂嫌子孔字存孩孪孰宁它宅守安宋完宏宗官定宜宝实客宣室宰害家容宿寂寄密富寒寨寸对寻导射尊小少尔尖尚尝尤尸尺尼尾局层居屁展属山岁岔岗岛峰崩嵌川巧差己已巴希帅师帐帘帝带席帮常干平年幸幻幼广庄座庙应店府度座庭康庸廉廊延建式引弹强归当彤彦彬彰影彻往征待律徐徒得御德心必忆忌志忘忙忠快怀态怕怜思急怨总恋恢恨恩恭息恰悄悔悟悦您情惊惑惜想意感愈慈慕慎憾懂戈成或战戏戒戚截户戴所扁扇扎扑扒打托扣扫扬扭扮扯扳扶批找承技抄把抓投抗折披抱抵抹拆拉拌拍拔拖拗招拜拥拦拨拼拾拿持挂指按挑挖挟振捐捕捞损挠挡挣挤挥授挺候挽捉捏捕捡捧据捷掀掃掉掌掘掏掐掠采探接控推措掷描提插握揍援搀搁搂搅搏搜搞搬搭携摄摆摇摊摔摘摧摸撇撑操擒擦支改攻放政故敏教敖救敢散敬数敲文斋料斯新方施旁旅族旗无既旧旨早时昊旺昌明昏易昨昭是星映春昱照显晋晓晚晨普景暂暗暮暴曙曲更曾最有朋服朗望朝期朦木未末本术朱朵机朽杀杂权李材村条来杨杰松板极构林果枣枝枪枯架某染柏柔查柜柯柱标栋栏树样核根格案桃桅框案档桑桔档梁梅梯梳检棋棒棚棵森椅植椭楚楼概榆榜榨榴模樱橙橡次欢欣欧欲款歉歌此步武殊毁毅母毒比毕毗毙毛毯氏民氓气水永汁求汇汉汗江池污汤汰汽沃沙沙沦沧河沿泉法泛波泡泣注泥泰泳洗洛津洪洲活浅测浏流浪浮海消涌涡涯液淡深淹添清渐渔渡温港湖湾源溪滔滚满滴漂演漠漫潮灌火灭灯灰灵炒炮炸点炼烂烈烟烦烧烹焦然照熊熟燕爆爬爱父片版牌牙牛牢物牲牵特牺犯状狂狗独狮狱狼猎猛猜率獸王环现班理琅琉球理琴瑚瑞璃瓜瓶甜生用田由甲申电男画畅界留畜略疏疗疯疲登白百皂的皇皮益盐监盒盖盘盛目直相盾省看県真眼着睛矗矛知短码石矶砸砺砾础硬确礼社祈祝神票祥祯研私秋种科秒秘租积称移稳穆穗穴究空穿突窄窖立站竞竟章童竹等筋筏筐算管箧箭篇簿籍米类粉粗粱精系素索紅紫繁纪约级纵纹线练组绍细织终绘给络绝统绣继绩绪续维综缩缸缺网罕罗罚罩罪署羊美群羹羽翅老考者而耐耕耳耶聊职联聘背胳脊脏脚脱脸腊腰腾臣臧自至致舒舞舞航良色艳芋芙芬花苍苗若苹英范茨茫茬茶草荷莫莱莲获菊菜萄营落着睇睬睹瞧矩石知知码码础祖祖票福穴空窗窥立站章笑笨笛符第等筋答策简管箱范篇簇简簿签籍粉粉粮系系紧约素索紫红纪约级纷纸练细绍织续统绢给络绳结绳维缓缝罚群翠翡翻翼耀考职联肉育背胜胡脉能腕腿臣自至般舰舱艰节芝芦花苏苦英苹茶草荒莱莹获萝落叶葬蒙蓝蔬蕉藏花行着睛硬祝福礼社祟祭禄禅离秀私稻穗空第签简粮粹精糕糖系紧索紫纪约级纷纸练绍织续绣统绩绪续维综编缩缸缺网罢罩置署羊美羽翅翼考者聋职聘肃肆股肢肩肯育肺胃背胯胳脅脊脸脾腐腔腮腰腹腾腿臀臂致舌舍舰舱艰芍花苦英茹荐荒荣莲莹菊落著蓄薇藏虎虑虚虚虫虽虾蚂蛇蛋蜓蜗蜜蜡蝶融螂蟹行衍衣补表袁袋袖被裁裂装裕褐襄西要览觀角解言訓託詠認誓警譬计订训讯计认讲讼论设访证评详语谦谨豪象贝负财贡责贤败货资赏赐赠超越跃跋跌跑距跛跟路跺踊踏踩蹄身躬车轧轮软辀辅辆辈辉辞边辽达过迁迅迈迎运近返还这进远违连迟迹追退送适逊途通逢逸遇遍道違遙遥那邀邦郊部郎郡郭酒里釆重量钟铃链销锁锋锤锦镇長閑闲间闸闻阅阔队防阳阴阵阿际限随险难雄集雏雜雪零雷電霜霞露靠面音響项顺须顾顿颂預頂領頭頻额風飛飞饮饰马駛驱骂骆骑骗骨髓鬥鬧鬼魂魅魔鮮鱼鲜鳄鸟鸡鹰黄黎黑鼓鼠鼻齐",
  tech: "` ~ ! @ # $ % ^ & * ( ) _ + - = { } [ ] | \\ : ; \" ' < > , . ? / \u2318 \u2325 \u2303 \u2388 \u2380 \u238B \u21E7 \u21E5 \u2190 \u2191 \u2192 \u2193 \u21E4 \u21E6 \u21E8 \u21E9 \u25B2 \u25BC \u25C0 \u25B6 \u25D6 \u25D7 \u25CF \u25CB \u25A0 \u25A1 \u25A2 \u25A3 \u25E0 \u25E1 \u25F0 \u25F1 \u25F2 \u25F3 \u25F4 \u25F5 \u25F6 \u25F7 \u25F8 \u25F9 \u25FA \u25FB \u25FC \u25FD \u25FE \u25FF", // 技术符号
};

// 下载文件超时设置
const DOWNLOAD_TIMEOUT_MS = 30000; // 30秒

/**
 * 从指定URL下载文件到本地路径
 * @param {string} url - 文件URL
 * @param {string} destination - 本地保存路径
 * @returns {Promise<void>}
 */
async function downloadFile(url, destination) {
  console.log(`开始从URL下载文件: ${url}`);

  // 最大重试次数
  const MAX_RETRIES = 2;
  let retries = 0;

  while (retries <= MAX_RETRIES) {
    try {
      // 尝试使用URL对象解析URL
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch (error) {
        throw new Error(`无效的URL: ${url}, 错误: ${error.message}`);
      }

      // 选择HTTP或HTTPS模块
      const httpModule = parsedUrl.protocol === "https:" ? https : http;

      // 创建请求，设置超时，并添加适当的请求头
      const options = {
        timeout: DOWNLOAD_TIMEOUT_MS,
        headers: {
          "User-Agent": "FontCompressService/1.0",
          Accept: "*/*",
        },
      };

      return await new Promise((resolve, reject) => {
        const request = httpModule.get(url, options, (response) => {
          // 检查状态码
          if (response.statusCode < 200 || response.statusCode >= 300) {
            return reject(
              new Error(`下载失败，状态码: ${response.statusCode}`)
            );
          }

          // 创建文件写入流
          const file = fs.createWriteStream(destination);

          // 处理文件写入错误
          file.on("error", (err) => {
            fs.unlink(destination, () => {});
            reject(err);
          });

          // 将响应管道到文件
          response.pipe(file);

          // 文件下载完成
          file.on("finish", () => {
            file.close();
            console.log(`文件下载完成，保存到: ${destination}`);
            resolve();
          });
        });

        // 处理请求错误
        request.on("error", (err) => {
          fs.unlink(destination, () => {});
          reject(err);
        });

        // 处理超时
        request.on("timeout", () => {
          request.destroy();
          fs.unlink(destination, () => {});
          reject(new Error(`下载文件超时（${DOWNLOAD_TIMEOUT_MS}ms）`));
        });
      });
    } catch (error) {
      retries++;
      if (retries > MAX_RETRIES) {
        console.error(`文件下载失败，重试${MAX_RETRIES}次后放弃`, error);
        throw error;
      }

      console.warn(
        `下载失败 (尝试 ${retries}/${MAX_RETRIES})，错误:`,
        error.message
      );
      // 等待短暂时间后重试
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export default async (req, res) => {
  // 设置响应头，防止连接挂起
  res.setHeader("Connection", "close");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "只允许POST请求" });
  }

  let tempInputDir = null;
  let tempOutputDir = null;
  let downloadedFilePath = null;
  let fontminTimeout = null;

  // 设置整体超时
  const GLOBAL_TIMEOUT_MS = 60000; // 60秒
  const abortController = new AbortController();
  const globalTimeoutId = setTimeout(() => {
    console.log("请求处理超时，正在中断操作...");
    abortController.abort();

    if (!res.headersSent) {
      res.status(504).json({ error: "请求处理超时" });
    }

    // 确保资源清理
    cleanup();
  }, GLOBAL_TIMEOUT_MS);

  // 资源清理函数
  async function cleanup() {
    if (fontminTimeout) {
      clearTimeout(fontminTimeout);
    }

    const cleanupPromises = [];
    if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
      cleanupPromises.push(
        fsp
          .unlink(downloadedFilePath)
          .catch((e) =>
            console.warn(
              `删除下载的临时文件失败: ${downloadedFilePath}`,
              e.message
            )
          )
      );
    }
    if (tempInputDir && fs.existsSync(tempInputDir)) {
      cleanupPromises.push(
        fsp
          .rm(tempInputDir, { recursive: true, force: true })
          .catch((e) =>
            console.warn(`删除临时输入目录失败: ${tempInputDir}`, e.message)
          )
      );
    }
    if (tempOutputDir && fs.existsSync(tempOutputDir)) {
      cleanupPromises.push(
        fsp
          .rm(tempOutputDir, { recursive: true, force: true })
          .catch((e) =>
            console.warn(`删除临时输出目录失败: ${tempOutputDir}`, e.message)
          )
      );
    }
    await Promise.all(cleanupPromises);
    console.log("临时文件和目录清理完毕。");
  }

  try {
    // 确保请求体是JSON
    if (
      !req.headers["content-type"] ||
      !req.headers["content-type"].includes("application/json")
    ) {
      return res.status(400).json({ error: "请求体必须是application/json" });
    }

    // 统一使用url参数（兼容旧的blobUrl、fontUrl）
    const {
      url,
      blobUrl,
      fontUrl: remoteUrl,
      text: userText,
      charsets: charsetIds = [],
    } = req.body;
    const fontUrl = url || blobUrl || remoteUrl;

    if (
      !fontUrl ||
      (!userText && (!Array.isArray(charsetIds) || charsetIds.length === 0))
    ) {
      return res
        .status(400)
        .json({ error: '缺少 "url" 参数或未提供文本/字符集。' });
    }

    // 验证URL格式
    try {
      new URL(fontUrl);
    } catch (urlError) {
      console.error(`无效的字体URL: ${fontUrl}`, urlError);
      return res
        .status(400)
        .json({ error: `提供的URL格式无效: ${urlError.message}` });
    }

    console.log(
      `收到字体压缩请求，URL: ${fontUrl.substring(0, 100)}${
        fontUrl.length > 100 ? "..." : ""
      }`
    );
    console.log(
      `选择的字符集: ${
        Array.isArray(charsetIds) ? charsetIds.join(", ") : "无"
      }`
    );
    console.log(`提供的文本长度: ${userText ? userText.length : 0} 字符`);

    // 合并用户提供的文本和选择的字符集
    let textToSubset = userText || "";

    // 处理内置字符集
    if (Array.isArray(charsetIds) && charsetIds.length > 0) {
      console.log(`处理内置字符集: ${charsetIds.join(", ")}`);
      for (const id of charsetIds) {
        if (BUILTIN_CHARSETS[id]) {
          // 添加字符集中未包含在用户文本中的字符
          const charsetText = BUILTIN_CHARSETS[id];
          const charsToAdd = Array.from(charsetText).filter(
            (char) => !textToSubset.includes(char)
          );

          textToSubset += charsToAdd.join("");
          console.log(`添加字符集 ${id}: 新增 ${charsToAdd.length} 个字符`);
        }
      }
    }

    if (!textToSubset || textToSubset.length === 0) {
      return res
        .status(400)
        .json({ error: "无有效文本进行压缩。请提供文本或有效的字符集ID。" });
    }

    // 创建临时目录来存放下载和处理的文件
    const baseTempDir = os.tmpdir();
    tempInputDir = await fsp.mkdtemp(path.join(baseTempDir, "font-download-"));
    tempOutputDir = await fsp.mkdtemp(
      path.join(baseTempDir, "fontmin-output-")
    );

    // 从URL中提取文件名
    let tempFileName = "font";
    try {
      const urlPath = new URL(fontUrl).pathname;
      const decodedPath = decodeURIComponent(urlPath);
      // 确保文件名提取正确，特别是对于包含中文字符的URL
      let extractedName = path.basename(decodedPath);

      // 检查是否成功提取到文件名
      if (!extractedName || extractedName === "/" || extractedName === ".") {
        // 尝试从URL的最后部分获取文件名
        const parts = decodedPath.split("/").filter((p) => p);
        if (parts.length > 0) {
          extractedName = parts[parts.length - 1];
        } else {
          extractedName = "font"; // 默认名称
        }
      }

      tempFileName = extractedName;
      tempFileName = tempFileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
      if (!tempFileName.match(/\.(otf|ttf)$/i)) {
        tempFileName += ".ttf";
      }

      console.log(
        `从URL提取的文件名: ${extractedName} -> 处理后: ${tempFileName}`
      );
    } catch (urlError) {
      console.warn("无法从URL解析文件名，将使用默认名称:", urlError);
      if (!tempFileName.match(/\.(otf|ttf)$/i)) tempFileName += ".ttf";
    }

    downloadedFilePath = path.join(tempInputDir, tempFileName);

    console.log(`准备从 ${fontUrl} 下载字体文件到 ${downloadedFilePath}`);
    await downloadFile(fontUrl, downloadedFilePath);
    console.log(`字体文件下载完成: ${downloadedFilePath}`);

    // 增加 Fontmin 处理超时
    const FONTMIN_TIMEOUT_MS = 30000; // 30秒

    // 创建Fontmin实例
    const fontminInstance = new Fontmin()
      .src(downloadedFilePath)
      .dest(tempOutputDir);
    
    // 检查是否为OTF格式，如是则添加otf2ttf转换
    const isOtfFont = downloadedFilePath.toLowerCase().endsWith('.otf');
    if (isOtfFont) {
      console.log('检测到OTF格式字体，将先转换为TTF格式');
      // 使用导入的otf2ttf插件
      fontminInstance.use(otf2ttf());
    }
    
    // 添加子集化处理
    fontminInstance.use(
      Fontmin.glyph({
        text: textToSubset,
        hinting: false,
      })
    );

    // 设置 Fontmin 处理的超时
    let fontminCompleted = false;
    fontminTimeout = setTimeout(() => {
      if (!fontminCompleted) {
        console.error("Fontmin处理超时");
        if (!res.headersSent) {
          res.status(504).json({
            error: "Fontmin处理超时，请尝试减少字符数量或使用较小的字体文件",
          });
        }
      }
    }, FONTMIN_TIMEOUT_MS);

    // Fontmin 处理
    await new Promise((resolve, reject) => {
      fontminInstance.run((runErr, outputFontFiles) => {
        fontminCompleted = true;
        if (fontminTimeout) {
          clearTimeout(fontminTimeout);
          fontminTimeout = null;
        }

        if (runErr) {
          return reject(
            new Error(`Fontmin处理错误: ${runErr.message || runErr}`)
          );
        }
        resolve(outputFontFiles);
      });
    });

    const processedDirFiles = await fsp.readdir(tempOutputDir);
    if (processedDirFiles.length === 0) {
      throw new Error("在输出目录中找不到处理后的字体文件。");
    }

    const processedFontFileName = processedDirFiles[0];
    const processedFontPath = path.join(tempOutputDir, processedFontFileName);

    const baseNameWithoutExt = path.basename(
      tempFileName,
      path.extname(tempFileName)
    );
    const processedFileExt = path.extname(processedFontFileName);
    const safeOutputName = generateSafeName(
      `compressed-${baseNameWithoutExt}${processedFileExt}`
    );

    // 读取压缩后的文件
    const fileContent = await fsp.readFile(processedFontPath);

    // 获取当前环境
    const getEnvironmentPrefix = () => {
      return process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
    };

    // 获取当前环境前缀
    const envPrefix = getEnvironmentPrefix();
    console.log(`当前环境: ${envPrefix}`);

    // 构建存储路径 - 确保目录结构正确且一致
    // 1. 环境目录（production/development）
    // 2. 文件类型目录（compressed）
    // 3. 安全的唯一文件名
    const storagePath = `${envPrefix}/compressed/${safeOutputName}`;
    console.log(`压缩文件存储路径: ${storagePath}`);

    // 上传到存储服务并获取URL
    const blob = await put(storagePath, fileContent, {
      access: "public",
      addRandomSuffix: true, // safeOutputName已经包含时间戳和随机字符串
      contentType:
        processedFileExt === ".ttf"
          ? "application/font-ttf"
          : processedFileExt === ".otf"
          ? "application/font-otf"
          : "application/octet-stream",
    });

    console.log(`压缩文件已上传至: ${blob.url}`);

    // 返回压缩后的字体文件链接
    res.status(200).json({
      success: true,
      fontName: safeOutputName || `compressed-${baseNameWithoutExt}${processedFileExt}` || 'compressed-font.ttf',
      fileSize: fileContent.length,
      downloadUrl: blob.url,
    });
  } catch (error) {
    console.error("字体压缩请求失败:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: `服务器错误: ${error.message || "未知错误"}` });
    }
  } finally {
    // 清除全局超时
    clearTimeout(globalTimeoutId);

    // 清理临时文件和目录
    await cleanup();
  }
};

// 生成安全的文件名
function generateSafeName(originalName) {
  // 移除不安全字符，保留字母、数字、下划线和点
  const safeName = originalName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  // 添加时间戳和随机字符串，确保文件名唯一性
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);

  // 提取扩展名
  const extensionMatch = safeName.match(/\.(ttf|otf)$/i);
  const extension = extensionMatch ? extensionMatch[0] : ".ttf";

  // 构建基础名称（不包含扩展名）
  const baseName = extensionMatch
    ? safeName.substring(0, safeName.length - extension.length)
    : safeName;

  return `${baseName}_${timestamp}_${randomString}${extension}`;
}
