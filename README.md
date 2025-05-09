# 字体压缩服务

一个简洁高效的字体子集化（压缩）服务，支持在线压缩、API调用和iframe嵌入。

## 功能特点

- 支持大文件上传（最大100MB）
- 使用 `fontmin` 进行专业的字体子集化处理
- 用户友好的界面，支持常用字符集快速添加
- 提供统一API接口和URL参数调用方式
- 支持iframe嵌入和postMessage通信

## 项目结构

```
.
├── api/
│   ├── compress.js     # 字体压缩处理函数
│   └── upload-font.js  # 文件上传处理函数
├── js/
│   ├── main.js         # 主逻辑
│   ├── upload.js       # 上传相关
│   ├── charsets.js     # 字符集管理
│   └── ui.js           # UI交互
├── public/             # 静态资源
│   ├── assets/
│   └── css/
├── index.html          # 主页面
├── package.json        # 项目依赖与脚本
├── vercel.json         # 部署配置
└── README.md           # 本说明文档
```
## 本地运行

```bash
npm install
npm start
```

## 使用方式

### 1. 网页直接使用

访问服务地址，上传字体文件，输入需要保留的文字，点击"压缩字体"按钮。

### 2. URL参数调用

可以通过URL参数直接传入远程字体地址和需保留文字及字符集：

```
https://your-service.com/?fontUrl=https://example.com/font.ttf&text=需要保留的文字&charsets=cn,an,el
```

说明：
- `fontUrl`：字体文件的URL (必填)。
- `text`：需要保留的文字 (可选, `text` 和 `charsets` 至少提供一个)。
- `charsets`：逗号分隔的内置字符集ID列表 (可选, `text` 和 `charsets` 至少提供一个)。例如 `cn,an,cc`。

### 3. API调用

```bash
curl -X POST https://your-service.com/api/compress \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/font.ttf", "text": "需要保留的文字"}'
```

### 4. iframe嵌入

```html
<iframe src="https://your-service.com/" width="800" height="600"></iframe>
<script>
  window.addEventListener('message', (e) => {
    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    if (data.type === 'font-compressed') {
      console.log('压缩字体下载链接:', data.downloadUrl);
    }
  });
</script>
```

## API 文档

本服务提供两个主要API端点:

### 1. 文件上传 API

- **接口地址**: `/api/upload-font`
- **请求方法**: `POST`
- **功能**: 处理文件上传，返回上传令牌

### 2. 字体压缩 API

- **接口地址**: `/api/compress`
- **请求方法**: `POST`
- **请求类型**: `application/json`
- **请求参数**:
  ```json
  {
    "url": "https://example.com/font.ttf", // 字体文件URL (必填)
    "text": "需要保留的字符", // 要保留的文字 (可选, text 和 charsets 至少提供一个)
    "charsets": ["cn", "an"] // 要使用的内置字符集ID数组 (可选, text 和 charsets 至少提供一个)
  }
  ```
- **内置字符集ID说明**:
  - `cn`: 中文数字
  - `an`: 阿拉伯数字
  - `el`: 英文字母
  - `cp`: 中文标点
  - `ep`: 英文符号
  - `cc`: 常用汉字500
  - `cn1000`: 常用汉字1000+
  - `tech`: 技术符号
- **响应内容**:
  ```json
  {
    "success": true,
    "fontName": "compressed-font.ttf",
    "fileSize": 12345, // 字节数
    "downloadUrl": "https://example.com/compressed-font.ttf"
  }
  ```

### 3. postMessage 接口

当在iframe中使用时，压缩完成后会向父窗口发送消息：

```json
{
  "type": "font-compressed",
  "downloadUrl": "https://example.com/compressed-font.ttf",
  "fontName": "compressed-font.ttf",
  "fileSize": 12345 // 字节数
}
```

## 注意事项

- 处理大型字体或大量字符时可能会遇到超时问题
- 推荐使用Chrome或Firefox浏览器获得最佳体验 