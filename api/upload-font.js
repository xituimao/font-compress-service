import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server'; // Vercel Functions API 类似于 Next.js

export default async function POST(request) {
  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname /*, clientPayload */) => {
        // 必须：在此处进行身份验证和授权检查
        // 例如：检查用户会话，确保用户有权上传到此路径名

        // 允许的MIME类型
        const allowedMimeTypes = ['font/ttf', 'font/otf', 'application/octet-stream', 'application/vnd.ms-opentype'];
        
        return {
          allowedContentTypes: allowedMimeTypes,
          addRandomSuffix: true, // 添加随机后缀以避免文件名冲突
          // 可选：tokenPayload 可以包含要传递给 onUploadCompleted 的数据
          // tokenPayload: JSON.stringify({ userId: 'some-user-id', pathname }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // 可选：当上传完成时调用此函数
        // 重要：在本地开发(localhost)时，此回调可能不会被Vercel Blob服务直接调用到
        // 因为Vercel的服务器无法直接访问你的localhost。
        // 使用ngrok或类似的隧道服务可以帮助在本地测试完整的上传流程。
        console.log('字体文件上传成功到Blob Store:', blob);

        // 可选：可以在这里执行数据库更新等操作
        // const { userId, pathname } = JSON.parse(tokenPayload);
        // console.log(`用户 ${userId} 上传了 ${pathname} 到 ${blob.url}`);
        // await db.updateUserAvatar(userId, blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('上传处理程序错误:', error);
    // 根据Vercel文档，返回400状态码，以便webhook重试
    const errorMessage = error instanceof Error ? error.message : '未知上传错误';
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 },
    );
  }
} 