/**
 * main.js
 * 字体压缩服务的主入口JavaScript文件
 */

// 导入模块
import { charsets, addCharsetsToText } from './charsets.js';
import { initUI, showError, showSuccess, setLoading, updateProgress, downloadFile, getFilenameFromContentDisposition } from './ui.js';
import { uploadFileToBlobStore, isFileSizeExceeded, isValidFileType } from './upload.js';

// DOM就绪后执行初始化
document.addEventListener('DOMContentLoaded', init);

// 全局变量，用于存储DOM元素引用
let form, fileInput, textInput, submitBtn, fileSizeWarning;

/**
 * 初始化应用
 */
function init() {
    // 初始化UI工具
    initUI();
    
    // 获取DOM元素引用
    form = document.getElementById('compressForm');
    fileInput = document.getElementById('fontFile');
    textInput = document.getElementById('textInput');
    submitBtn = document.getElementById('submitBtn');
    fileSizeWarning = document.getElementById('fileSizeWarning');
    
    // 绑定事件处理程序
    bindEvents();
}

/**
 * 绑定各种事件处理函数
 */
function bindEvents() {
    // 监听表单提交
    form.addEventListener('submit', handleFormSubmit);
    
    // 监听文件选择变化，检查文件大小
    fileInput.addEventListener('change', handleFileSelection);
    
    // 监听字符集添加按钮点击
    document.getElementById('addSelectedChars').addEventListener('click', handleAddSelectedChars);
}

/**
 * 处理表单提交
 * @param {Event} e - 提交事件对象
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // 初始状态重置
    showError('');
    
    // 检查是否选择了文件
    if (!fileInput.files[0]) {
        showError('请选择字体文件');
        return;
    }

    const fontFile = fileInput.files[0];
    const textContent = textInput.value;
    
    // 检查文件类型
    if (!isValidFileType(fontFile)) {
        showError('只支持TTF和OTF格式的字体文件');
        return;
    }
    
    // 禁用提交按钮并显示加载指示器
    submitBtn.disabled = true;
    setLoading(true);

    try {
        // 1. 上传文件到 Blob Store
        const blobUrl = await uploadFileToBlobStore(fontFile);
        
        // 显示阶段性成功消息
        showSuccess('文件已成功上传，正在压缩...');
        
        // 2. 准备发送到字体压缩API的数据
        const payload = {
            blobUrl: blobUrl,
            text: textContent
        };
        
        // 3. 调用压缩API
        const response = await fetch('/api/compress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        // 4. 处理API响应
        if (!response.ok) {
            handleApiError(response);
            return;
        }
        
        // 5. 从响应头获取文件名
        const contentDisposition = response.headers.get('content-disposition');
        const filename = getFilenameFromContentDisposition(contentDisposition);
        
        // 6. 将响应转换为blob并下载
        const blobData = await response.blob();
        downloadFile(blobData, filename);
        
        // 7. 显示成功消息
        const stats = {
            originalSize: (fontFile.size / 1024).toFixed(1),
            compressedSize: (blobData.size / 1024).toFixed(1),
            ratio: (100 * (1 - blobData.size / fontFile.size)).toFixed(1)
        };
        
        showSuccess(`字体已成功压缩并下载！原始大小: ${stats.originalSize}KB, 压缩后: ${stats.compressedSize}KB (压缩率: ${stats.ratio}%)`);

    } catch (error) {
        console.error('Error during compression process:', error);
        showError(error.message || '处理失败，请检查控制台获取更多信息，或稍后重试');
    } finally {
        // 恢复按钮状态并隐藏加载指示器
        submitBtn.disabled = false;
        setLoading(false);
        updateProgress(0, false); // 隐藏进度条
    }
}

/**
 * 处理API错误
 * @param {Response} response - Fetch API响应对象
 */
async function handleApiError(response) {
    try {
        const data = await response.json();
        throw new Error(data.error || `服务器错误: ${response.status}`);
    } catch (e) {
        throw new Error(`服务器错误: ${response.status} ${response.statusText}`);
    }
}

/**
 * 处理文件选择变化
 */
function handleFileSelection() {
    if (fileInput.files[0]) {
        const file = fileInput.files[0];
        
        // 检查文件大小
        if (isFileSizeExceeded(file)) {
            fileSizeWarning.style.display = 'block';
        } else {
            fileSizeWarning.style.display = 'none';
        }
        
        // 检查文件类型
        if (!isValidFileType(file)) {
            showError('只支持TTF和OTF格式的字体文件');
        }
    }
}

/**
 * 处理添加选定字符集
 */
function handleAddSelectedChars() {
    const selectedIds = Array.from(
        document.querySelectorAll('.preset-checkbox:checked')
    ).map(checkbox => checkbox.getAttribute('data-id'));
    
    if (selectedIds.length === 0) return;
    
    const result = addCharsetsToText(textInput.value, selectedIds);
    
    if (result.hasNewChars) {
        textInput.value = result.text;
        textInput.focus();
        
        const addBtn = document.getElementById('addSelectedChars');
        addBtn.textContent = "已添加✓";
        addBtn.disabled = true;
        
        setTimeout(() => {
            addBtn.textContent = "添加所选字符集";
            addBtn.disabled = false;
        }, 1000);
    }
    
    // 取消所有复选框的选中状态
    document.querySelectorAll('.preset-checkbox:checked').forEach(checkbox => {
        checkbox.checked = false;
    });
} 