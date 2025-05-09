/**
 * main.js
 * 字体压缩服务的主入口JavaScript文件
 */

// 导入模块
import {
  initUI,
  showError,
  showSuccess,
  setLoading,
  updateProgress,
  downloadFile,
  showLinkModal,
} from "./ui.js";
import { uploadFileToBlobStore, isValidFileType } from "./upload.js"; // uploadFileToBlobStore 现在使用@vercel/blob/client
import { generateCharsetSelectors, getSelectedCharsets } from "./charsets.js"; // 导入字符集模块

// DOM就绪后执行初始化
document.addEventListener("DOMContentLoaded", init);

// 全局变量，用于存储DOM元素引用
let form, fileInput, textInput, submitBtn, fileSizeWarning;
let resultModal, resultLink, copyLinkBtn, downloadBtn, closeBtn;

/**
 * 初始化应用
 */
function init() {
  // 初始化UI工具
  initUI();

  // 获取DOM元素引用
  form = document.getElementById("compressForm");
  fileInput = document.getElementById("fontFile");
  textInput = document.getElementById("textInput");
  submitBtn = document.getElementById("submitBtn");
  fileSizeWarning = document.getElementById("fileSizeWarning");

  // 获取模态窗口元素
  resultModal = document.getElementById("resultModal");
  resultLink = document.getElementById("resultLink");
  copyLinkBtn = document.getElementById("copyLink");
  downloadBtn = document.getElementById("downloadFont");
  closeBtn = document.querySelector(".close");

  // 加载字符集选择界面
  generateCharsetSelectors("charset-container").catch(error => {
    console.error("加载字符集失败:", error);
    showError("加载字符集失败，请刷新页面重试");
  });

  // 绑定事件处理程序
  bindEvents();

  // 检查URL参数并处理
  checkUrlParameters();
}

/**
 * 绑定各种事件处理函数
 */
function bindEvents() {
  // 监听表单提交
  form.addEventListener("submit", handleFormSubmit);

  // 监听文件选择变化，检查文件大小
  fileInput.addEventListener("change", handleFileSelection);

  // 模态窗口事件绑定
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      resultModal.style.display = "none";
    });
  }

  if (copyLinkBtn) {
    copyLinkBtn.addEventListener("click", () => {
      resultLink.select();
      document.execCommand("copy");
      copyLinkBtn.textContent = "已复制!";
      setTimeout(() => {
        copyLinkBtn.textContent = "复制链接";
      }, 2000);
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      if (resultLink.value) {
        window.open(resultLink.value, "_blank");
      }
    });
  }

  // 点击模态窗口外部关闭
  window.addEventListener("click", (e) => {
    if (e.target === resultModal) {
      resultModal.style.display = "none";
    }
  });

  // 监听postMessage
  window.addEventListener("message", (e) => {
    try {
      const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      if (data.type === "font-compressed" && data.downloadUrl) {
        showCompressResult(data.downloadUrl, data.fontName, data.fileSize);
      }
    } catch (error) {
      console.error("处理postMessage时出错:", error);
    }
  });
}

/**
 * 检查URL参数并处理
 */
function checkUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const fontUrl = urlParams.get("fontUrl");
  const text = urlParams.get("text");
  const charsetIdsParam = urlParams.get("charsets"); // 获取charsets参数

  if (fontUrl) {
    // 如果有URL参数，执行远程字体处理
    let charsetIds = [];
    if (charsetIdsParam) {
      charsetIds = charsetIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id);
      
      // 等待字符集选择器初始化完成后再选中复选框
      // 由于字符集是动态加载的，需要等待一段时间或使用事件通知
      const waitForCharsetSelectors = () => {
        if (document.querySelectorAll('.preset-checkbox').length > 0) {
          // 字符集选择器已加载，选中指定字符集
          charsetIds.forEach((id) => {
            const checkbox = document.querySelector(
              `.preset-checkbox[data-id="${id}"]`
            );
            if (checkbox) checkbox.checked = true;
          });
        } else {
          // 字符集选择器尚未加载，继续等待
          setTimeout(waitForCharsetSelectors, 100);
        }
      };
      
      // 开始等待字符集选择器
      waitForCharsetSelectors();
    }

    if (text || charsetIds.length > 0) {
      // 确保 text 或 charsets 至少有一个
      processRemoteFont(fontUrl, text || "", charsetIds); // 传递charsetIds
    } else {
      showError("URL参数中缺少 text 或 charsets 参数");
    }
  }
}

/**
 * 处理远程字体
 * @param {string} fontUrl - 远程字体URL
 * @param {string} text - 需要保留的文字
 * @param {Array<string>} charsetIds - 需要使用的字符集ID数组
 */
async function processRemoteFont(fontUrl, text, charsetIds = []) {
  showError("");
  submitBtn.disabled = true;
  setLoading(true);

  try {
    // 1. 准备发送到字体压缩API的数据
    const payload = {
      url: fontUrl,
      text: text,
      charsets: charsetIds, // 使用传入的charsetIds
    };

    console.log("发送到压缩API的数据 (URL参数调用):", payload);

    // 2. 调用字体压缩API
    console.log("开始调用字体压缩API...");
    const response = await fetch("/api/compress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      body: JSON.stringify(payload),
    });

    // 3. 处理API响应
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (jsonError) {
        throw new Error(
          `压缩服务错误: ${response.status} ${response.statusText}`
        );
      }
      throw new Error(
        errorData.error || `压缩服务返回错误: ${response.status}`
      );
    }

    // 4. 获取压缩结果
    const result = await response.json();

    if (result.success && result.downloadUrl) {
      // 5. 显示成功消息和结果模态窗口
      showSuccess("字体已成功压缩！");
      showCompressResult(result.downloadUrl, result.fontName, result.fileSize);

      // 6. 发送postMessage通知父窗口
      if (window.opener || window.parent !== window) {
        const message = {
          type: "font-compressed",
          downloadUrl: result.downloadUrl,
          fontName: result.fontName,
          fileSize: result.fileSize,
        };
        window.opener?.postMessage(JSON.stringify(message), "*");
        if (window.parent !== window) {
          window.parent.postMessage(JSON.stringify(message), "*");
        }
      }
    } else {
      throw new Error("压缩失败，未返回有效的下载URL");
    }
  } catch (error) {
    console.error("远程字体处理过程中出错:", error);
    showError(
      error.message || "处理失败，请检查控制台获取更多信息，或稍后重试"
    );
  } finally {
    submitBtn.disabled = false;
    setLoading(false);
  }
}

/**
 * 显示压缩结果模态窗口
 * @param {string} downloadUrl - 下载链接
 * @param {string} fontName - 字体名称
 * @param {number} fileSize - 文件大小(bytes)
 */
function showCompressResult(downloadUrl, fontName, fileSize) {
  if (resultModal && resultLink) {
    showLinkModal(downloadUrl, fontName, fileSize);
  }
}

/**
 * 处理表单提交
 * @param {Event} e - 提交事件对象
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  showError("");

  if (!fileInput.files[0]) {
    showError("请选择字体文件");
    return;
  }

  const fontFile = fileInput.files[0];
  const textContent = textInput.value;

  if (!isValidFileType(fontFile)) {
    showError("只支持TTF和OTF格式的字体文件");
    return;
  }

  submitBtn.disabled = true;
  setLoading(true);

  try {
    // 1. 上传文件到存储服务
    console.log("开始上传字体文件...");
    const blobUrl = await uploadFileToBlobStore(fontFile);

    // 文件上传成功后，显示消息并准备压缩
    showSuccess("字体文件已成功上传，正在准备压缩...");

    // 确保blobUrl是完整格式，避免URL处理问题
    if (!blobUrl.startsWith("http")) {
      console.error("警告: Blob URL格式异常，缺少http前缀:", blobUrl);
      showError("文件上传返回了无效的URL格式，请联系管理员");
      return;
    }

    console.log("上传成功，获得Blob URL:", blobUrl);

    // 使用字符集模块获取选中的字符集ID
    const selectedCharsetIds = getSelectedCharsets();

    // 2. 准备发送到字体压缩API的数据
    const payload = {
      url: blobUrl,
      text: textContent,
      charsets: selectedCharsetIds, // 添加字符集ID数组
    };

    console.log("发送到压缩API的数据:", payload);
    setLoading(true);
    updateProgress(0, true);

    // 3. 调用压缩API
    console.log("开始调用压缩API...");
    const response = await fetch("/api/compress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      body: JSON.stringify(payload),
    });

    updateProgress(100);

    // 4. 处理API响应
    if (!response.ok) {
      // 如果响应不是OK，尝试解析错误信息
      let errorData;
      try {
        errorData = await response.json();
      } catch (jsonError) {
        // 如果响应体不是有效的JSON，则使用状态文本
        throw new Error(
          `压缩服务错误: ${response.status} ${response.statusText}`
        );
      }
      throw new Error(
        errorData.error || `压缩服务返回错误: ${response.status}`
      );
    }

    // 5. 获取压缩结果
    const result = await response.json();

    if (result.success && result.downloadUrl) {
      // 6. 显示成功消息和下载链接
      const stats = {
        originalSize: (fontFile.size / 1024).toFixed(1),
        compressedSize: (result.fileSize / 1024).toFixed(1),
        ratio: (100 * (1 - result.fileSize / fontFile.size)).toFixed(1),
      };

      showSuccess(
        `字体已成功压缩！原始大小: ${stats.originalSize}KB, 压缩后: ${stats.compressedSize}KB (压缩率: ${stats.ratio}%)`
      );

      // 7. 自动下载文件
      // 当前页面被嵌入时，不自动下载
      if (window.opener || window.parent !== window) {
        downloadFile(
          await (await fetch(result.downloadUrl)).blob(),
          result.fontName
        );
      }

      // 8. 显示结果模态窗口
      showCompressResult(result.downloadUrl, result.fontName, result.fileSize);
    } else {
      throw new Error("压缩失败，未返回有效的下载URL");
    }
  } catch (error) {
    console.error("处理过程中出错:", error);

    // 对于关键错误使用弹窗提示
    const errorMessage =
      error.message || "处理失败，请检查控制台获取更多信息，或稍后重试";

    // 根据错误类型判断是否使用弹窗
    const isImportantError =
      errorMessage.includes("超时") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("failed") ||
      errorMessage.includes("失败") ||
      errorMessage.includes("错误") ||
      errorMessage.includes("error");

    showError(errorMessage, isImportantError);
  } finally {
    submitBtn.disabled = false;
    setLoading(false);
    updateProgress(0, false);
  }
}

/**
 * 处理文件选择变化
 */
function handleFileSelection() {
  if (fileInput.files[0]) {
    const file = fileInput.files[0];

    fileSizeWarning.style.display = "none";

    if (!isValidFileType(file)) {
      showError("只支持TTF和OTF格式的字体文件");
    } else {
      showError("");
    }
  }
}
