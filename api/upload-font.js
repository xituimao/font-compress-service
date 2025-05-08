import { handleUpload } from '@vercel/blob/client';

// 设置详细日志记录
const DEBUG_MODE = true;
function debugLog(...args) {
  if (DEBUG_MODE) {
    console.log(`[DEBUG ${new Date().toISOString()}]`, ...args);
  }
}

// Helper function to read and parse the request body as JSON using event listeners
function readAndParseRequestBodyEvents(req) {
  debugLog("开始读取和解析请求体...");
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString(); // convert Buffer chunks to string
      debugLog(`接收到请求数据块，当前长度: ${body.length} 字节`);
    });
    req.on('end', () => {
      debugLog(`请求体接收完成，总长度: ${body.length} 字节`);
      console.log('Raw body received (events):', body); // Log the raw body
      if (!body) {
        // Handle empty body - this might be the case for some handleUpload actions
        // Let's assume an empty object might be needed, or handleUpload handles it.
        // Resolve with null or an empty object? Let's try null first.
        console.warn('Request body is empty.');
        debugLog("请求体为空");
        // It is likely the client sends an empty body for the initial token request?
        // Let's pass the raw empty string, maybe handleUpload expects that for token generation?
        // Reverting this thought: The docs imply a JSON body is sent by the client `upload`.
        // If body is empty, parsing will fail. Let's reject or resolve with null?
        // Rejecting seems safer if we expect JSON.
        return reject(new Error('Empty request body received, expected JSON.'));
      }
      try {
        const parsedBody = JSON.parse(body);
        debugLog("请求体成功解析为JSON", JSON.stringify(parsedBody).substring(0, 100) + (JSON.stringify(parsedBody).length > 100 ? '...' : ''));
        console.log('Parsed body:', parsedBody);
        resolve(parsedBody);
      } catch (e) {
        console.error("Failed to parse request body (events):", e);
        debugLog("解析请求体为JSON失败", e.message);
        reject(new Error('Invalid JSON in request body'));
      }
    });
    req.on('error', (err) => {
      console.error('Request stream error:', err);
      debugLog("请求流错误", err.message);
      reject(err);
    });
  });
}

export default async function POST(request) {
  debugLog("====================== 开始处理上传请求 ======================");
  debugLog("接收到新的字体上传请求");
  console.log('Node.js Version:', process.version);
  let parsedBody;
  
  // 捕获未处理的拒绝承诺
  process.on('unhandledRejection', (reason, promise) => {
    debugLog('未处理的Promise拒绝:', reason);
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
  
  try {
    debugLog("尝试解析请求体...");
    console.log('Attempting to read and parse request body...');
    parsedBody = await readAndParseRequestBodyEvents(request);
    debugLog("请求体解析成功");
    console.log('Request body parsed successfully.');

    debugLog("开始调用handleUpload...");
    console.log('Calling handleUpload...');
    // handleUpload is expected to return a Response object or throw an error
    const vercelBlobResponse = await handleUpload({ 
      body: parsedBody, 
      request: request,
      onBeforeGenerateToken: async (pathname /*, clientPayload */) => {
        debugLog(`执行onBeforeGenerateToken，路径名: ${pathname}`);
        console.log('Executing onBeforeGenerateToken...');
        // 必须：在此处进行身份验证和授权检查
        // 例如：检查用户会话，确保用户有权上传到此路径名

        // 允许的MIME类型
        const allowedMimeTypes = ['font/ttf', 'font/otf', 'application/octet-stream', 'application/vnd.ms-opentype'];
        debugLog(`允许的MIME类型: ${allowedMimeTypes.join(', ')}`);
        
        return {
          allowedContentTypes: allowedMimeTypes,
          addRandomSuffix: true, // 添加随机后缀以避免文件名冲突
          // 可选：tokenPayload 可以包含要传递给 onUploadCompleted 的数据
          // tokenPayload: JSON.stringify({ userId: 'some-user-id', pathname }),
        };
      },
      // 注意：在本地开发环境中，onUploadCompleted 回调可能不会被 Vercel Blob 服务调用
      // 因此，我们不应该依赖这个回调来完成请求响应
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // 这个回调只会在 Vercel 生产环境中被调用
        // 本地开发环境不应该期待这个回调被执行
        debugLog("执行onUploadCompleted回调", blob ? JSON.stringify(blob).substring(0, 100) + '...' : 'blob为空');
        console.log('Executing onUploadCompleted...');
        console.log('字体文件上传成功到Blob Store:', blob);
      },
    });
    
    // 无论 onUploadCompleted 是否被调用，都确保我们返回正确的响应
    debugLog("handleUpload调用完成，准备返回响应", vercelBlobResponse ? JSON.stringify(vercelBlobResponse).substring(0, 100) + '...' : 'vercelBlobResponse为空');
    console.log('handleUpload completed successfully. Returning response.', vercelBlobResponse);
    
    // 明确设置超时，确保响应不会挂起
    const timeoutMs = 10000; // 10秒
    debugLog(`设置响应超时: ${timeoutMs}ms`);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        debugLog("响应超时，强制返回");
        reject(new Error('Response timeout'));
      }, timeoutMs);
    });
    
    // 使用Promise.race确保在超时前返回响应
    await Promise.race([
      Promise.resolve(),
      timeoutPromise
    ]);
    
    // IMPORTANT: Wrap the JSON output from handleUpload in a standard Response object.
    debugLog("准备返回成功响应");
    const responseJson = JSON.stringify(vercelBlobResponse);
    debugLog(`响应内容长度: ${responseJson.length} 字节`);
    
    return new Response(responseJson, {
      status: 200, // OK
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache',
        'Connection': 'close',
        'X-Debug-Info': 'Font-Upload-Completed'
      },
    });
  } catch (error) { 
    debugLog("捕获到错误", error.message, error.stack);
    console.error('--- ERROR CAUGHT ---');
    // Note: parsedBody might not be defined if error occurred during its parsing
    // console.error('Error occurred after parsing body? Body was:', parsedBody); 
    console.error('Full error:', error);
    const errorMessage = error instanceof Error ? error.message : '未知上传错误';
    
    debugLog("准备返回错误响应", errorMessage);
    console.log('Attempting to send error response via new Response(JSON.stringify(...))...');
    const errorBodyString = JSON.stringify({ error: errorMessage });
    return new Response(errorBodyString, {
      status: 500, // Let's use 500 for server-side errors consistently
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache',
        'Connection': 'close',
        'X-Debug-Info': 'Font-Upload-Error'
      },
    });
  } finally {
    debugLog("====================== 上传请求处理完成 ======================");
  }
} 