import { handleUpload } from '@vercel/blob/client';

// Helper function to read and parse the request body as JSON using event listeners
function readAndParseRequestBodyEvents(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString(); // convert Buffer chunks to string
    });
    req.on('end', () => {
      console.log('Raw body received (events):', body); // Log the raw body
      if (!body) {
        // Handle empty body - this might be the case for some handleUpload actions
        // Let's assume an empty object might be needed, or handleUpload handles it.
        // Resolve with null or an empty object? Let's try null first.
        console.warn('Request body is empty.');
        // It is likely the client sends an empty body for the initial token request?
        // Let's pass the raw empty string, maybe handleUpload expects that for token generation?
        // Reverting this thought: The docs imply a JSON body is sent by the client `upload`.
        // If body is empty, parsing will fail. Let's reject or resolve with null?
        // Rejecting seems safer if we expect JSON.
        return reject(new Error('Empty request body received, expected JSON.'));
      }
      try {
        const parsedBody = JSON.parse(body);
        console.log('Parsed body:', parsedBody);
        resolve(parsedBody);
      } catch (e) {
        console.error("Failed to parse request body (events):", e);
        reject(new Error('Invalid JSON in request body'));
      }
    });
    req.on('error', (err) => {
      console.error('Request stream error:', err);
      reject(err);
    });
  });
}

export default async function POST(request) {
  console.log('Node.js Version:', process.version);
  let parsedBody;
  try {
    console.log('Attempting to read and parse request body...');
    parsedBody = await readAndParseRequestBodyEvents(request);
    console.log('Request body parsed successfully.');

    console.log('Calling handleUpload...');
    // handleUpload is expected to return a Response object or throw an error
    const vercelBlobResponse = await handleUpload({ 
      body: parsedBody, 
      request: request,
      onBeforeGenerateToken: async (pathname /*, clientPayload */) => {
        console.log('Executing onBeforeGenerateToken...');
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
        console.log('Executing onUploadCompleted...');
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
    console.log('handleUpload completed. Attempting to return its response directly.');
    // Assuming handleUpload returns a standard Response object as per Vercel's newer patterns
    return vercelBlobResponse;
  } catch (error) { 
    console.error('--- ERROR CAUGHT ---');
    // Note: parsedBody might not be defined if error occurred during its parsing
    // console.error('Error occurred after parsing body? Body was:', parsedBody); 
    console.error('Full error:', error);
    const errorMessage = error instanceof Error ? error.message : '未知上传错误';
    
    console.log('Attempting to send error response via new Response(JSON.stringify(...))...');
    const errorBodyString = JSON.stringify({ error: errorMessage });
    return new Response(errorBodyString, {
      status: 500, // Let's use 500 for server-side errors consistently
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
} 