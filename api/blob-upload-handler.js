import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server'; // Vercel Functions use a similar API to Next.js Edge/Node.js runtime

/**
 * 将上传信息记录到日志
 * @param {object} blob - 上传的blob对象
 */
async function logUpload(blob) {
  // 这里只记录日志，不执行认证
  console.log(`记录上传: ${blob.pathname} 到 ${blob.url}`);
}

export default async function POST(request) {
  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (
        pathname,
        clientPayload
      ) => {
        // 记录上传但不执行认证
        console.log('Generating token for pathname:', pathname);
        
        return {
          // 允许上传的文件类型 (MIME types)
          allowedContentTypes: ['application/octet-stream', 'font/ttf', 'font/otf', 'application/vnd.ms-opentype'], 
          tokenPayload: JSON.stringify({
            // 不包含用户ID，但保留其他元数据
            source: 'font-compress-service-frontend',
            clientData: clientPayload
          }),
          // 添加随机后缀避免文件名冲突
          addRandomSuffix: true,
          // 设置一年的缓存过期时间
          cacheControlMaxAge: 365 * 24 * 60 * 60, // 1 year
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // 当文件成功上传到 Blob Store 后，这个函数会被调用
        // ⚠️ 注意: 在本地开发 (localhost) 时，这个回调可能不会被 Vercel Blob 服务直接调用到，
        // 因为 Vercel 的服务器无法直接访问你的 localhost。
        // 使用 ngrok 或类似的隧道服务可以帮助在本地测试完整的上传流程。
        console.log('Blob upload completed:', blob);
        
        try {
          // 解析上传时传递的数据
          const payload = JSON.parse(tokenPayload || '{}');
          console.log('Token payload:', payload);
          
          // 只记录上传，不关联到用户
          await logUpload(blob);
          
          console.log(`Successfully uploaded ${blob.pathname} to ${blob.url}`);
        } catch (error) {
          console.error('Error in onUploadCompleted:', error);
          // 即便这里出错，文件也已经上传了。这里主要处理后续逻辑的错误。
          // 通常不建议在这里抛出错误导致整个请求失败，除非后续逻辑至关重要。
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Error in blob upload handler:', error);
    // 根据 Vercel 文档，返回 400 状态码，以便 webhook 重试
    return NextResponse.json(
      { error: error.message || 'Blob upload failed.' },
      { status: 400 },
    );
  }
}

// 如果你使用的是 module.exports 而不是 ES6 模块，可以这样导出：
// module.exports = async (req, res) => { ... }
// 注意：Vercel 通常推荐使用 ES 模块语法与 async/await。
// 对于 `NextResponse`, Vercel Functions 模仿了 Next.js 的 API。
// 如果直接使用 Node.js http 模块，你需要这样发送响应:
// res.status(200).json(jsonResponse);
// res.status(400).json({ error: error.message }); 