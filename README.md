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

## 使用方式

### 1. 网页直接使用

访问服务地址，上传字体文件，输入需要保留的文字，点击"压缩字体"按钮。

### 2. URL参数调用

可以通过URL参数直接传入远程字体地址和需保留文字：

```
https://your-service.com/?fontUrl=https://example.com/font.ttf&text=需要保留的文字
```

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
    "text": "需要保留的字符" // 要保留的文字 (必填)
  }
  ```
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