/**
 * 字体压缩API - 用于将字体文件按指定文本进行子集化处理
 * 允许用户上传字体文件并指定保留字符，返回压缩后的字体文件
 */
const { IncomingForm } = require('formidable'); // 导入用于解析multipart/form-data的库
const Fontmin = require('fontmin'); // 导入字体处理库(CJS模块)
const fs = require('node:fs'); // 用于文件操作(同步)
const fsp = require('node:fs/promises'); // 用于文件操作(异步Promise版)
const path = require('node:path'); // 用于路径处理

// Vercel特定配置，为此端点禁用默认的请求体解析
// 并可能增加超时时间(Hobby计划最大为serverless函数10-15秒)
module.exports.config = {
  api: {
    bodyParser: false, // 禁用默认的请求体解析器
  },
};

/**
 * 解析表单数据的辅助函数
 * @param {Object} req - 请求对象
 * @returns {Promise<Object>} - 包含字段和文件的对象
 */
function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      keepExtensions: true, // 保留文件扩展名
      // formidable默认使用os.tmpdir()，在Vercel lambda环境中为/tmp
    });
    form.parse(req, (err, fields, files) => {
      if (err) {
        return reject(err);
      }
      resolve({ fields, files });
    });
  });
}

module.exports = async (req, res) => { // Vercel标准CJS导出格式，用于Serverless函数
  // 仅允许POST请求
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  let inputFilePath = null; // 存储上传的字体文件路径
  let tempOutputDir = null; // 存储临时输出目录路径

  try {
    // 解析表单数据，包含字体文件和文本
    const { fields, files } = await parseForm(req);

    const fontFileArray = files.font;
    const textArray = fields.text;

    const fontFile = fontFileArray && fontFileArray[0]; // 获取上传的字体文件
    const textToSubset = textArray && textArray[0]; // 获取需要保留的字符

    // 验证必要参数
    if (!fontFile || !textToSubset) {
      return res.status(400).json({ error: 'Missing "font" file or "text" parameter in form-data. Ensure "font" is a file and "text" is a string.' });
    }

    inputFilePath = fontFile.filepath; // formidable将上传的文件保存到临时路径
    const tempDir = path.dirname(inputFilePath); 
    // 创建临时输出目录
    tempOutputDir = await fsp.mkdtemp(path.join(tempDir, 'fontmin-output-'));

    // 配置Fontmin实例
    const fontminInstance = new Fontmin()
      .src(inputFilePath) // 设置源字体文件
      .dest(tempOutputDir) // 设置输出目录
      .use(Fontmin.glyph({
        text: textToSubset, // 指定需要保留的字符
        hinting: false, // 禁用hinting以减小网页字体体积
      }));
      // 示例：要输出WOFF2格式，取消下面一行的注释：
      // .use(Fontmin.ttf2woff2()); 
      // 如果使用ttf2woff2，确保相应更新输出文件名和Content-Type

    // 执行字体处理
    await new Promise((resolve, reject) => {
      fontminInstance.run((runErr, outputFontFiles) => {
        if (runErr) {
          return reject(new Error(`Fontmin processing error: ${runErr.message || runErr}`));
        }
        if (!outputFontFiles || outputFontFiles.length === 0) {
          return reject(new Error('Fontmin did not produce any output files. Check input font (must be TTF/OTF) and characters.'));
        }
        resolve(outputFontFiles);
      });
    });

    // 检查处理后的文件
    const processedDirFiles = await fsp.readdir(tempOutputDir);
    if (processedDirFiles.length === 0) {
      throw new Error('No processed font file found in the output directory.');
    }
    
    // 获取处理后的文件
    const processedFontFileName = processedDirFiles[0]; // 假设只有一个主要输出文件
    const processedFontPath = path.join(tempOutputDir, processedFontFileName);
    
    // 准备输出文件名
    const originalFileName = fontFile.originalFilename || 'font.ttf'; // 如果原始名称不可用，则使用默认值
    const baseNameWithoutExt = path.basename(originalFileName, path.extname(originalFileName));
    const processedFileExt = path.extname(processedFontFileName); // 获取处理后文件的实际扩展名
    const outputFileName = `compressed-${baseNameWithoutExt}${processedFileExt}`;

    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);
    
    // 根据文件扩展名设置适当的Content-Type
    let contentType = 'application/octet-stream'; // 通用回退类型
    const ext = processedFileExt.toLowerCase();
    if (ext === '.ttf') contentType = 'application/font-ttf';
    else if (ext === '.otf') contentType = 'application/font-otf';
    else if (ext === '.woff') contentType = 'application/font-woff';
    else if (ext === '.woff2') contentType = 'application/font-woff2';
    res.setHeader('Content-Type', contentType);
    
    // 设置内容长度头
    const fileStats = await fsp.stat(processedFontPath);
    res.setHeader('Content-Length', fileStats.size);

    // 创建文件读取流并发送到响应
    const fileStream = fs.createReadStream(processedFontPath);
    
    fileStream.pipe(res);
    
    // 等待流处理完成
    await new Promise((resolveStream, rejectStream) => {
        fileStream.on('finish', resolveStream);
        fileStream.on('error', (streamErr) => {
            console.error('Error during file stream pipe:', streamErr);
            rejectStream(streamErr); // 这将被外部try/catch捕获
        });
        res.on('close', () => { // 处理客户端提前关闭连接
            if (!fileStream.destroyed) {
                fileStream.destroy(new Error('Client closed connection prematurely'));
            }
            // 基于数据是否完全发送或是否处于错误状态来解析或拒绝
            // 为简单起见，这里假设清理将无论如何都会处理
            resolveStream(); 
        });
    });

  } catch (error) {
    // 错误处理
    console.error('Font compression request failed:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: `Server error: ${error.message}` });
    }
  } finally {
    // 清理临时文件和目录
    if (inputFilePath) {
      try { await fsp.unlink(inputFilePath); } catch (e) { console.warn(`Failed to delete temp input file: ${inputFilePath}`, e.message); }
    }
    if (tempOutputDir) {
      try { await fsp.rm(tempOutputDir, { recursive: true, force: true }); } catch (e) { console.warn(`Failed to delete temp output dir: ${tempOutputDir}`, e.message); }
    }
  }
}; 