# 字体压缩服务 (Vercel 部署版)

一个使用 `fontmin` 实现的简单字体子集化（压缩）服务，可部署于 Vercel。

## 前提条件

-   Node.js (推荐 v18.x 或更高版本) 和 npm / yarn
-   [Vercel CLI](https://vercel.com/docs/cli) (全局安装: `npm install -g vercel`)

## 项目结构

```
.
├── api/
│   └── compress.js   # Serverless 函数
├── package.json      # 项目依赖与脚本
├── vercel.json       # Vercel 部署配置
└── README.md         # 本说明文档
```

## 本地安装与运行

1.  进入项目目录，执行 `npm install` (或 `yarn install`) 安装依赖。
2.  使用 Vercel CLI 在本地运行服务进行测试：
    ```bash
    vercel dev
    ```
    服务通常会运行在 `http://localhost:3000`，压缩接口为 `http://localhost:3000/api/compress`。

## 部署到 Vercel

1.  登录 Vercel CLI: `vercel login`
2.  在项目根目录下，执行部署命令:
    ```bash
    vercel
    ```
    或部署到生产环境：
    ```bash
    vercel --prod
    ```
    根据提示操作即可。Vercel 会自动检测 Node.js 项目并部署 Serverless 函数。

## API 使用方法

-   **接口地址**: `/api/compress` (相对于你的部署域名)
-   **请求方法**: `POST`
-   **请求类型**: `multipart/form-data`
-   **表单字段**:
    -   `font`: 字体文件 (例如 `.ttf`, `.otf`)。
    -   `text`: 需要包含在子集化字体中的文字字符串。

**使用 cURL 测试示例:**

```bash
curl -X POST \
  -F "font=@/path/to/your/font.ttf" \
  -F "text=你好世界 Hello World 123" \
  https://your-deployment-name.vercel.app/api/compress \
  -o compressed_output_font.ttf
```

请将 `/path/to/your/font.ttf` 替换为你的字体文件实际路径，并将 `https://your-deployment-name.vercel.app` 替换为你的 Vercel 部署成功后的 URL。

## 注意事项
*   `fontmin` 及其依赖的一些二进制包（如 ttf2woff）在 Serverless 环境中可能存在兼容性或路径问题。如果部署后运行出错，请检查 Vercel 的函数日志获取详细错误信息。
*   Vercel 的 Hobby 免费套餐对函数执行时长和内存有限制。复杂或大型字体的处理可能超出限制。 