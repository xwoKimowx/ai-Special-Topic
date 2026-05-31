let currentRole = 'teacher';
let questionBank = [];
let shuffledQuestionBank = [];
let currentQuestionIndex = 0;
let quizStats = { correct: 0, incorrect: 0, total: 0 };
let quizElapsedSecs = 0;          // 本次測驗已花費秒數
let quizTimerInterval = null;     // setInterval handle
let quizTimerPaused = false;      // 是否暫停中
let quizQuestionStartTime = null; // 當前題目開始作答的時間戳（Date.now()）
let quizQuestionPausedMs = 0;     // 當前題目暫停期間的累計毫秒
let answerHistory = [];
let currentSessionAnswers = []; // 當前測驗的答題記錄
let testSessions = []; // 所有測驗session的記錄
let currentSessionStartTime = null; // 當前測驗開始時間
let selectedAnswer = null; // 當前選中的答案
let isAnswerConfirmed = false; // 是否已確認答案

// 試卷管理相關變數
let examPapers = []; // 所有試卷的集合
let currentExamPaperId = null; // 當前正在使用的試卷ID
let examPaperIdCounter = 1; // 試卷ID計數器
let isPaperDeleteMode = false; // 是否在試卷刪除模式
let selectedPapersForDeletion = new Set(); // 選中要刪除的試卷ID
let isPaperMergeMode = false;
let selectedPapersForMerge = new Set();
let isQuestionDeleteMode = false; // 是否在題目刪除模式
let selectedQuestionsForDeletion = new Set(); // 選中要刪除的題目索引
let chatHistory = []; // 對話記憶，儲存最近20句對話
// 每個角色各自的對話記憶與畫面內容
const roleChatHistories = { teacher: [], friend: [], senior: [], assistant: [] };
const roleMessagesHTML = { teacher: '', friend: '', senior: '', assistant: '' };
let questionDiscussions = {}; // 每題的討論記錄 { questionIndex: { history: [], importantMessages: [] } }
let currentQuestionDiscussion = []; // 當前題目的討論歷史（最近10條）
let currentQuestionImportant = []; // 當前題目的重要討論（不會被擠掉）
let discussingQuestionIndex = -1; // 正在討論的題目索引（鎖定，不隨切題變化）
let currentViewingSession = null; // 當前正在查看的測驗session（用於答題記錄討論）
let pendingImages = []; // 等待 AI 辨識的圖片 [{name, dataUrl, type}]
let editingQuestionKey = null; // 'paperId-questionIndex' 格式，表示目前哪題展開編輯
// === 前後端分離架構（v1.71）===
// API Key 已移至後端 server.py，前端不再持有任何金鑰
// 所有 AI 請求統一透過後端 /api/chat 轉發
const _DEFAULT_API_URL = '/api/chat';   // 後端端點（同源，無 CORS 問題）
// 模型測試記錄（150題完整測試）：
// - 'openai/gpt-4o-mini'              // ✅ 150/150題（4-6分鐘）最穩定 👑
// - 'deepseek/deepseek-chat'          // ⚠️ 148/150題（2分鐘）快但漏2題
// - 'anthropic/claude-3.5-haiku'      // ❌ 9/50題 漏題嚴重
// - 'google/gemini-2.0-flash-exp:free' // ❌ 0/150題 完全失敗
const _DEFAULT_AI_MODEL = 'openai/gpt-4o-mini';
const _DEFAULT_MAX_TOKENS = 16000;

// === 執行時使用的變數 ===
let API_KEY = '';       // 後端持有，前端留空
let API_URL = _DEFAULT_API_URL;
let AI_MODEL = _DEFAULT_AI_MODEL;
let MAX_TOKENS = _DEFAULT_MAX_TOKENS;

const roles = {
    teacher: {
        name: '唐三藏',
        avatar: '🧙‍♂️',
        specialty: '文史社會類',
        greeting: '阿彌陀佛，貧僧唐三藏。施主有何疑問，貧僧願以所學相助。歷史、公民與社會、地理皆是貧僧所長，請施主盡情發問。',
        systemPrompt: `你是唐三藏，一位精通歷史、公民與社會、地理的智慧導師。請以慈悲、博學、引經據典的語氣回答問題，偶爾引用史實或典故輔助解釋。
專長科目：歷史、公民與社會、地理、法律常識。
回答原則：
- 從背景脈絡切入，幫助學生理解概念的來龍去脈
- 對於歷史題目，說明時代背景與前因後果
- 對於公民題目，結合實際生活舉例
- 若遇到非專長科目（數理理工、語文表達、生物地科），不要回答題目內容，只用唐三藏的語氣說這題超出你的專長，請學生去找對應的師兄，並在回答結尾加上 [建議切換:角色鍵]，角色鍵規則：數理理工類用 friend、語文表達類用 senior、生物地科類用 assistant
- 務必使用繁體中文（台灣用語）回答，不得使用簡體中文
- 嚴格遵照唐三藏的語氣與個性`
    },
    friend: {
        name: '孫悟空',
        avatar: '🐵',
        specialty: '數理理工類',
        greeting: '嘿！俺老孫來也！數學、物理、化學這些，難不倒俺！有什麼不懂的盡管問，俺老孫火眼金睛，一看就通！😄',
        systemPrompt: `你是孫悟空，一位活潑機智、精通數學、物理、化學的火眼金睛助手。用充滿活力、幽默風趣的語氣解說，善用類比讓抽象概念具體易懂。
專長科目：數學、物理、化學、自然科學計算類題目。
回答原則：
- 遇到計算題，一步步拆解解題步驟，過程清楚明確
- 遇到物理、化學概念，用生活化的比喻幫助理解
- 語氣活潑，但解題過程要嚴謹正確
- 若遇到非專長科目（文史社會、語文表達、生物地科），不要回答題目內容，只用孫悟空的語氣說這題超出你的專長，請學生去找對應的師兄，並在回答結尾加上 [建議切換:角色鍵]，角色鍵規則：文史社會類用 teacher、語文表達類用 senior、生物地科類用 assistant
- 務必使用繁體中文（台灣用語）回答，不得使用簡體中文
- 嚴格遵照孫悟空的語氣與個性`
    },
    senior: {
        name: '沙悟淨',
        avatar: '🌙',
        specialty: '語文表達類',
        greeting: '小弟沙僧在此。國文、英文語文方面，小弟最為熟悉，施主有什麼問題，小弟願意耐心一一解答。',
        systemPrompt: `你是沙悟淨，忠厚踏實、精通語文的可靠夥伴。以穩重、耐心、條理清晰的語氣解說語文題目。
專長科目：國文、英文、語言表達、修辭、作文、閱讀測驗。
回答原則：
- 遇到國文題目，詳細解析文意、語法結構、字詞辨析，並提供相關例句
- 遇到英文題目，說明文法規則並舉例，必要時對照中英文解釋
- 語氣穩重踏實，解說有條不紊
- 若遇到非專長科目（文史社會、數理理工、生物地科），不要回答題目內容，只用沙悟淨的語氣說這題超出你的專長，請學生去找對應的師兄，並在回答結尾加上 [建議切換:角色鍵]，角色鍵規則：文史社會類用 teacher、數理理工類用 friend、生物地科類用 assistant
- 務必使用繁體中文（台灣用語）回答，不得使用簡體中文
- 嚴格遵照沙悟淨的語氣與個性`
    },
    assistant: {
        name: '豬八戒',
        avatar: '🐷',
        specialty: '自然生態類',
        greeting: '呼呼，老豬我對生物、地球科學最在行了！有問題就問，看在你用功的份上，老豬我好好跟你說清楚！',
        systemPrompt: `你是豬八戒，憨厚直率、對生物與地球科學有獨到見解的好老師。用接地氣、生活化的語言解說自然科學。
專長科目：生物、地球科學、生態環境、自然界現象。
回答原則：
- 遇到生物題目，用生活中的動植物實例輔助說明，讓學生印象深刻
- 遇到地球科學題目，結合天文、地質、氣象的實際現象解釋
- 語氣憨厚可愛，但知識內容要正確完整
- 若遇到非專長科目（文史社會、數理理工、語文表達），不要回答題目內容，只用豬八戒的語氣說這題超出你的專長，請學生去找對應的師兄，並在回答結尾加上 [建議切換:角色鍵]，角色鍵規則：文史社會類用 teacher、數理理工類用 friend、語文表達類用 senior
- 務必使用繁體中文（台灣用語）回答，不得使用簡體中文
- 嚴格遵照豬八戒的語氣與個性`
    }
};

// 轉義 HTML 屬性中的特殊字元（防止引號截斷 attribute）
function escapeAttr(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// 轉義 HTML 內容（防止 innerHTML XSS）
function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

document.addEventListener('DOMContentLoaded', function() {
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    initAuth();
    loadSettings();
    loadFromStorage();
    updateStats();
    
    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', function() {
            selectRole(this.dataset.role);
        });
    });
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
    
    document.getElementById('chat-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
    
    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    
    document.getElementById('import-json-input').addEventListener('change', handleJSONImport);
    
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages && chatMessages.children.length === 0) {
        addMessage('ai', roles[currentRole].greeting);
    }

    // 拖曳上傳 & 剪貼簿貼上
    setupUploadDragDrop();

    // 滾動時自動隱藏/顯示頂部元素
    initScrollAutoHide();
});

function selectRole(role) {
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-role="${role}"]`).classList.add('active');

    const display = document.querySelector('.current-role-display');
    display.querySelector('.role-avatar').textContent = roles[role].avatar;
    display.querySelector('.role-name').textContent = roles[role].name;

    // 手機 header 顯示當前角色
    const mobileRoleDisplay = document.getElementById('mobile-role-display');
    if (mobileRoleDisplay) {
        mobileRoleDisplay.textContent = `${roles[role].avatar} ${roles[role].name}`;
    }

    const messagesContainer = document.getElementById('chat-messages');

    // 儲存目前角色的對話狀態
    roleChatHistories[currentRole] = [...chatHistory];
    roleMessagesHTML[currentRole] = messagesContainer.innerHTML;

    currentRole = role;

    // 還原目標角色的對話狀態
    chatHistory = [...roleChatHistories[role]];
    if (roleMessagesHTML[role]) {
        messagesContainer.innerHTML = roleMessagesHTML[role];
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
        messagesContainer.innerHTML = '';
        addMessage('ai', roles[role].greeting);
    }
    saveToStorage();
}

function switchTab(tabName) {
    // 更新頂部 tab（桌面版）
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const tabButton = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (tabButton) tabButton.classList.add('active');

    // 更新底部導覽列（手機版）
    document.querySelectorAll('.mob-tab').forEach(t => t.classList.remove('active'));
    const mobTabButton = document.querySelector(`.mob-tab[data-tab="${tabName}"]`);
    if (mobTabButton) mobTabButton.classList.add('active');

    document.querySelectorAll('.function-content').forEach(c => c.classList.remove('active'));
    const tabContent = document.getElementById(tabName);
    if (tabContent) {
        tabContent.classList.add('active');
    }

    // 切換到題庫檢視時，確保顯示最新內容
    if (tabName === 'display') {
        setTimeout(() => updateQuestionDisplay(), 50);
    }

    // 切換到題目生成時，更新錯題列表
    if (tabName === 'generate') {
        setTimeout(() => updateWrongQuestionsList(), 50);
    }

}

// 有自訂 API Key → 直連；否則走後端 /api/chat proxy
async function fetchWithProxyFallback(url, options) {
    if (API_KEY) {
        return await fetch(url, options);
    }
    // 後端 proxy 模式：移除前端 auth header，由後端負責
    const cleanOptions = { ...options };
    if (cleanOptions.headers) {
        const headers = { ...cleanOptions.headers };
        delete headers['Authorization'];
        delete headers['HTTP-Referer'];
        delete headers['X-Title'];
        cleanOptions.headers = headers;
    }
    return await fetch('/api/chat', cleanOptions);
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    // 訪客限制檢查
    if (!currentUser) {
        if (getGuestRemaining() <= 0) {
            openLoginModal('chat_limit');
            return;
        }
        incrementGuestUsage();
        updateAuthUI();
    }

    addMessage('user', message);
    input.value = '';

    // 將用戶訊息加入對話歷史
    chatHistory.push({ role: 'user', content: message });

    const loading = addMessage('ai', '思考中...');

    try {
        // 準備發送給 API 的訊息列表
        const messages = [
            { role: 'system', content: roles[currentRole].systemPrompt },
            ...chatHistory // 包含最近的對話歷史
        ];

        // 使用新的 fetchWithProxyFallback 函數替代原本的 fetch
        const response = await fetchWithProxyFallback(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: messages,
                max_tokens: 500,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            // 如果還是失敗，嘗試讀取錯誤訊息
            let errorMsg = `API 請求失敗: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.error && errorData.error.message) {
                    errorMsg += ` - ${errorData.error.message}`;
                }
            } catch(e) {}
            throw new Error(errorMsg);
        }
        
        const data = await response.json();
        loading.remove();

        if (data.choices && data.choices[0]) {
            const aiResponse = data.choices[0].message.content;

            // 偵測角色建議標記
            const suggestMatch = aiResponse.match(/\[建議切換:(\w+)\]/);
            const cleanResponse = aiResponse.replace(/\[建議切換:\w+\]\s*/g, '').trim();

            addMessage('ai', cleanResponse);
            if (suggestMatch && roles[suggestMatch[1]] && suggestMatch[1] !== currentRole) {
                showRoleSuggestion(suggestMatch[1]);
            }

            // 將 AI 回覆加入對話歷史
            chatHistory.push({ role: 'assistant', content: cleanResponse });

            // 保留最近20句對話（10輪對話，每輪包含用戶和AI各1句）
            // 只保留最近20條訊息
            if (chatHistory.length > 20) {
                chatHistory = chatHistory.slice(-20);
            }
        } else {
            const errorMsg = '抱歉,回應失敗: ' + (data.error?.message || '未知錯誤');
            addMessage('ai', errorMsg);

            // 移除剛才加入的用戶訊息，因為對話失敗了
            chatHistory.pop();
        }
    } catch (error) {
        loading.remove();
        console.error(error);
        addMessage('ai', '錯誤: ' + error.message + (_apiHint(error.message) || '\n(如果是 Failed to fetch，通常是瀏覽器安全阻擋，已嘗試自動修復)'));

        // 移除剛才加入的用戶訊息，因為對話失敗了
        chatHistory.pop();
    }
}

function showRoleSuggestion(roleKey) {
    const role = roles[roleKey];
    if (!role) return;
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'message ai role-suggestion';
    div.style.cssText = 'background: rgba(102,126,234,0.15); border: 1px solid rgba(102,126,234,0.4); border-radius: 12px; padding: 12px 16px; margin: 8px 0; display: flex; align-items: center; gap: 12px;';
    div.innerHTML = `
        <span style="font-size: 24px;">${role.avatar}</span>
        <div style="flex:1">
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 4px;">這個問題更適合問</div>
            <div style="font-weight: 600; color: #e2e8f0;">${role.name} <span style="font-size: 12px; color: #667eea; background: rgba(102,126,234,0.2); padding: 2px 8px; border-radius: 10px;">${role.specialty}</span></div>
        </div>
        <button onclick="selectRole('${roleKey}')" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 13px; white-space: nowrap;">切換過去</button>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addMessage(sender, content) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    
    if (sender === 'ai') {
        const strong = document.createElement('strong');
        strong.textContent = roles[currentRole].name + ':';
        div.appendChild(strong);
        div.appendChild(document.createTextNode(' ' + content));
    } else {
        div.textContent = content;
    }
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
}

// ========== 圖片上傳功能 ==========

async function handleImageUpload(event) {
    if (!currentUser) { event.target.value = ''; openLoginModal('feature'); return; }
    const files = Array.from(event.target.files);
    event.target.value = '';
    for (const file of files) {
        await addImageToPending(file);
    }
}

function removeImage(index) {
    pendingImages.splice(index, 1);
    updateImagePreviewUI();
}

function clearAllImages() {
    pendingImages = [];
    updateImagePreviewUI();
}

function updateImagePreviewUI() {
    const area = document.getElementById('image-preview-area');
    const list = document.getElementById('image-preview-list');
    const countEl = document.getElementById('image-count');
    if (!area) return;

    if (pendingImages.length === 0) {
        area.style.display = 'none';
        return;
    }
    area.style.display = '';
    if (countEl) countEl.textContent = pendingImages.length;

    list.innerHTML = '';
    pendingImages.forEach((img, i) => {
        const thumb = document.createElement('div');
        thumb.className = 'image-thumb';

        const imgEl = document.createElement('img');
        imgEl.src = img.dataUrl;
        imgEl.alt = img.name;
        imgEl.title = img.name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'image-thumb-remove';
        removeBtn.innerHTML = '✕';
        removeBtn.onclick = (e) => { e.stopPropagation(); removeImage(i); };

        thumb.appendChild(imgEl);
        thumb.appendChild(removeBtn);
        list.appendChild(thumb);
    });
}

async function processTextFile(file) {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const textarea = document.getElementById('raw-text');

    textarea.value = `📄 正在解析 ${fileExtension.toUpperCase()} 檔案...\n請稍候...`;

    try {
        let content = '';

        if (fileExtension === 'txt') {
            content = await readFileAsText(file);
        } else if (fileExtension === 'docx') {
            content = await extractTextFromDOCX(file);
        } else if (fileExtension === 'pdf') {
            content = await extractTextFromPDF(file);
        } else {
            throw new Error('不支援的檔案格式，請上傳 TXT、DOCX 或 PDF');
        }

        if (!content || content.trim().length < 50) {
            throw new Error('無法從檔案中提取到有效內容');
        }

        textarea.value = content;

        setTimeout(() => {
            const aiButton = document.querySelector('button[onclick*="aiProcessQuestions"]');
            if (aiButton) {
                aiButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 150);

        setTimeout(() => {
            showSuccessToast(`✅ ${fileExtension.toUpperCase()} 解析成功！提取了 ${content.length} 個字元，請點擊「AI 智能整理」`);
        }, 400);

    } catch (error) {
        textarea.value = '';
        showErrorToast(`❌ 檔案解析失敗: ${error.message}\n\n建議：直接複製文字內容貼上`);
    }
}

async function handleFileUpload(event) {
    if (!currentUser) { event.target.value = ''; openLoginModal('feature'); return; }
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';

    if (file.size > 10 * 1024 * 1024) {
        showErrorToast('❌ 檔案大小超過 10MB');
        return;
    }

    await processTextFile(file);
}

function setupUploadDragDrop() {
    const uploadSection = document.getElementById('upload');
    if (!uploadSection) return;

    uploadSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadSection.classList.add('drag-over');
    });

    uploadSection.addEventListener('dragleave', (e) => {
        // Only remove if leaving the section entirely
        if (!uploadSection.contains(e.relatedTarget)) {
            uploadSection.classList.remove('drag-over');
        }
    });

    uploadSection.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadSection.classList.remove('drag-over');

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        const textFiles = files.filter(f => !f.type.startsWith('image/'));

        // Add images to pending queue
        if (imageFiles.length > 0) {
            for (const imgFile of imageFiles) {
                await addImageToPending(imgFile);
            }
            showSuccessToast(`✅ 已加入 ${imageFiles.length} 張圖片`);
        }

        // Process first text file
        if (textFiles.length > 0) {
            const textFile = textFiles[0];
            if (textFile.size > 10 * 1024 * 1024) {
                showErrorToast('❌ 檔案大小超過 10MB');
            } else {
                await processTextFile(textFile);
            }
            if (textFiles.length > 1) {
                showInfoToast(`ℹ️ 僅處理第一個文字檔案`);
            }
        }
    });

    // Clipboard paste for images
    document.addEventListener('paste', async (e) => {
        // Only handle paste when on the upload tab
        const activeTab = document.querySelector('.tab.active');
        if (!activeTab || activeTab.dataset.tab !== 'upload') return;

        const items = Array.from(e.clipboardData.items);
        const imageItems = items.filter(item => item.type.startsWith('image/'));
        if (imageItems.length === 0) return;

        e.preventDefault();
        for (const item of imageItems) {
            const file = item.getAsFile();
            if (file) await addImageToPending(file);
        }
        showSuccessToast(`✅ 已貼上 ${imageItems.length} 張圖片`);
    });
}

async function addImageToPending(file) {
    const MAX_IMAGES = 8;
    const MAX_SIZE = 8 * 1024 * 1024;
    if (pendingImages.length >= MAX_IMAGES) {
        showInfoToast(`最多只能上傳 ${MAX_IMAGES} 張圖片`);
        return;
    }
    if (file.size > MAX_SIZE) {
        showErrorToast(`❌ 圖片「${file.name || '圖片'}」超過 8MB，已略過`);
        return;
    }
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            pendingImages.push({
                dataUrl: e.target.result,
                name: file.name || `貼上的圖片_${Date.now()}.png`,
                type: file.type
            });
            updateImagePreviewUI();
            resolve();
        };
        reader.onerror = () => resolve();
        reader.readAsDataURL(file);
    });
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('TXT 檔案讀取失敗'));
        reader.readAsText(file, 'UTF-8');
    });
}

async function extractTextFromDOCX(file) {
    try {
        if (typeof JSZip === 'undefined') {
            throw new Error('DOCX 解析庫未載入,請重新整理頁面');
        }
        
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const documentXML = await zip.file('word/document.xml').async('string');
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(documentXML, 'text/xml');
        
        const paragraphs = xmlDoc.getElementsByTagName('w:p');
        let formattedText = '';
        for (let i = 0; i < paragraphs.length; i++) {
            const pTexts = paragraphs[i].getElementsByTagName('w:t');
            let pText = '';
            for (let j = 0; j < pTexts.length; j++) {
                pText += pTexts[j].textContent;
            }
            if (pText.trim()) {
                formattedText += pText + '\n';
            }
        }
        
        return formattedText;
    } catch (error) {
        throw new Error(`DOCX 解析失敗: ${error.message}`);
    }
}

async function extractTextFromPDF(file) {
    try {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF 解析庫未載入,請重新整理頁面');
        }
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }
        
        return fullText;
    } catch (error) {
        throw new Error(`PDF 解析失敗: ${error.message}`);
    }
}

function clearInput() {
    showConfirmModal('確定要清空輸入內容嗎？', () => {
        document.getElementById('raw-text').value = '';
        clearAllImages();
    }, { title: '清空輸入', okText: '確定清空', okClass: 'btn-primary' });
}

function extractJSONArray(text) {
    try {
        return JSON.parse(text);
    } catch (e) {
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        
        if (start !== -1 && end !== -1 && end > start) {
            const jsonStr = text.substring(start, end + 1);
            try {
                return JSON.parse(jsonStr);
            } catch (e2) {
                console.error('JSON 解析第二次嘗試失敗:', e2);
                return null;
            }
        }
        return null;
    }
}

async function aiProcessQuestions() {
    if (!currentUser) { openLoginModal('feature'); return; }
    // 如果有圖片，優先使用視覺辨識
    if (pendingImages.length > 0) {
        const additionalText = document.getElementById('raw-text').value.trim();
        await aiProcessImagesWithVision(additionalText);
        return;
    }

    const rawText = document.getElementById('raw-text').value.trim();
    if (!rawText) {
        showInfoToast('請先輸入、上傳內容或選擇圖片');
        return;
    }

    // === 新增：檢查內容大小 ===
    const textLength = rawText.length;
    const maxCharsPerBatch = 3000; // Render Free 30秒限制，縮小批次確保在時限內完成
    const estimatedTokens = Math.ceil(textLength / 2); // 粗估 token 數 (中文約 1 字 = 2 tokens)

    console.log(`📊 內容分析: ${textLength} 字元, 預估 ${estimatedTokens} tokens`);

    // 如果內容太大，提示用戶並使用分批處理
    if (textLength > maxCharsPerBatch) {
        const batchCount = Math.ceil(textLength / maxCharsPerBatch);
        const confirmMsg = `⚠️ 內容較大 (${textLength} 字元)\n\n將分成約 ${batchCount} 批次處理 (逐批串行處理)\n需要時間較長\n⚠️ 實際時間可能因網路狀況而有所差異\n\n是否繼續?`;

        showConfirmModal(confirmMsg, async () => {
            await aiProcessQuestionsInBatches(rawText, maxCharsPerBatch);
        }, { title: '批次處理確認', okText: '繼續', okClass: 'btn-primary' });
        return;
    }

    const statusDiv = document.getElementById('processing-status');
    const statusText = document.getElementById('status-text');
    const statusCount = document.getElementById('status-count');
    const progressFill = document.getElementById('progress-fill');

    // 記錄開始時間
    const startTime = Date.now();

    statusDiv.style.display = 'block';
    progressFill.classList.add('progress-pulse');

    // 自動捲動到進度表，讓使用者看到處理進度
    setTimeout(() => {
        statusDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);

    // 根据文字长度计算预估处理时间和进度条速度
    // 基准：4000字元 = 120秒（2分钟）
    const baseChars = 4000;
    const baseTime = 120; // 秒
    const estimatedTimeSeconds = Math.max(30, (textLength / baseChars) * baseTime); // 最少30秒

    console.log(`📊 内容长度: ${textLength} 字元`);
    console.log(`⏱️ 预估处理时间: ${estimatedTimeSeconds.toFixed(1)} 秒`);

    // 0到30%的进度，速度慢10倍（原本1500ms，现在15000ms = 15秒）
    await animateProgress(progressFill, statusText, statusCount, 0, 30, '<span class="loading-spinner"></span>🤖 AI 正在處理...', 15000);

    try {
        let aiProcessingComplete = false;
        let displayProgress = 30; // 实际显示的进度值，持续缓慢增长
        const targetProgress = 85; // 目标进度
        const progressRange = targetProgress - displayProgress; // 需要增长的范围: 55

        // 计算每次更新应该增加多少
        // 进度条从30到85，需要走55个百分点
        // 更新间隔100ms，estimatedTimeSeconds秒内要走完
        const updateIntervalMs = 100;
        const totalUpdates = (estimatedTimeSeconds * 1000) / updateIntervalMs;
        const incrementPerUpdate = progressRange / totalUpdates;

        console.log(`🚀 启动进度条更新`);
        console.log(`📈 每次增加: ${incrementPerUpdate.toFixed(4)}%, 总更新次数: ${totalUpdates.toFixed(0)}`);

        statusText.innerHTML = '<span class="loading-spinner"></span>🤖 AI 正在深度思考中...';

        // 启动进度条更新循环
        const progressInterval = setInterval(() => {
            if (aiProcessingComplete) {
                console.log('⏹️ 停止进度条更新');
                clearInterval(progressInterval);
                return;
            }

            // 缓慢增长，速度根据文字长度自适应
            if (displayProgress < targetProgress) {
                // 添加微小的随机变化，让进度更自然 (±20%)
                const randomFactor = 0.8 + Math.random() * 0.4;
                displayProgress += incrementPerUpdate * randomFactor;

                if (displayProgress > targetProgress) {
                    displayProgress = targetProgress;
                }

                progressFill.style.width = displayProgress + '%';
                statusCount.textContent = `${Math.round(displayProgress)}%`;
            }
        }, updateIntervalMs);

        const maxWaitTime = 90000;

        // 優化的 API 請求 - 使用更快的模型和簡化的 prompt
        const fetchPromise = fetchWithProxyFallback(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://ai-tutor.app',
                'X-Title': 'AI Tutor'
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: [{
                    role: 'system',
                    content: '你是專業題庫整理助手。請仔細提取文字中的每一道單選題，確保不遺漏任何題目。只輸出JSON陣列，不要有任何其他文字或說明。'
                }, {
                    role: 'user',
                    content: `請仔細提取以下文字中的**所有**單選題（必須有4個選項），整理成JSON格式。

**重要：只提取真正的題目，不要提取範例、說明或不完整的內容！**

JSON格式範例:
[{"題號":1,"題目":"問題內容","選項":{"A":"選項A","B":"選項B","C":"選項C","D":"選項D"},"答案":"A","詳解":"解析內容","難度":"medium","AI提供答案":false}]

提取規則:
1. **必須包含題號** - 提取原始題號（如 1, 2, 3...）
2. 題目必須是完整的問句
3. **必須有完整的4個選項**，且每個選項都有實質內容（不是空白或"無"）
4. 選項格式：接受 A/B/C/D 或 (A)/(B)/(C)/(D) 或 ①②③④ 或 (1)(2)(3)(4)
5. 答案處理規則：
   - 如果題目有附帶答案，請提取原始答案，並設置 "AI提供答案":false
   - 如果題目**沒有附帶答案**，請仔細分析題目內容與所有選項，依據邏輯、常識與專業知識判斷最恰當的答案，並設置 "AI提供答案":true
   - 答案必須明確是 A、B、C 或 D 其中之一
6. 詳解若無則留空字串
6.5. 難度標記：根據題目複雜程度設置 "難度" 欄位，值為 "easy"（基礎記憶型）、"medium"（理解應用型）、"hard"（分析推論型）
7. **不要提取範例題、說明文字、或格式不完整的內容**

**特別注意：對於沒有提供答案的題目，你必須認真分析並給出最合理的答案，這對學習者非常重要！**

原始文字:
${rawText}`
                }],
                max_tokens: MAX_TOKENS,
                temperature: 0
            })
        });

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('請求超時，請檢查網路連線或稍後再試'));
            }, maxWaitTime);
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);

        // 不要立即停止进度条，让它继续增长
        // aiProcessingComplete = true;
        // if (progressInterval) clearInterval(progressInterval);

        if (!response.ok) {
            aiProcessingComplete = true;
            clearInterval(progressInterval);
            throw new Error(`API 請求錯誤: ${response.status}`);
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0]) {
            aiProcessingComplete = true;
            clearInterval(progressInterval);
            throw new Error('API 回應格式錯誤');
        }

        // API成功返回，停止进度条并继续后续动画
        aiProcessingComplete = true;
        clearInterval(progressInterval);

        await animateProgress(progressFill, statusText, statusCount, displayProgress, 90, '<span class="loading-spinner"></span>📊 解析中...', 300);

        let content = data.choices[0].message.content.trim();
        let parsedQuestions = extractJSONArray(content);

        if (!parsedQuestions) {
            content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            parsedQuestions = extractJSONArray(content);
        }

        if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
            console.log('API Raw Response:', content);
            throw new Error('未找到有效的單選題 (格式解析失敗)');
        }

        await animateProgress(progressFill, statusText, statusCount, 90, 95, '<span class="loading-spinner"></span>✅ 驗證格式...', 200);

        questionBank = parsedQuestions
            .filter(q => q.題目 && q.選項 && Object.keys(q.選項).length >= 4 &&
                         q.答案 && ['A', 'B', 'C', 'D'].includes(q.答案?.toUpperCase?.()))
            .map(normalizeQuestion);

        await animateProgress(progressFill, statusText, statusCount, 95, 100, '🎉 完成!', 2000);

        statusCount.textContent = `成功整理 ${questionBank.length} 題`;
        progressFill.classList.remove('progress-pulse');

        saveToStorage();
        // updateQuestionDisplay(); // 移到 saveExamPaper() 中調用，避免重複
        updateStats();

        // 計算總花費時間
        const endTime = Date.now();
        const totalSeconds = Math.round((endTime - startTime) / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const timeDisplay = minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;

        setTimeout(() => {
            statusDiv.style.display = 'none';
            progressFill.style.width = '0%';
        }, 1000);

        // 彈出儲存試卷 Modal
        const saveResult = await showSaveExamModal(questionBank.length, timeDisplay, null);
        if (!saveResult) return; // 使用者取消

        let examName;
        if (saveResult.mode === 'new') {
            examName = saveResult.name;
            saveExamPaper(questionBank, examName);
        } else {
            const paper = examPapers.find(p => p.id === saveResult.paperId);
            examName = paper ? paper.name : '試卷';
            addToExamPaper(saveResult.paperId, questionBank);
        }

        // 立即切換到題庫檢視
        switchTab('display');
        setTimeout(() => updateQuestionDisplay(), 50);

        // 顯示成功提示（非阻塞）
        showSuccessToast(`✅ 試卷「${examName}」已儲存！`);

    } catch (error) {
        aiProcessingComplete = true;
        if (progressInterval) clearInterval(progressInterval);

        console.error('AI 處理錯誤:', error);
        progressFill.classList.remove('progress-pulse');
        statusDiv.style.display = 'none';
        progressFill.style.width = '0%';
        showErrorToast('❌ AI 整理失敗:\n' + error.message + (_apiHint(error.message) || '\n\n請檢查 API Key 是否正確，或稍後再試。'));
    }
}

// ========== 圖片視覺辨識處理 ==========
async function aiProcessImagesWithVision(additionalText = '') {
    const statusDiv = document.getElementById('processing-status');
    const statusText = document.getElementById('status-text');
    const statusCount = document.getElementById('status-count');
    const progressFill = document.getElementById('progress-fill');
    const startTime = Date.now();

    statusDiv.style.display = 'block';
    progressFill.classList.add('progress-pulse');
    setTimeout(() => statusDiv.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);

    await animateProgress(progressFill, statusText, statusCount, 0, 20,
        '<span class="loading-spinner"></span>🖼️ 正在上傳圖片...', 2000);

    try {
        // 建立 Vision 訊息內容
        const userContent = [
            {
                type: 'text',
                text: `請仔細辨識以下圖片中的所有單選題，整理成JSON格式。
${additionalText ? `\n補充說明：${additionalText}\n` : ''}
JSON格式：[{"題號":1,"題目":"問題內容","選項":{"A":"選項A","B":"選項B","C":"選項C","D":"選項D"},"答案":"A","詳解":"解析內容","難度":"medium","AI提供答案":true或false}]

提取規則：
1. 必須包含題號（提取原始題號）
2. 題目必須是完整的問句
3. 必須有完整的4個選項（A/B/C/D）
4. 答案處理規則（極重要）：
   - 如果圖片中題目旁邊有附帶答案（例如「答案：A」、「ans: B」），請提取原始答案，並設置 "AI提供答案":false
   - 如果圖片中題目沒有附帶答案，請依據知識分析給出最合理答案，並設置 "AI提供答案":true
   - "AI提供答案" 必須根據上述規則判斷，絕不能全部設為 false
5. 詳解若無則留空字串
5.5. 難度標記：根據題目複雜程度設置 "難度" 欄位，值為 "easy"（基礎記憶型）、"medium"（理解應用型）、"hard"（分析推論型）
6. 只提取真正的題目，不提取說明文字或範例
7. 只輸出 JSON 陣列，不要任何其他文字`
            },
            ...pendingImages.map(img => ({
                type: 'image_url',
                image_url: { url: img.dataUrl }
            }))
        ];

        let displayProgress = 20;
        const targetProgress = 85;
        const estimatedSeconds = 20 + pendingImages.length * 15;
        const incrementPerUpdate = (targetProgress - displayProgress) / (estimatedSeconds * 10);

        statusText.innerHTML = `<span class="loading-spinner"></span>🖼️ AI 正在辨識 ${pendingImages.length} 張圖片...`;

        const progressInterval = setInterval(() => {
            if (displayProgress < targetProgress) {
                displayProgress = Math.min(targetProgress,
                    displayProgress + incrementPerUpdate * (0.8 + Math.random() * 0.4));
                progressFill.style.width = displayProgress + '%';
                statusCount.textContent = Math.round(displayProgress) + '%';
            }
        }, 100);

        const fetchPromise = fetchWithProxyFallback(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://ai-tutor.app',
                'X-Title': 'AI Tutor'
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: '你是專業題庫整理助手。請仔細辨識圖片中的每一道單選題，確保不遺漏任何題目。只輸出JSON陣列，不要有任何其他文字或說明。'
                    },
                    { role: 'user', content: userContent }
                ],
                max_tokens: MAX_TOKENS,
                temperature: 0
            })
        });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('請求超時，請稍後再試')), 120000)
        );

        const response = await Promise.race([fetchPromise, timeoutPromise]);
        clearInterval(progressInterval);

        if (!response.ok) throw new Error(`API 請求錯誤: ${response.status}`);

        const data = await response.json();
        if (!data.choices?.[0]) throw new Error('API 回應格式錯誤');

        const parsed = extractJSONArray(data.choices[0].message.content);
        if (!parsed || parsed.length === 0)
            throw new Error('無法從圖片中辨識到有效的題目\n請確認圖片清晰且包含單選題');

        const validQuestions = parsed
            .filter(q => q.題目 && q.選項?.A && q.選項?.B && q.選項?.C && q.選項?.D && q.答案)
            .map(normalizeQuestion);
        if (validQuestions.length === 0)
            throw new Error('辨識到的題目格式不完整\n請確認圖片包含標準的四選項單選題');

        questionBank = validQuestions;

        await animateProgress(progressFill, statusText, statusCount, displayProgress, 100, '✅ 辨識完成！', 500);

        const totalSeconds = Math.round((Date.now() - startTime) / 1000);
        const timeDisplay = totalSeconds >= 60
            ? `${Math.floor(totalSeconds / 60)} 分 ${totalSeconds % 60} 秒`
            : `${totalSeconds} 秒`;

        setTimeout(() => {
            statusDiv.style.display = 'none';
            progressFill.style.width = '0%';
        }, 1000);

        // 辨識成功後清除圖片
        clearAllImages();

        const saveResult = await showSaveExamModal(questionBank.length, timeDisplay, null);
        if (!saveResult) return;

        let examName;
        if (saveResult.mode === 'new') {
            examName = saveResult.name;
            saveExamPaper(questionBank, examName);
        } else {
            const paper = examPapers.find(p => p.id === saveResult.paperId);
            examName = paper ? paper.name : '試卷';
            addToExamPaper(saveResult.paperId, questionBank);
        }

        switchTab('display');
        setTimeout(() => updateQuestionDisplay(), 50);
        showSuccessToast(`✅ 試卷「${examName}」已儲存！`);

    } catch (error) {
        progressFill.classList.remove('progress-pulse');
        progressFill.style.width = '0%';
        statusDiv.style.display = 'none';
        showErrorToast('❌ 圖片辨識失敗:\n' + error.message);
    }
}

// === 新增：分批處理大內容的函數 ===
async function aiProcessQuestionsInBatches(rawText, maxCharsPerBatch) {
    const statusDiv = document.getElementById('processing-status');
    const statusText = document.getElementById('status-text');
    const statusCount = document.getElementById('status-count');
    const progressFill = document.getElementById('progress-fill');

    // 記錄開始時間
    const startTime = Date.now();

    statusDiv.style.display = 'block';
    progressFill.classList.add('progress-pulse');

    // 自動捲動到進度表，讓使用者看到處理進度
    setTimeout(() => {
        statusDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);

    try {
        // 智能分割文字 (嘗試在題目邊界分割)
        const batches = splitTextIntoBatches(rawText, maxCharsPerBatch);
        const totalBatches = batches.length;

        console.log(`📦 分成 ${totalBatches} 批次處理 (逐批串行處理)`);

        let allQuestions = [];
        const CONCURRENT_BATCHES = 1; // Render Free 單一 worker，串行避免超時

        // 用於平滑進度更新
        let currentBatchProgress = 0;

        // 並行處理批次
        for (let i = 0; i < totalBatches; i += CONCURRENT_BATCHES) {
            const targetBatchProgress = Math.round((i / totalBatches) * 100);
            const endIdx = Math.min(i + CONCURRENT_BATCHES, totalBatches);

            statusText.innerHTML = `<span class="loading-spinner"></span>🤖 並行處理第 ${i + 1}-${endIdx}/${totalBatches} 批...`;

            // 使用平滑動畫更新進度
            await animateProgress(progressFill, null, statusCount, currentBatchProgress, targetBatchProgress, '', 300);
            currentBatchProgress = targetBatchProgress;

            // 建立並行處理的 Promise 陣列
            const batchPromises = [];
            for (let j = i; j < endIdx; j++) {
                const batchText = batches[j];
                console.log(`📝 批次 ${j + 1}: ${batchText.length} 字元`);
                // 包裝 promise 以處理個別錯誤
                batchPromises.push(
                    processSingleBatch(batchText, j + 1, totalBatches)
                        .catch(err => {
                            console.error(`❌ 批次 ${j + 1} 失敗:`, err.message);
                            return []; // 失敗時返回空陣列，繼續處理其他批次
                        })
                );
            }

            // 等待這組批次全部完成
            const results = await Promise.all(batchPromises);

            // 合併結果
            results.forEach((batchQuestions, idx) => {
                if (batchQuestions && batchQuestions.length > 0) {
                    allQuestions = allQuestions.concat(batchQuestions);
                    console.log(`✅ 批次 ${i + idx + 1} 完成: 提取 ${batchQuestions.length} 題`);
                }
            });

            // 避免 API 限流，批次組之間等待較短時間
            if (endIdx < totalBatches) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // 合併結果並去重（因為批次有重疊）
        console.log(`📊 合併前總數: ${allQuestions.length} 題`);

        // 優先使用題號去重，其次使用題目內容
        const uniqueQuestions = [];
        const seenQuestionNumbers = new Set();
        const seenQuestionTexts = new Set();

        for (const q of allQuestions) {
            let isDuplicate = false;
            let duplicateReason = '';

            // 優先使用題號判斷（如果有題號）
            if (q.題號) {
                if (seenQuestionNumbers.has(q.題號)) {
                    isDuplicate = true;
                    duplicateReason = `題號 ${q.題號} 重複`;
                } else {
                    seenQuestionNumbers.add(q.題號);
                    // 有題號的題目，不再用內容判斷（避免誤判）
                }
            } else {
                // 沒有題號的題目，才用題目內容判斷
                const questionKey = q.題目.substring(0, 100).trim();
                if (seenQuestionTexts.has(questionKey)) {
                    isDuplicate = true;
                    duplicateReason = `題目內容重複: ${q.題目.substring(0, 30)}...`;
                } else {
                    seenQuestionTexts.add(questionKey);
                }
            }

            if (isDuplicate) {
                console.log(`🔄 ${duplicateReason}`);
            } else {
                uniqueQuestions.push(q);
            }
        }

        questionBank = uniqueQuestions;
        console.log(`✅ 去重後總數: ${questionBank.length} 題 (移除 ${allQuestions.length - uniqueQuestions.length} 題重複)`);

        // 如果題號連續，顯示題號範圍並找出缺失的題號
        const questionNumbers = questionBank.filter(q => q.題號).map(q => q.題號).sort((a, b) => a - b);
        if (questionNumbers.length > 0) {
            const minNum = questionNumbers[0];
            const maxNum = questionNumbers[questionNumbers.length - 1];
            console.log(`📋 題號範圍: ${minNum} - ${maxNum} (共 ${questionNumbers.length} 題)`);

            // 找出缺失的題號
            const missingNumbers = [];
            for (let i = minNum; i <= maxNum; i++) {
                if (!questionNumbers.includes(i)) {
                    missingNumbers.push(i);
                }
            }

            if (missingNumbers.length > 0) {
                console.error(`❌ 遺失的題號: ${missingNumbers.join(', ')} (共 ${missingNumbers.length} 題)`);
                console.log(`💡 提示: 這些題目可能在過濾階段被移除，請檢查上方的過濾警告訊息`);
            } else {
                console.log(`✅ 題號完整，無遺漏！`);
            }
        }

        // 使用平滑動畫完成進度
        await animateProgress(progressFill, statusText, statusCount, currentBatchProgress, 100, '🎉 所有批次處理完成!', 300);
        statusCount.textContent = `成功整理 ${questionBank.length} 題`;
        progressFill.classList.remove('progress-pulse');

        // 計算總花費時間
        const endTime = Date.now();
        const totalSeconds = Math.round((endTime - startTime) / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const timeDisplay = minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;

        saveToStorage();
        // updateQuestionDisplay(); // 移到 saveExamPaper() 中調用，避免重複
        updateStats();

        setTimeout(() => {
            statusDiv.style.display = 'none';
            progressFill.style.width = '0%';
        }, 2000);

        // 彈出儲存試卷 Modal
        const saveResult = await showSaveExamModal(questionBank.length, timeDisplay, totalBatches);
        if (!saveResult) return; // 使用者取消

        let examName;
        if (saveResult.mode === 'new') {
            examName = saveResult.name;
            saveExamPaper(questionBank, examName);
        } else {
            const paper = examPapers.find(p => p.id === saveResult.paperId);
            examName = paper ? paper.name : '試卷';
            addToExamPaper(saveResult.paperId, questionBank);
        }

        // 立即切換到題庫檢視
        switchTab('display');
        setTimeout(() => updateQuestionDisplay(), 50);

        // 顯示成功提示（非阻塞）
        showSuccessToast(`✅ 試卷「${examName}」已儲存！`);

    } catch (error) {
        console.error('分批處理錯誤:', error);
        progressFill.classList.remove('progress-pulse');
        statusDiv.style.display = 'none';
        progressFill.style.width = '0%';
        showErrorToast('❌ 分批處理失敗:\n' + error.message);
    }
}

// === 新增：智能分割文字（帶重疊避免漏題）===
function splitTextIntoBatches(text, maxChars) {
    const batches = [];
    let currentPos = 0;
    const overlapChars = 800; // 重疊 800 字元以確保不切斷題目

    while (currentPos < text.length) {
        let endPos = currentPos + maxChars;

        // 如果不是最後一批，嘗試在題目邊界分割
        if (endPos < text.length) {
            // 尋找最近的換行符或題號
            const searchRange = text.substring(endPos - 500, Math.min(endPos + 500, text.length));
            const questionMarkers = ['\n\n', '\n1.', '\n2.', '\n3.', '\n4.', '\n5.', '\n6.', '\n7.', '\n8.', '\n9.', '\n10.', '\n一、', '\n二、', '\n三、'];

            let bestSplitPos = endPos;
            let bestDistance = Infinity;

            for (const marker of questionMarkers) {
                const markerPos = searchRange.lastIndexOf(marker);
                if (markerPos !== -1) {
                    const actualPos = endPos - 500 + markerPos;
                    const distance = Math.abs(actualPos - endPos);
                    if (distance < bestDistance && actualPos > currentPos + 1000) { // 確保批次有足夠內容
                        bestDistance = distance;
                        bestSplitPos = actualPos;
                    }
                }
            }

            endPos = bestSplitPos;
        } else {
            endPos = text.length;
        }

        batches.push(text.substring(currentPos, endPos).trim());

        // 下一批次從較早的位置開始（重疊），避免邊界漏題
        currentPos = Math.max(currentPos + 1000, endPos - overlapChars);
    }

    return batches;
}

// === 新增：處理單一批次 ===
async function processSingleBatch(batchText, batchNum, totalBatches) {
    console.log(`🚀 開始處理批次 ${batchNum}/${totalBatches}`);
    const maxWaitTime = 120000; // 增加到 120 秒

    const fetchPromise = fetchWithProxyFallback(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ai-tutor.app',
            'X-Title': 'AI Tutor'
        },
        body: JSON.stringify({
            model: AI_MODEL,
            messages: [{
                role: 'system',
                content: '你是專業題庫整理助手。請仔細提取文字中的每一道單選題，確保不遺漏任何題目。只輸出JSON陣列，不要有任何其他文字或說明。'
            }, {
                role: 'user',
                content: `請仔細提取以下文字中的**所有**單選題（必須有4個選項），整理成JSON格式。

**重要：只提取真正的題目，不要提取範例、說明或不完整的內容！**

JSON格式範例:
[{"題號":1,"題目":"問題內容","選項":{"A":"選項A","B":"選項B","C":"選項C","D":"選項D"},"答案":"A","詳解":"解析內容","難度":"medium","AI提供答案":false}]

提取規則:
1. **必須包含題號** - 提取原始題號（如 1, 2, 3...）
2. 題目必須是完整的問句
3. **必須有完整的4個選項**，且每個選項都有實質內容（不是空白或"無"）
4. 選項格式：接受 A/B/C/D 或 (A)/(B)/(C)/(D) 或 ①②③④ 或 (1)(2)(3)(4)
5. 答案處理規則：
   - 如果題目有附帶答案，請提取原始答案，並設置 "AI提供答案":false
   - 如果題目**沒有附帶答案**，請仔細分析題目內容與所有選項，依據邏輯、常識與專業知識判斷最恰當的答案，並設置 "AI提供答案":true
   - 答案必須明確是 A、B、C 或 D 其中之一
6. 詳解若無則留空字串
6.5. 難度標記：根據題目複雜程度設置 "難度" 欄位，值為 "easy"（基礎記憶型）、"medium"（理解應用型）、"hard"（分析推論型）
7. **不要提取範例題、說明文字、或格式不完整的內容**

**特別注意：對於沒有提供答案的題目，你必須認真分析並給出最合理的答案，這對學習者非常重要！**

**批次 ${batchNum}/${totalBatches} - 請提取此批次中的所有題目：**

${batchText}`
            }],
            max_tokens: MAX_TOKENS,
            temperature: 0
        })
    });

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`批次 ${batchNum} 請求超時`));
        }, maxWaitTime);
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ 批次 ${batchNum} 錯誤:`, response.status, errorText);
        throw new Error(`批次 ${batchNum} API 請求錯誤: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✓ 批次 ${batchNum} API 回應成功`);

    if (!data.choices || !data.choices[0]) {
        throw new Error(`批次 ${batchNum} API 回應格式錯誤`);
    }

    let content = data.choices[0].message.content.trim();
    let parsedQuestions = extractJSONArray(content);

    if (!parsedQuestions) {
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsedQuestions = extractJSONArray(content);
    }

    if (!Array.isArray(parsedQuestions)) {
        console.warn(`批次 ${batchNum} 未找到有效題目`);
        return [];
    }

    // 過濾和格式化 - 加強驗證
    const validQuestions = [];
    const filteredQuestions = [];

    for (const q of parsedQuestions) {
        let filterReason = null;

        // 基本驗證
        if (!q.題目 || !q.選項 || !q.答案) {
            filterReason = '缺少必要欄位';
        }
        // 驗證答案格式
        else if (!['A', 'B', 'C', 'D'].includes(q.答案)) {
            filterReason = '答案格式錯誤';
        }
        // 驗證題目長度（至少2個字，允許簡短題目）
        else if (q.題目.trim().length < 2) {
            filterReason = '題目太短';
        }
        // 驗證選項完整性
        else {
            const hasAllOptions = ['A', 'B', 'C', 'D'].every(key => {
                const option = q.選項[key];
                // 選項必須存在且有內容（至少1個字，允許數字選項如 "1", "2"）
                return option && typeof option === 'string' && option.trim().length >= 1;
            });

            if (!hasAllOptions) {
                filterReason = '選項不完整';
            }
        }

        if (filterReason) {
            const questionInfo = {
                題號: q.題號 || '未知',
                題目: q.題目?.substring(0, 30) || '無',
                原因: filterReason
            };
            filteredQuestions.push(questionInfo);
            console.warn(`⚠️ 批次 ${batchNum} - 題號 ${questionInfo.題號} 被過濾（${filterReason}）: ${questionInfo.題目}...`);
        } else {
            validQuestions.push(q);
        }
    }

    // 如果有題目被過濾，顯示摘要
    if (filteredQuestions.length > 0) {
        console.log(`📊 批次 ${batchNum} 過濾摘要: ${filteredQuestions.length} 題被過濾`);
    }

    return validQuestions.map(normalizeQuestion);
}

// 統一題目欄位標準化
// AI提供答案 的判斷邏輯：只有明確設為 false 才視為「非AI答案」
// 欄位缺漏(undefined/null) 時預設為 true，避免 AI 忘記標記卻顯示成原始答案
function normalizeQuestion(q) {
    return {
        題號: q.題號 || null,
        題目: q.題目.trim(),
        選項: {
            A: q.選項?.A?.trim() || '',
            B: q.選項?.B?.trim() || '',
            C: q.選項?.C?.trim() || '',
            D: q.選項?.D?.trim() || ''
        },
        答案: (q.答案 || q.正確答案)?.toUpperCase() || '',
        詳解: q.詳解?.trim() || '',
        AI提供答案: q.AI提供答案 !== false && q.AI提供答案 !== 'false',
        難度: ['easy','medium','hard'].includes(q.難度) ? q.難度 : ''
    };
}

function animateProgress(progressFill, statusText, statusCount, start, end, message, duration) {
    return new Promise(resolve => {
        if (statusText && message) {
            // 如果消息包含 loading spinner，使用 innerHTML
            if (message.includes('loading-spinner')) {
                statusText.innerHTML = message;
            } else {
                statusText.textContent = message;
            }
        }

        const startTime = performance.now();
        const updateProgress = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const easedProgress = easeInOutCubic(progress);
            const currentWidth = start + (end - start) * easedProgress;

            progressFill.style.width = currentWidth + '%';

            const currentCount = Math.round(currentWidth);
            statusCount.textContent = `${currentCount}%`;

            if (progress < 1) {
                requestAnimationFrame(updateProgress);
            } else {
                resolve();
            }
        };

        requestAnimationFrame(updateProgress);
    });
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function updateQuestionDisplay() {
    const display = document.getElementById('question-display');

    if (!display) {
        return;
    }

    // 顯示搜尋列與刪除試卷按鈕
    const searchArea = document.getElementById('paper-search-area');
    if (searchArea) searchArea.style.display = 'flex';
    const deletePaperBtn = document.getElementById('delete-paper-btn');
    if (deletePaperBtn) deletePaperBtn.style.display = '';
    const mergePaperBtn = document.getElementById('merge-paper-btn');
    if (mergePaperBtn) mergePaperBtn.style.display = '';

    // 檢查是否有試卷
    if (examPapers.length === 0) {
        display.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ffffff;">
                <div style="font-size: 48px; margin-bottom: 20px;">📚</div>
                <p>尚無試卷</p>
                <p style="font-size: 14px; color: #ffffff; margin-top: 10px;">使用「AI 智能整理」功能創建第一份試卷</p>
            </div>
        `;
        return;
    }

    // 顯示試卷列表
    let html = '';

    // 如果在合併模式，顯示控制按鈕
    if (isPaperMergeMode) {
        html += `<div style="display:flex; gap:8px; align-items:center; padding:10px 14px; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.3); border-radius:10px; margin-bottom:12px; flex-wrap:wrap;">
            <span style="color:#a5b4fc; font-weight:600;">🔗 合併模式：已選 ${selectedPapersForMerge.size} / ${examPapers.length} 份</span>
            <button class="btn btn-primary" onclick="confirmMergeSelectedPapers()" style="width:auto; padding:6px 16px; margin:0;">✅ 確認合併</button>
            <button class="btn btn-secondary" onclick="togglePaperMergeMode()" style="width:auto; padding:6px 16px; margin:0;">✖ 取消</button>
        </div>`;
    }

    // 如果在刪除模式，顯示控制按鈕
    if (isPaperDeleteMode) {
        html += `
            <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                <button class="btn btn-secondary" onclick="togglePaperSelectAll()" style="width: auto; padding: 8px 20px;">
                    ${selectedPapersForDeletion.size === examPapers.length ? '✓ 全不選' : '☐ 全選'}
                </button>
                <button class="btn btn-secondary" onclick="cancelPaperDeleteMode()" style="width: auto; padding: 8px 20px;">
                    ✕ 取消
                </button>
                <div style="flex: 1; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 14px;">
                    已選擇 ${selectedPapersForDeletion.size} 份試卷
                </div>
            </div>
        `;
    }

    html += '<div style="display: flex; flex-direction: column; gap: 15px;">';

    examPapers.forEach((paper) => {
        const isSelected = selectedPapersForDeletion.has(paper.id);
        const createdDate = new Date(paper.createdTime).toLocaleString('zh-TW');
        const lastTestDate = paper.lastTestTime ? new Date(paper.lastTestTime).toLocaleString('zh-TW') : '尚未測驗';

        let statusColor, statusBg, statusText;

        if (paper.testCount === 0) {
            // 未測驗：從未測驗過
            statusColor = '#3f4b5b';
            statusBg = 'rgba(63, 75, 91, 0.2)';
            statusText = '未測驗';
        } else if (paper.lastQuestionIndex > 0 && paper.lastQuestionIndex < paper.questions.length) {
            // 測驗中：有進度但未完成
            statusColor = '#c2661f';
            statusBg = 'rgba(194, 102, 31, 0.2)';
            statusText = '測驗中';
        } else {
            // 已測驗過：顯示測驗次數（綠色）
            statusColor = '#0f5a3d';
            statusBg = 'rgba(15, 90, 61, 0.2)';
            statusText = `測驗 ${paper.testCount} 次`;
        }

        html += `
            <div class="question-item" style="cursor: pointer; transition: all 0.3s ease; border-left: 4px solid ${statusColor}; ${isSelected ? 'background: rgba(229, 62, 62, 0.15); border: 2px solid #e53e3e;' : ''}${isPaperMergeMode && selectedPapersForMerge.has(paper.id) ? 'border:2px solid #6366f1;' : ''}"
                onclick="${isPaperMergeMode ? `togglePaperForMerge(${paper.id}, event)` : isPaperDeleteMode ? `togglePaperSelection(${paper.id}, event)` : `loadExamPaperAndShowDetail(${paper.id})`}"
                oncontextmenu="showPaperContextMenu(${paper.id}, event)"
                ontouchstart="paperLongPressStart(${paper.id}, event)"
                ontouchend="paperLongPressEnd(event)"
                ontouchmove="paperLongPressEnd(event)">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                            ${isPaperDeleteMode ? `<input type="checkbox" ${isSelected ? 'checked' : ''} onclick="togglePaperSelection(${paper.id}, event)" style="width: 20px; height: 20px; cursor: pointer;">` : ''}
                            ${isPaperMergeMode ? `<input type="checkbox" ${selectedPapersForMerge.has(paper.id) ? 'checked' : ''} onclick="togglePaperForMerge(${paper.id}, event)" style="width: 20px; height: 20px; cursor: pointer; accent-color: #6366f1;">` : ''}
                            <span style="font-size: 20px;">📄</span>
                            <span style="font-weight: 700; color: #ffffff; font-size: 16px;">${paper.name}</span>
                        </div>
                        <div style="font-size: 13px; color: #ffffff; ${isPaperDeleteMode || isPaperMergeMode ? 'margin-left: 30px;' : ''}">
                            🕐 創建時間: ${createdDate}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="background: ${statusBg}; padding: 8px 16px; border-radius: 10px; border: 2px solid ${statusColor};">
                            <div style="font-size: 14px; font-weight: 700; color: ${statusColor};">${statusText}</div>
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 15px;">
                    <div style="padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; text-align: center;">
                        <div style="font-size: 12px; color: #ffffff;">題目數</div>
                        <div style="font-size: 18px; font-weight: 600; color: #ffffff;">${paper.questions.length}</div>
                    </div>
                    <div style="padding: 8px; background: rgba(102, 126, 234, 0.15); border-radius: 8px; text-align: center;">
                        <div style="font-size: 12px; color: #ffffff;">測驗次數</div>
                        <div style="font-size: 18px; font-weight: 600; color: #4c5fd5;">${paper.testCount}</div>
                    </div>
                </div>

                <div style="margin-top: 10px; padding: 8px 12px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; font-size: 13px; color: #ffffff;">
                    📅 上次測驗: ${lastTestDate}
                    ${paper.testCount > 0 && !paper.isCompleted ? `<br>📝 進度: 第 ${paper.lastQuestionIndex + 1} / ${paper.questions.length} 題` : ''}
                </div>

                ${!isPaperDeleteMode && !isPaperMergeMode ? `
                    <div style="margin-top: 12px; text-align: center; color: #ffffff; font-size: 13px;">
                        點擊查看題目詳情 →
                    </div>
                ` : ''}
            </div>
        `;
    });

    html += '</div>';
    display.innerHTML = html;
}

function exportQuestionBank() {
    if (questionBank.length === 0) {
        showInfoToast('沒有題庫可匯出');
        return;
    }
    
    const dataStr = JSON.stringify(questionBank, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json; charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `題庫_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    
    showSuccessToast(`✅ 已匯出 ${questionBank.length} 題`);
}

function showImportCompleteModal(examName, questionCount, importTime) {
    const modalHTML = `
        <div id="import-complete-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(10px);
        ">
            <div style="
                background: linear-gradient(135deg, #1a1a2e 0%, #2a2a4e 100%);
                border-radius: 20px;
                padding: 40px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                border: 2px solid rgba(102, 126, 234, 0.3);
                text-align: center;
            ">
                <div style="font-size: 64px; margin-bottom: 20px;">🎉</div>
                <h2 style="color: #ffffff; font-size: 28px; margin-bottom: 20px;">匯入完成！</h2>

                <div style="
                    background: linear-gradient(135deg, rgba(102, 126, 234, 0.3), rgba(118, 75, 162, 0.3));
                    padding: 25px;
                    border-radius: 15px;
                    margin-bottom: 25px;
                    border: 1px solid rgba(102, 126, 234, 0.4);
                ">
                    <div style="font-size: 14px; color: #b4b4ff; margin-bottom: 10px;">試卷名稱</div>
                    <div style="font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 20px;">📄 ${examName}</div>

                    <div style="font-size: 14px; color: #b4b4ff; margin-bottom: 10px;">題目數量</div>
                    <div style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 20px;">${questionCount} 題</div>

                    <div style="font-size: 14px; color: #b4b4ff; margin-bottom: 10px;">匯入時間</div>
                    <div style="font-size: 16px; color: #ffffff;">🕐 ${importTime}</div>
                </div>

                <div style="
                    padding: 15px;
                    background: rgba(102, 126, 234, 0.15);
                    border-radius: 10px;
                    margin-bottom: 25px;
                    border-left: 4px solid #667eea;
                ">
                    <div style="color: #b4e0ff; font-size: 14px;">
                        💡 提示：試卷已儲存，可在題庫檢視中查看詳細內容
                    </div>
                </div>

                <button onclick="closeImportModal()" style="
                    width: 100%;
                    padding: 15px;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    border: none;
                    border-radius: 12px;
                    color: #ffffff;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                ">
                    💾 確定
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeImportModal() {
    const modal = document.getElementById('import-complete-modal');
    if (modal) {
        modal.remove();
    }
}

async function handleJSONImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
        showErrorToast('❌ 請選擇 JSON 格式的檔案');
        event.target.value = '';
        return;
    }
    
    try {
        const text = await file.text();
        const importedData = JSON.parse(text);
        
        if (!Array.isArray(importedData)) {
            throw new Error('JSON 格式錯誤:需要是陣列格式');
        }
        
        const validQuestions = importedData.filter(q => {
            return q.題目 && 
                   q.選項 && 
                   typeof q.選項 === 'object' &&
                   q.選項.A && q.選項.B && q.選項.C && q.選項.D &&
                   q.答案 && 
                   ['A', 'B', 'C', 'D'].includes(q.答案.toUpperCase());
        });
        
        if (validQuestions.length === 0) {
            throw new Error('JSON 中沒有找到有效的題目');
        }

        // 記錄匯入時間
        const importTime = new Date().toLocaleString('zh-TW');

        // 暫存題目，等待用戶命名
        window._pendingImportQuestions = validQuestions;
        window._pendingImportTime = importTime;
        document.getElementById('import-name-info').textContent = `✅ 找到 ${validQuestions.length} 題　🕐 ${importTime}`;
        document.getElementById('import-name-input').value = `匯入試卷 ${new Date().toLocaleDateString()}`;
        document.getElementById('import-name-modal').style.display = 'flex';
        setTimeout(() => document.getElementById('import-name-input').select(), 50);

        event.target.value = '';
        
    } catch (error) {
        console.error('匯入錯誤:', error);
        showErrorToast(`❌ 匯入失敗:\n${error.message}\n\n請確認 JSON 格式與欄位是否正確`);
        event.target.value = '';
    }
}

function confirmJSONImport() {
    const name = document.getElementById('import-name-input').value.trim();
    if (!name) { showErrorToast('請輸入試卷名稱'); return; }
    const questions = window._pendingImportQuestions;
    if (!questions || questions.length === 0) return;
    saveExamPaper(questions, name);
    document.getElementById('import-name-modal').style.display = 'none';
    showImportCompleteModal(name, questions.length, window._pendingImportTime || '');
    window._pendingImportQuestions = null;
    switchTab('display');
}

function handleJSONImportFromDisplay(event) {
    handleJSONImport(event);
}

function startQuiz() {
    if (!currentUser) { openLoginModal('feature'); return; }
    if (examPapers.length === 0) {
        showInfoToast('請先使用「AI 智能整理」或「匯入 JSON」創建試卷');
        return;
    }
    if (examPapers.length === 1) {
        loadExamPaperForQuiz(examPapers[0].id);
        return;
    }
    showExamPaperSelectionModal();
}

function showExamPaperSelectionModal() {
    let paperOptionsHTML = '';
    examPapers.forEach((paper, index) => {
        const createdDate = new Date(paper.createdTime).toLocaleDateString('zh-TW');
        let statusText, statusColor;
        if (paper.testCount === 0) {
            statusText = '未測驗';
            statusColor = '#64748b';
        } else if (paper.lastQuestionIndex > 0 && paper.lastQuestionIndex < paper.questions.length) {
            statusText = '測驗中';
            statusColor = '#ed8936';
        } else {
            statusText = `測驗 ${paper.testCount} 次`;
            statusColor = '#1a7f5a';
        }

        paperOptionsHTML += `
            <div class="exam-paper-option" onclick="selectExamPaperForQuiz(${paper.id})" style="
                padding: 15px;
                margin-bottom: 10px;
                background: rgba(255, 255, 255, 0.05);
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
            " onmouseover="this.style.background='rgba(102, 126, 234, 0.2)'; this.style.borderColor='rgba(102, 126, 234, 0.5)';"
               onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'; this.style.borderColor='rgba(255, 255, 255, 0.1)';">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-weight: 700; color: #ffffff; font-size: 16px;">📄 ${paper.name}</div>
                    <div style="padding: 4px 12px; background: rgba(${statusColor === '#64748b' ? '100, 116, 139' : statusColor === '#1a7f5a' ? '26, 127, 90' : '237, 137, 54'}, 0.3); border-radius: 8px; font-size: 12px; color: ${statusColor};">
                        ${statusText}
                    </div>
                </div>
                <div style="font-size: 13px; color: #b4b4b4;">
                    📊 ${paper.questions.length} 題 | 🕐 ${createdDate} | 🔢 測驗 ${paper.testCount} 次
                </div>
            </div>
        `;
    });

    const modalHTML = `
        <div id="exam-selection-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(10px);
        ">
            <div style="
                background: linear-gradient(135deg, #1a1a2e 0%, #2a2a4e 100%);
                border-radius: 20px;
                padding: 30px;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                border: 2px solid rgba(102, 126, 234, 0.3);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #ffffff; font-size: 24px; margin: 0;">🎯 選擇試卷</h2>
                    <button onclick="closeExamSelectionModal()" style="
                        background: rgba(255, 255, 255, 0.1);
                        border: none;
                        border-radius: 50%;
                        width: 36px;
                        height: 36px;
                        color: #ffffff;
                        font-size: 20px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.background='rgba(229, 62, 62, 0.3)';"
                       onmouseout="this.style.background='rgba(255, 255, 255, 0.1)';">✕</button>
                </div>

                <div style="margin-bottom: 20px; padding: 12px; background: rgba(102, 126, 234, 0.15); border-radius: 10px; border-left: 4px solid #667eea;">
                    <div style="color: #b4e0ff; font-size: 14px;">
                        💡 請選擇要練習的試卷
                    </div>
                </div>

                <div style="max-height: 400px; overflow-y: auto;">
                    ${paperOptionsHTML}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeExamSelectionModal() {
    const modal = document.getElementById('exam-selection-modal');
    if (modal) {
        modal.remove();
    }
}

function selectExamPaperForQuiz(paperId) {
    closeExamSelectionModal();
    loadExamPaperForQuiz(paperId);
}

// ========== 測驗計時 ==========
function startQuizTimer() {
    quizElapsedSecs = 0;
    quizTimerPaused = false;
    quizQuestionStartTime = Date.now();
    quizQuestionPausedMs = 0;
    if (quizTimerInterval) clearInterval(quizTimerInterval);
    quizTimerInterval = setInterval(() => {
        if (!quizTimerPaused) {
            quizElapsedSecs++;
            _updateQuizTimerDisplay();
        }
    }, 1000);
    const section = document.getElementById('quiz-timer-section');
    if (section) section.style.display = 'flex';
    _updateQuizTimerDisplay();
}

function stopQuizTimer() {
    if (quizTimerInterval) { clearInterval(quizTimerInterval); quizTimerInterval = null; }
    quizTimerPaused = false;
    const section = document.getElementById('quiz-timer-section');
    if (section) section.style.display = 'none';
    _hideQuizPauseOverlay();
}

function toggleQuizPause() {
    if (quizTimerPaused) {
        // 恢復
        quizTimerPaused = false;
        quizQuestionStartTime = Date.now(); // 重設題目計時起點（不計暫停時間）
        quizQuestionPausedMs = 0;
        _hideQuizPauseOverlay();
        document.getElementById('quiz-pause-btn').textContent = '⏸';
        document.getElementById('quiz-pause-btn').title = '暫停';
    } else {
        // 暫停
        quizTimerPaused = true;
        // 記錄已答題部分的耗時
        if (quizQuestionStartTime) {
            quizQuestionPausedMs += Date.now() - quizQuestionStartTime;
        }
        quizQuestionStartTime = null;
        _showQuizPauseOverlay();
        document.getElementById('quiz-pause-btn').textContent = '▶';
        document.getElementById('quiz-pause-btn').title = '繼續';
    }
}

function _updateQuizTimerDisplay() {
    const el = document.getElementById('quiz-timer-display');
    if (!el) return;
    const m = Math.floor(quizElapsedSecs / 60).toString().padStart(2, '0');
    const s = (quizElapsedSecs % 60).toString().padStart(2, '0');
    el.textContent = `⏱ ${m}:${s}`;
}

function _showQuizPauseOverlay() {
    const overlay = document.getElementById('quiz-pause-overlay');
    if (overlay) overlay.style.display = 'flex';
}

function _hideQuizPauseOverlay() {
    const overlay = document.getElementById('quiz-pause-overlay');
    if (overlay) overlay.style.display = 'none';
}

function _getQuestionElapsedSecs() {
    // 取得當前題目已花費的秒數（含暫停前已計算的部分）
    const activeSecs = quizQuestionStartTime ? (Date.now() - quizQuestionStartTime) : 0;
    return Math.round((quizQuestionPausedMs + activeSecs) / 1000);
}

function _resetQuestionTimer() {
    quizQuestionStartTime = quizTimerPaused ? null : Date.now();
    quizQuestionPausedMs = 0;
}

function loadExamPaperForQuiz(paperId) {
    const paper = examPapers.find(p => p.id === paperId);
    if (!paper) {
        showErrorToast('找不到該試卷');
        return;
    }

    // 更新「目前試卷」顯示列（不論哪條路都先更新）
    const infoBar = document.getElementById('quiz-current-paper-info');
    const nameEl = document.getElementById('quiz-current-paper-name');
    const statusEl = document.getElementById('quiz-current-paper-status');
    if (infoBar && nameEl && statusEl) {
        infoBar.style.display = 'flex';
        nameEl.textContent = `${paper.name}（${paper.questions.length} 題）`;
        if (!paper.isCompleted && paper.lastQuestionIndex > 0 && paper.lastQuestionIndex < paper.questions.length) {
            statusEl.textContent = `繼續測驗（第 ${paper.lastQuestionIndex + 1} 題）`;
        } else {
            statusEl.textContent = paper.testCount > 0 ? `第 ${paper.testCount + 1} 次測驗` : '第 1 次測驗';
        }
    }

    // 檢查是否為測驗中的試卷（有進度但未完成所有題目）- 直接繼續測驗
    // 注意：只有未完成（!isCompleted）的試卷才能繼續
    if (paper.testCount > 0 && !paper.isCompleted && paper.lastQuestionIndex > 0 && paper.lastQuestionIndex < paper.questions.length) {
        // 直接繼續測驗，不詢問
        continueExamPaper(paperId);
        return;
    }

    // 載入試卷題目到 questionBank
    questionBank = [...paper.questions];
    currentExamPaperId = paperId;

    // 重置試卷狀態（重新開始測驗）
    paper.isCompleted = false;
    paper.lastQuestionIndex = 0;

    // 重置當前測驗的資料
    currentSessionAnswers = [];
    currentSessionStartTime = new Date();
    quizStats = { correct: 0, incorrect: 0, total: 0 };
    questionDiscussions = {}; // 清空討論記錄
    currentQuestionIndex = 0; // 先重置索引

    shuffledQuestionBank = shuffleArray([...questionBank]).map(q => remapQuestionOptions(q));

    // 保存打亂後的題庫到試卷，以便接續作答時使用
    paper.shuffledQuestionBank = JSON.parse(JSON.stringify(shuffledQuestionBank));
    // 保存當前測驗狀態
    paper.currentSessionState = {
        sessionAnswers: [],
        stats: { correct: 0, incorrect: 0, total: 0 },
        startTime: currentSessionStartTime.toISOString(),
        discussions: {}
    };

    showQuestion();
    updateStats();
    saveToStorage();

    startQuizTimer();
}

function nextQuestion() {
    if (shuffledQuestionBank.length === 0) {
        showInfoToast('請先點擊「開始練習」');
        return;
    }

    // 在切換到下一題之前，保存當前題目的討論記錄
    saveQuestionDiscussion();

    // 將討論記錄更新到答題記錄中
    if (currentSessionAnswers.length > 0) {
        const lastAnswerIndex = currentSessionAnswers.length - 1;
        const questionKey = `q_${currentQuestionIndex}`;
        const discussionData = questionDiscussions[questionKey] || { history: [], importantMessages: [] };

        // 更新當前答題記錄的討論
        currentSessionAnswers[lastAnswerIndex].討論記錄 = {
            一般討論: [...discussionData.history],
            重要討論: [...discussionData.importantMessages]
        };

        // 同步更新到 answerHistory
        if (answerHistory.length > 0) {
            answerHistory[answerHistory.length - 1].討論記錄 = {
                一般討論: [...discussionData.history],
                重要討論: [...discussionData.importantMessages]
            };
        }

        // 保存到 localStorage
        saveToStorage();
    }

    // 檢查是否已經答完所有題目
    if (currentSessionAnswers.length >= shuffledQuestionBank.length) {
        // 已經答完所有題目，不允許繼續
        showInfoToast('所有題目已完成，請儲存測驗記錄！');
        return;
    }

    currentQuestionIndex = (currentQuestionIndex + 1) % shuffledQuestionBank.length;
    showQuestion();

    // 切換到下一題後，滾動到內容區域頂部
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
        contentArea.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function checkQuizCompletion() {
    // 檢查是否所有題目都已作答
    if (currentSessionAnswers.length >= shuffledQuestionBank.length) {
        // 延遲顯示完成畫面,讓使用者看到最後一題的反饋
        setTimeout(() => {
            promptSaveSession();
        }, 1500);
    }
}

function showQuizCompletionScreen() {
    const content = document.getElementById('quiz-content');
    const sessionEndTime = new Date();
    const duration = Math.round((sessionEndTime - currentSessionStartTime) / 1000); // 秒
    const accuracy = quizStats.total > 0 ? Math.round((quizStats.correct / quizStats.total) * 100) : 0;
    const score = accuracy; // 分數就是正確率

    // 獲取錯題列表
    const wrongAnswers = currentSessionAnswers.filter(a => !a.是否正確);

    content.innerHTML = `
        <div style="text-align: center; padding: 30px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(20px); border-radius: 20px; border: 2px solid rgba(102, 126, 234, 0.5); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);">
            <div style="font-size: 60px; margin-bottom: 20px;">🎉</div>
            <h2 style="color: #ffffff; margin-bottom: 30px; font-size: 28px;">測驗完成!</h2>

            <!-- 分數顯示 -->
            <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; border-radius: 15px; margin-bottom: 25px; box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);">
                <div style="font-size: 18px; color: #ffffff; margin-bottom: 10px;">本次得分</div>
                <div style="font-size: 56px; font-weight: 700; color: #ffffff;">${score}<span style="font-size: 28px;">分</span></div>
            </div>

            <!-- 學習統計 -->
            <div style="background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 15px; padding: 25px; margin-bottom: 25px; border: 1px solid rgba(255, 255, 255, 0.2);">
                <h3 style="color: #ffffff; margin-bottom: 20px; font-size: 20px;">📊 學習統計</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left;">
                    <div style="padding: 12px; background: rgba(255, 255, 255, 0.1); border-radius: 10px;">
                        <div style="color: #ffffff; font-size: 14px;">題庫數量</div>
                        <div style="color: #ffffff; font-size: 24px; font-weight: 600;">${quizStats.total}</div>
                    </div>
                    <div style="padding: 12px; background: rgba(255, 255, 255, 0.1); border-radius: 10px;">
                        <div style="color: #ffffff; font-size: 14px;">正確率</div>
                        <div style="color: #ffffff; font-size: 24px; font-weight: 600;">${accuracy}%</div>
                    </div>
                    <div style="padding: 12px; background: rgba(26, 127, 90, 0.2); border-radius: 10px; border: 2px solid #1a7f5a;">
                        <div style="color: #ffffff; font-size: 14px;">答對題數</div>
                        <div style="color: #4ade80; font-size: 24px; font-weight: 600;">${quizStats.correct}</div>
                    </div>
                    <div style="padding: 12px; background: rgba(229, 62, 62, 0.2); border-radius: 10px; border: 2px solid #e53e3e;">
                        <div style="color: #ffffff; font-size: 14px;">答錯題數</div>
                        <div style="color: #dc2626; font-size: 24px; font-weight: 600;">${quizStats.incorrect}</div>
                    </div>
                </div>
            </div>

            <!-- 答題分析按鈕 (只有錯題時顯示) -->
            ${wrongAnswers.length > 0 ? `
                <div style="background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 15px; padding: 20px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.2);">
                    <div style="margin-bottom: 15px; color: #ffffff; font-size: 16px;">
                        發現 ${wrongAnswers.length} 道錯題,要進行AI分析嗎?
                    </div>
                    <button class="btn btn-primary" onclick="analyzeWrongAnswers()" style="width: 100%; padding: 15px; font-size: 16px;">
                        🤖 AI 答題分析
                    </button>
                    <div id="analysis-result" style="margin-top: 15px;"></div>
                </div>
            ` : `
                <div style="background: rgba(26, 127, 90, 0.2); border-radius: 15px; padding: 20px; margin-bottom: 20px; border: 2px solid #1a7f5a;">
                    <div style="font-size: 24px; margin-bottom: 10px;">🏆</div>
                    <div style="color: #ffffff; font-size: 18px; font-weight: 600;">完美答題!</div>
                    <div style="color: #ffffff; font-size: 14px; margin-top: 5px;">所有題目都答對了!</div>
                </div>
            `}

            <!-- 操作按鈕 -->
            <div style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="startQuiz()" style="width: 100%; padding: 15px;">
                    🔄 重新測驗
                </button>
            </div>
        </div>
    `;
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function remapQuestionOptions(question) {
    const newQuestion = JSON.parse(JSON.stringify(question));
    const optionEntries = Object.entries(newQuestion.選項);
    const shuffledEntries = shuffleArray(optionEntries);

    const letterMap = {};
    const letters = ['A', 'B', 'C', 'D'];
    shuffledEntries.forEach((entry, index) => {
        letterMap[entry[0]] = letters[index];
    });

    const newOptions = {};
    letters.forEach((letter, index) => {
        if (shuffledEntries[index]) {
            newOptions[letter] = shuffledEntries[index][1];
        }
    });
    newQuestion.選項 = newOptions;
    newQuestion.答案 = letterMap[newQuestion.答案];

    if (newQuestion.詳解) {
        let explanation = newQuestion.詳解;

        function escapeRegex(str) {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        Object.keys(letterMap).forEach(old => {
            const newLetter = letterMap[old];
            const placeholder = `__TMP_${newLetter}__`;
            const escOld = escapeRegex(old);

            const patterns = [
                new RegExp(`\\(${escOld}\\)`, 'g'),
                new RegExp(`（${escOld}）`, 'g'),
                new RegExp(`${escOld}\\.`, 'g'),
                new RegExp(`${escOld}\\)`, 'g'),
                new RegExp(`${escOld}）`, 'g'),
                new RegExp(`\\b${escOld}\\b`, 'g')
            ];

            patterns.forEach(p => {
                explanation = explanation.replace(p, placeholder);
            });
        });

        Object.values(letterMap).forEach(letter => {
            explanation = explanation.replace(new RegExp(`__TMP_${letter}__`, 'g'), `(${letter})`);
        });

        newQuestion.詳解 = explanation;
    }

    return newQuestion;
}

function showQuestion() {
    const q = shuffledQuestionBank[currentQuestionIndex];
    const content = document.getElementById('quiz-content');

    // 錯誤檢查
    if (!q) {
        console.error('題目不存在:', { currentQuestionIndex, totalQuestions: shuffledQuestionBank.length });
        showErrorToast('錯誤：找不到題目');
        return;
    }
    if (!content) {
        console.error('quiz-content 元素不存在');
        showErrorToast('錯誤：找不到題目顯示區域');
        return;
    }

    // 重置狀態
    selectedAnswer = null;
    isAnswerConfirmed = false;

    // 隱藏上一題的討論區
    const discussionDiv = document.getElementById('question-discussion');
    if (discussionDiv) {
        discussionDiv.style.display = 'none';
    }

    // 重置討論題目索引
    discussingQuestionIndex = -1;

    // 載入當前題目的討論歷史
    loadQuestionDiscussion();

    // 更新按鈕狀態 - 重置為「確定答案」且禁用
    const actionBtn = document.getElementById('action-btn');
    if (actionBtn) {
        actionBtn.textContent = '✓ 確定答案';
        actionBtn.disabled = true;
        actionBtn.style.opacity = '0.5';
        actionBtn.style.cursor = 'not-allowed';
    }

    const letters = ['A', 'B', 'C', 'D'];

    let html = `
        <div class="quiz-question">
            <div style="color:#a8b4ff; font-weight:600; margin-bottom:10px;">第 ${currentQuestionIndex + 1} / ${shuffledQuestionBank.length} 題</div>
            <h4 style="margin-bottom: 20px;">${q.題目}</h4>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                ${letters.filter(letter => q.選項[letter]).map(letter =>
                    `<div class="quiz-option" data-answer="${letter}" onclick="selectAnswerOption(this)">${letter}. ${q.選項[letter]}</div>`
                ).join('')}
            </div>
        </div>

        <!-- 題目討論區（確定答案後才顯示） -->
        <div id="question-discussion" style="display: none; margin-top: 25px; padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 15px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; cursor: pointer;" onclick="toggleDiscussionContent()">
                <h5 style="margin: 0; color: #a8b4ff; font-size: 19px;">💭 題目討論</h5>
                <button class="btn btn-secondary" id="discussion-toggle-btn" onclick="event.stopPropagation(); toggleDiscussionContent();" style="padding: 3px 11px; font-size: 15px; width: auto;">展開</button>
            </div>
            <div id="discussion-content" style="display: none;">
                <div id="discussion-area" style="max-height: 300px; overflow-y: auto; margin-bottom: 15px; padding: 10px; background: rgba(0, 0, 0, 0.2); border-radius: 10px;">
                    <!-- 討論訊息會在這裡顯示 -->
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="text" id="discussion-input" placeholder="輸入你的問題或想法..."
                        style="flex: 5; padding: 15px 20px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 10px; color: #fff; font-size: 16px;"
                        onkeypress="if(event.key === 'Enter') sendDiscussionMessage()">
                    <button class="btn btn-primary" onclick="sendDiscussionMessage()" style="flex: 1; padding: 8px 12px; font-size: 14px; white-space: nowrap;">發送</button>
                </div>
            </div>
        </div>
    `;

    content.innerHTML = html;
    _resetQuestionTimer();
}

// 選擇選項(尚未確認)
function selectAnswerOption(element) {
    // 如果已經確認過答案,不允許再選擇
    if (isAnswerConfirmed) return;

    // 移除其他選項的選中狀態
    document.querySelectorAll('.quiz-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.style.transform = '';
    });

    // 標記當前選項為選中
    element.classList.add('selected');
    selectedAnswer = element.dataset.answer;

    // 啟用按鈕(顯示為「確定答案」)
    const actionBtn = document.getElementById('action-btn');
    if (actionBtn) {
        actionBtn.disabled = false;
        actionBtn.style.opacity = '1';
        actionBtn.style.cursor = 'pointer';
    }
}

// 處理按鈕點擊(確定答案或下一題)
function handleActionButton() {
    if (!isAnswerConfirmed) {
        // 當前是「確定答案」狀態
        confirmAnswer();
    } else {
        // 當前是「下一題」狀態
        nextQuestion();
    }
}

// 確定答案
function confirmAnswer() {
    if (!selectedAnswer || isAnswerConfirmed) return;

    isAnswerConfirmed = true;
    const correct = shuffledQuestionBank[currentQuestionIndex].答案;
    const isCorrect = selectedAnswer === correct;

    // 禁用所有選項
    document.querySelectorAll('.quiz-option').forEach(opt => {
        opt.style.pointerEvents = 'none';
        opt.style.opacity = '0.6';
    });

    // 高亮選中的選項
    const selectedElement = document.querySelector(`[data-answer="${selectedAnswer}"]`);
    if (selectedElement) {
        selectedElement.style.opacity = '1';
    }

    // 更新統計
    if (isCorrect) quizStats.correct++;
    else quizStats.incorrect++;
    quizStats.total++;

    const currentQuestion = shuffledQuestionBank[currentQuestionIndex];

    const answerRecord = {
        題目: currentQuestion.題目,
        選項: currentQuestion.選項,
        正確答案: correct,
        使用者答案: selectedAnswer,
        是否正確: isCorrect,
        詳解: currentQuestion.詳解 || '',
        AI詳解: '',
        AI提供答案: currentQuestion.AI提供答案 || false,
        時間: new Date().toLocaleString('zh-TW'),
        耗時: _getQuestionElapsedSecs(),
        討論記錄: {
            一般討論: [],
            重要討論: []
        }
    };

    // 加入當前測驗session和舊的答題記錄
    currentSessionAnswers.push(answerRecord);
    answerHistory.push(answerRecord);

    // 檢查是否完成所有題目
    const isLastQuestion = currentSessionAnswers.length >= shuffledQuestionBank.length;

    // 立即將按鈕改為「下一題」,在顯示反饋訊息之前
    const actionBtn = document.getElementById('action-btn');
    if (actionBtn) {
        if (isLastQuestion) {
            // 最後一題：禁用按鈕並提示需儲存
            actionBtn.textContent = '⏭️ 下一題 (請先儲存)';
            actionBtn.disabled = true;
            actionBtn.style.opacity = '0.5';
            actionBtn.style.cursor = 'not-allowed';
        } else {
            // 非最後一題：正常顯示下一題
            actionBtn.textContent = '⏭️ 下一題';
            actionBtn.disabled = false;
            actionBtn.style.opacity = '1';
            actionBtn.style.cursor = 'pointer';
        }
    }

    updateStats();

    // 自動保存進度到試卷
    if (currentExamPaperId) {
        const paper = examPapers.find(p => p.id === currentExamPaperId);
        if (paper) {
            // 保存下一題的索引（即用戶應該繼續答的題目）
            paper.lastQuestionIndex = currentSessionAnswers.length;
            paper.lastTestTime = new Date().toISOString();
            if (!paper.testCount || paper.testCount === 0) {
                paper.testCount = 1;
            }
            // 保存打亂後的題庫到試卷，以便接續作答時使用
            paper.shuffledQuestionBank = JSON.parse(JSON.stringify(shuffledQuestionBank));
            // 保存當前測驗狀態
            paper.currentSessionState = {
                sessionAnswers: JSON.parse(JSON.stringify(currentSessionAnswers)),
                stats: JSON.parse(JSON.stringify(quizStats)),
                startTime: currentSessionStartTime.toISOString(),
                discussions: JSON.parse(JSON.stringify(questionDiscussions))
            };
            // 檢查是否完成
            if (currentSessionAnswers.length >= shuffledQuestionBank.length) {
                paper.isCompleted = true;
            }
        }
    }

    saveToStorage();
    updateHistoryDisplay();
    showFeedback(isCorrect, correct);

    // 鎖定正在討論的題目索引（不隨切題變化）
    discussingQuestionIndex = currentQuestionIndex;

    // 顯示討論區並載入討論歷史
    const discussionDiv = document.getElementById('question-discussion');
    if (discussionDiv) {
        discussionDiv.style.display = 'block';
        displayDiscussionHistory();
    }

    // 自動平滑滾動到頁面底部，讓使用者看到反饋和下一題按鈕
    setTimeout(() => {
        const quizContent = document.getElementById('quiz-content');
        if (quizContent) {
            quizContent.scrollTo({
                top: quizContent.scrollHeight,
                behavior: 'smooth'
            });
        }
        // 如果是在 content-area 內滾動
        const contentArea = document.querySelector('.content-area');
        if (contentArea) {
            contentArea.scrollTo({
                top: contentArea.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, 100);

    // 檢查是否完成所有題目
    checkQuizCompletion();
}

function showFeedback(isCorrect, correctAnswer) {
    const q = shuffledQuestionBank[currentQuestionIndex];
    const feedback = document.createElement('div');
    feedback.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
    feedback.style.marginTop = '20px';
    
    const responses = {
        teacher: {
            correct: ['阿彌陀佛!施主答對了,可見用心學習。', '善哉善哉!施主理解透徹。'],
            incorrect: ['施主莫灰心,錯誤乃學習必經之路。', '阿彌陀佛,此題確有玄機。']
        },
        friend: {
            correct: ['哈哈!俺老孫就知道你行!', '唉塞!你這腦袋瓜真靈光!'],
            incorrect: ['哎呀,失誤啦!不過沒關係!', '別急別急!多練練就好了!']
        },
        senior: {
            correct: ['嗯!答得好!踏實學就好。', '做得不錯!穩著點。'],
            incorrect: ['又錯了!不打緊!下次小心些。', '差得不遠!再仔細點。']
        },
        assistant: {
            correct: ['呼呼,總算答對了。', '還可以嘛!'],
            incorrect: ['哎呀呀,就知道會錯!', '算了算了!老豬告訴你。']
        }
    };
    
    const roleResponses = responses[currentRole];
    const responseText = isCorrect ? 
        roleResponses.correct[Math.floor(Math.random() * roleResponses.correct.length)] :
        roleResponses.incorrect[Math.floor(Math.random() * roleResponses.incorrect.length)];
    
    let explanationHTML = '';
    
    if (q.詳解 && q.詳解.trim().length > 0) {
        explanationHTML += `
            <div style="margin-top: 15px; padding: 15px; background: rgba(237, 137, 54, 0.1); border-radius: 8px; border-left: 4px solid #ed8936;">
                <div style="font-weight: 600; color: #ffc078; margin-bottom: 8px;">📖 題目詳解</div>
                <div style="color: #ffc078; line-height: 1.6; font-size: 14px;">${q.詳解}</div>
            </div>
        `;
    }
    
    explanationHTML += `
        <div style="margin-top: 15px; padding: 15px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border-left: 4px solid rgba(255, 255, 255, 0.2); display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: 600; color: #f0f0f0; margin-bottom: 5px; font-size: 14px;">ℹ️ AI 生成角色化解析</div>
            </div>
            <button onclick="generateAIExplanation(${currentQuestionIndex})" class="btn btn-primary" style="width: auto; padding: 8px 20px; margin: 0; white-space: nowrap;">
                🤖 AI 生成解析
            </button>
        </div>
        <div id="ai-explanation-${currentQuestionIndex}" style="margin-top: 10px;"></div>
    `;
    
    feedback.innerHTML = `
        <div style="margin-bottom: 12px; font-size: 18px; font-weight: 600;">
            ${isCorrect ? '✅ 答對了!太棒了!' : '❌ 答錯了!再接再厲!'}
        </div>
        <div style="margin-bottom: 15px; font-size: 16px; padding: 10px; background: rgba(255, 255, 255, 0.1); border-radius: 6px; border: 2px solid ${isCorrect ? '#1a7f5a' : '#e53e3e'};">
            正確答案: <strong style="color: ${isCorrect ? '#1a7f5a' : '#e53e3e'}; font-size: 18px;">${correctAnswer}</strong>
            ${q.AI提供答案 ? '<span style="margin-left: 10px; font-size: 13px; color: #fbbf24; background: rgba(251, 191, 36, 0.1); padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(251, 191, 36, 0.3);">⚠️ AI提供答案，謹慎參考</span>' : ''}
        </div>
        <div style="padding: 12px; background: ${isCorrect ? 'rgba(230, 247, 237, 0.1)' : 'rgba(255, 245, 245, 0.1)'}; border-radius: 8px; border-left: 4px solid ${isCorrect ? '#1a7f5a' : '#e53e3e'};">
            <strong>${roles[currentRole].name}:</strong> ${responseText}
        </div>
        ${explanationHTML}
    `;
    
    document.getElementById('quiz-content').appendChild(feedback);
}

async function generateAIExplanation(questionIndex) {
    const q = shuffledQuestionBank[questionIndex];
    const container = document.getElementById(`ai-explanation-${questionIndex}`);
    
    if (!container) return;
    
    container.innerHTML = `
        <div style="padding: 15px; background: rgba(102, 126, 234, 0.15); backdrop-filter: blur(10px); border-radius: 8px; text-align: center; color: #b4e0ff; border: 1px solid rgba(102, 126, 234, 0.3);">
            <div style="margin-bottom: 10px;">🤖 ${roles[currentRole].name} 正在為您生成解析...</div>
            <div style="font-size: 12px; opacity: 0.8;">請稍候</div>
        </div>
    `;
    
    try {
        const optionsText = Object.entries(q.選項)
            .map(([k, v]) => `${k}. ${v}${k === q.答案 ? ' ← 【✓ 這是正確答案】' : ''}`)
            .join('\n');

        const rolePrompts = {
            teacher: '你是唐三藏,請用慈悲智慧、佛理深厚的語氣解釋這道題目。語氣溫和有深度,約100字內。務必使用繁體中文(台灣用語),不要使用簡體中文。',
            friend: '你是孫悟空,請用機智幽默、活潑生動的語氣解釋這道題目。可以用比喻,約100字內。務必使用繁體中文(台灣用語),不要使用簡體中文。',
            senior: '你是沙悟淨,請用忠厚老實、穩重可靠的語氣解釋這道題目。踏實耐心,約100字內。務必使用繁體中文(台灣用語),不要使用簡體中文。',
            assistant: '你是豬八戒,請用直率呆白、略帶幽默的語氣解釋這道題目。率直但友善,約100字內。務必使用繁體中文(台灣用語),不要使用簡體中文。'
        };

        const prompt = `${rolePrompts[currentRole]}\n\n題目:${q.題目}\n\n選項:\n${optionsText}\n\n【重要】正確答案是：${q.答案}\n標記有【✓ 這是正確答案】的選項才是正確的，請務必以此為準！\n\n請解釋為什麼選項 ${q.答案} 是正確答案,要符合角色個性:`;
        
        const response = await fetchWithProxyFallback(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 300,
                temperature: 0.8
            })
        });
        
        if (!response.ok) {
            throw new Error(`API 請求失敗: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.choices && data.choices[0]?.message?.content) {
            const aiExplanation = data.choices[0].message.content;
            
            if (answerHistory.length > 0) {
                answerHistory[answerHistory.length - 1].AI詳解 = aiExplanation;
                saveToStorage();
                updateHistoryDisplay();
            }
            
            container.innerHTML = `
                <div style="padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 8px; border-left: 4px solid #667eea;">
                    <div style="font-weight: 600; color: #b4e0ff; margin-bottom: 8px; font-size: 15px;">
                        🤖 ${roles[currentRole].name} 的 AI 解析
                    </div>
                    <div style="color: #b4e0ff; line-height: 1.6; font-size: 14px;">${aiExplanation}</div>
                </div>
            `;
        } else {
            throw new Error('無法生成解析');
        }
    } catch (error) {
        container.innerHTML = `
            <div style="padding: 15px; background: rgba(255, 245, 245, 0.1); border-radius: 8px; border-left: 4px solid #e53e3e;">
                <div style="color: #c53030; font-size: 14px;">
                    ❌ 生成失敗: ${error.message}
                </div>
                <div style="color: #c0c0c0; font-size: 12px; margin-top: 5px;">
                    請檢查 API Key 是否正確或網路連線
                </div>
            </div>
        `;
    }
}

// ========== 題目討論功能 ==========

// 載入當前題目的討論歷史
function loadQuestionDiscussion() {
    const questionKey = `q_${currentQuestionIndex}`;

    if (!questionDiscussions[questionKey]) {
        questionDiscussions[questionKey] = {
            history: [],
            importantMessages: []
        };
    }

    const discussion = questionDiscussions[questionKey];
    currentQuestionDiscussion = [...discussion.history];
    currentQuestionImportant = [...discussion.importantMessages];
}

// 儲存當前題目的討論歷史
function saveQuestionDiscussion() {
    const questionKey = `q_${currentQuestionIndex}`;
    questionDiscussions[questionKey] = {
        history: [...currentQuestionDiscussion],
        importantMessages: [...currentQuestionImportant]
    };
}

// 顯示討論歷史
function displayDiscussionHistory() {
    const discussionArea = document.getElementById('discussion-area');
    if (!discussionArea) return;

    // 合併重要訊息和一般討論
    const allMessages = [
        ...currentQuestionImportant.map(msg => ({...msg, isImportant: true})),
        ...currentQuestionDiscussion.map(msg => ({...msg, isImportant: false}))
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (allMessages.length === 0) {
        discussionArea.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">尚無討論內容</div>';
        return;
    }

    let html = '';
    allMessages.forEach(msg => {
        const isUser = msg.role === 'user';
        const importantBadge = msg.isImportant ? '<span style="background: #f59e0b; color: #fff; padding: 2px 8px; border-radius: 5px; font-size: 11px; margin-left: 8px;">📌 重要</span>' : '';
        const starButton = !msg.isImportant && msg.role === 'assistant' ?
            `<button onclick="markAsImportant('${msg.timestamp}')" style="background: none; border: none; color: #fbbf24; cursor: pointer; font-size: 14px; padding: 0 5px;" title="標記為重要">⭐</button>` : '';

        html += `
            <div style="margin-bottom: 12px; display: flex; flex-direction: column; align-items: ${isUser ? 'flex-end' : 'flex-start'};">
                <div style="max-width: 85%; padding: 10px 14px; border-radius: 12px; background: ${isUser ? 'rgba(102, 126, 234, 0.3)' : 'rgba(255, 255, 255, 0.1)'}; position: relative;">
                    <div style="font-size: 11px; color: #999; margin-bottom: 5px;">
                        ${isUser ? '你' : roles[currentRole].name}
                        ${importantBadge}
                        ${starButton}
                    </div>
                    <div style="color: #fff; font-size: 14px; line-height: 1.5;">${msg.content}</div>
                </div>
            </div>
        `;
    });

    discussionArea.innerHTML = html;
    discussionArea.scrollTop = discussionArea.scrollHeight;
}

// 發送討論訊息
async function sendDiscussionMessage() {
    const input = document.getElementById('discussion-input');
    const message = input.value.trim();

    if (!message) return;

    // 添加使用者訊息
    const userMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
    };

    currentQuestionDiscussion.push(userMessage);

    // 保持最近16條訊息（約8輪對話，不包括重要訊息）
    if (currentQuestionDiscussion.length > 16) {
        currentQuestionDiscussion.shift();
    }

    input.value = '';
    displayDiscussionHistory();

    // 顯示 AI 思考中
    const discussionArea = document.getElementById('discussion-area');
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'discussion-loading';
    loadingMsg.innerHTML = `
        <div style="margin-bottom: 12px; display: flex; flex-direction: column; align-items: flex-start;">
            <div style="padding: 10px 14px; border-radius: 12px; background: rgba(255, 255, 255, 0.1);">
                <div style="color: #999; font-size: 14px;">思考中...</div>
            </div>
        </div>
    `;
    discussionArea.appendChild(loadingMsg);
    discussionArea.scrollTop = discussionArea.scrollHeight;

    try {
        // 使用鎖定的討論題目索引，而不是當前題目索引
        const questionIndexToUse = discussingQuestionIndex >= 0 ? discussingQuestionIndex : currentQuestionIndex;
        const currentQuestion = shuffledQuestionBank[questionIndexToUse];

        // 調試信息
        console.log('====== 題目討論調試信息 ======');
        console.log('當前題目索引:', currentQuestionIndex);
        console.log('討論題目索引（鎖定）:', discussingQuestionIndex);
        console.log('實際使用索引:', questionIndexToUse);
        console.log('題庫總數:', shuffledQuestionBank.length);
        console.log('討論題目內容:', currentQuestion?.題目);
        console.log('討論題目答案:', currentQuestion?.答案);

        if (!currentQuestion) {
            throw new Error('無法獲取討論題目資訊');
        }

        const optionsText = Object.entries(currentQuestion.選項)
            .map(([k, v]) => `${k}. ${v}${k === currentQuestion.答案 ? ' ← 【✓ 這是正確答案】' : ''}`)
            .join('\n');

        // 準備題目詳解（如果有的話）
        const explanationText = currentQuestion.詳解 ? `\n\n【題目詳解】\n${currentQuestion.詳解}` : '';

        // 準備對話上下文
        const messages = [
            {
                role: 'system',
                content: `你是${roles[currentRole].name}，正在協助學生理解以下題目。務必使用繁體中文(台灣用語)回答。

【題目內容】
${currentQuestion.題目}

【選項】
${optionsText}

【正確答案】${currentQuestion.答案}${explanationText}

【你的任務】
1. 記住完整的題目內容、選項和正確答案
2. 根據學生的問題，用${roles[currentRole].name}的個性與語氣來回答
3. 如果學生問到題目相關的問題，要能回憶題目細節
4. 幫助學生理解為什麼正確答案是對的，其他選項為什麼錯
5. 回答要清楚但簡潔，約50-150字

【對話記憶】
你可以記住這次對話中的前幾輪內容，所以當學生說"這題"、"剛才那個"時，你知道他們在談論什麼。`
            },
            // 包含重要訊息（系統認為重要的對話）
            ...currentQuestionImportant.filter(msg => msg.role !== 'system'),
            // 包含最近的討論（確保 AI 能記住上下文）
            ...currentQuestionDiscussion.filter(msg => msg.role !== 'system').slice(-8)  // 保留最近8輪對話
        ];

        const response = await fetchWithProxyFallback(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: messages,
                max_tokens: 300,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`API 請求失敗: ${response.status}`);
        }

        const data = await response.json();

        if (data.choices && data.choices[0]?.message?.content) {
            const aiResponse = {
                role: 'assistant',
                content: data.choices[0].message.content,
                timestamp: new Date().toISOString()
            };

            currentQuestionDiscussion.push(aiResponse);

            // 保持最近16條訊息（約8輪對話）
            if (currentQuestionDiscussion.length > 16) {
                currentQuestionDiscussion.shift();
            }

            // 儲存討論
            saveQuestionDiscussion();
        }
    } catch (error) {
        console.error('討論 API 錯誤:', error);
        const errorResponse = {
            role: 'assistant',
            content: `抱歉，無法回應：${error.message}`,
            timestamp: new Date().toISOString()
        };
        currentQuestionDiscussion.push(errorResponse);
    }

    // 移除載入訊息並顯示完整歷史
    const loading = document.getElementById('discussion-loading');
    if (loading) loading.remove();

    displayDiscussionHistory();
}

// 標記訊息為重要
function markAsImportant(timestamp) {
    // 從一般討論中找到該訊息
    const messageIndex = currentQuestionDiscussion.findIndex(msg => msg.timestamp === timestamp);

    if (messageIndex !== -1) {
        const message = currentQuestionDiscussion[messageIndex];

        // 移到重要訊息
        currentQuestionImportant.push(message);
        currentQuestionDiscussion.splice(messageIndex, 1);

        // 儲存
        saveQuestionDiscussion();
        displayDiscussionHistory();
    }
}

// 切換討論區顯示/隱藏
function toggleDiscussionContent() {
    const discussionContent = document.getElementById('discussion-content');
    const btn = document.getElementById('discussion-toggle-btn');

    if (discussionContent.style.display === 'none') {
        discussionContent.style.display = 'block';
        btn.textContent = '收合';
    } else {
        discussionContent.style.display = 'none';
        btn.textContent = '展開';
    }
}

// 切換答題記錄中的討論記錄顯示/隱藏
function toggleHistoryDiscussion(index) {
    const discussionContent = document.getElementById(`discussion-history-${index}`);
    const btn = document.getElementById(`discussion-history-btn-${index}`);

    if (discussionContent && btn) {
        if (discussionContent.style.display === 'none') {
            discussionContent.style.display = 'block';
            btn.textContent = '收合';
        } else {
            discussionContent.style.display = 'none';
            btn.textContent = '展開';
        }
    }
}

// 渲染討論記錄（用於答題記錄詳情頁）
function renderDiscussionHistory(討論記錄) {
    if (!討論記錄) return '<div style="color: #999; font-size: 13px;">無討論記錄</div>';

    const allMessages = [
        ...討論記錄.重要討論.map(msg => ({...msg, isImportant: true})),
        ...討論記錄.一般討論.map(msg => ({...msg, isImportant: false}))
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (allMessages.length === 0) {
        return '<div style="color: #999; font-size: 13px;">無討論記錄</div>';
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';

    allMessages.forEach(msg => {
        const isUser = msg.role === 'user';
        const importantBadge = msg.isImportant ? '<span style="background: #f59e0b; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 6px;">📌</span>' : '';

        html += `
            <div style="display: flex; flex-direction: column; align-items: ${isUser ? 'flex-end' : 'flex-start'};">
                <div style="max-width: 85%; padding: 10px 14px; border-radius: 10px; background: ${isUser ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255, 255, 255, 0.08)'};">
                    <div style="font-size: 12px; color: #c0c0c0; margin-bottom: 6px;">
                        ${isUser ? '你' : '角色'}
                        ${importantBadge}
                    </div>
                    <div style="color: #ffffff; font-size: 15px; line-height: 1.6;">${msg.content}</div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

// ========== 答題記錄討論功能 ==========
async function sendHistoryDiscussionMessage(recordIndex) {
    const input = document.getElementById(`history-discussion-input-${recordIndex}`);
    const message = input ? input.value.trim() : '';

    if (!message) return;

    // 獲取對應的答題記錄 - 從當前查看的session中獲取
    let record;
    if (currentViewingSession && currentViewingSession.答題記錄) {
        record = currentViewingSession.答題記錄[recordIndex];
    } else {
        // 如果沒有當前session，則從全局answerHistory獲取（兼容舊版本）
        record = answerHistory[recordIndex];
    }

    if (!record) {
        showErrorToast('❌ 找不到該答題記錄');
        console.error('無法找到答題記錄:', { recordIndex, currentViewingSession });
        return;
    }

    // 初始化討論記錄結構（如果不存在）
    if (!record.討論記錄) {
        record.討論記錄 = {
            一般討論: [],
            重要討論: []
        };
    }

    // 添加使用者訊息
    const userMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
    };

    record.討論記錄.一般討論.push(userMessage);

    // 保持最近16條一般討論（約8輪對話）
    if (record.討論記錄.一般討論.length > 16) {
        record.討論記錄.一般討論 = record.討論記錄.一般討論.slice(-16);
    }

    input.value = '';

    // 更新顯示
    updateHistoryDiscussionDisplay(recordIndex, record.討論記錄);

    // 顯示 AI 思考中
    const discussionArea = document.getElementById(`discussion-history-area-${recordIndex}`);
    if (!discussionArea) return;

    const loadingMsg = document.createElement('div');
    loadingMsg.id = `history-discussion-loading-${recordIndex}`;
    loadingMsg.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: flex-start; margin-top: 10px;">
            <div style="padding: 10px 14px; border-radius: 12px; background: rgba(255, 255, 255, 0.1);">
                <div style="color: #999; font-size: 14px;">思考中...</div>
            </div>
        </div>
    `;
    discussionArea.appendChild(loadingMsg);
    discussionArea.scrollTop = discussionArea.scrollHeight;

    try {
        // 調試信息
        console.log('====== 答題記錄討論調試信息 ======');
        console.log('記錄索引:', recordIndex);
        console.log('題目內容:', record.題目);
        console.log('正確答案:', record.正確答案);
        console.log('選項:', record.選項);
        console.log('詳解:', record.詳解);

        // 準備對話上下文
        const optionsText = Object.entries(record.選項)
            .map(([k, v]) => `${k}. ${v}${k === record.正確答案 ? ' ← 【✓ 這是正確答案】' : ''}`)
            .join('\n');

        // 準備題目詳解（如果有的話）
        const explanationText = record.詳解 ? `\n\n【題目詳解】\n${record.詳解}` : '';

        const conversationHistory = [
            ...record.討論記錄.重要討論.map(m => ({ role: m.role, content: m.content })),
            ...record.討論記錄.一般討論.slice(-8).map(m => ({ role: m.role, content: m.content }))  // 保留最近8輪
        ].sort((a, b) => {
            const aMsg = record.討論記錄.重要討論.find(m => m.content === a.content) ||
                        record.討論記錄.一般討論.find(m => m.content === a.content);
            const bMsg = record.討論記錄.重要討論.find(m => m.content === b.content) ||
                        record.討論記錄.一般討論.find(m => m.content === b.content);
            return new Date(aMsg.timestamp) - new Date(bMsg.timestamp);
        });

        const systemPrompt = {
            role: 'system',
            content: `你是${roles[currentRole].name}，正在協助學生理解以下題目。務必使用繁體中文(台灣用語)回答。

【題目內容】
${record.題目}

【選項】
${optionsText}

【正確答案】${record.正確答案}${explanationText}

【你的任務】
1. 記住完整的題目內容、選項和正確答案
2. 根據學生的問題，用${roles[currentRole].name}的個性與語氣來回答
3. 如果學生問到題目相關的問題，要能回憶題目細節
4. 幫助學生理解為什麼正確答案是對的，其他選項為什麼錯
5. 回答要清楚但簡潔，約50-150字

【對話記憶】
你可以記住這次對話中的前幾輪內容，所以當學生說"這題"、"剛才那個"時，你知道他們在談論什麼。`
        };

        const response = await fetchWithProxyFallback(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://ai-tutor.app',
                'X-Title': 'AI Tutor'
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: [systemPrompt, ...conversationHistory],
                max_tokens: 500,
                temperature: 0.7
            })
        });

        const data = await response.json();

        if (data.choices && data.choices[0]) {
            const aiResponse = {
                role: 'assistant',
                content: data.choices[0].message.content,
                timestamp: new Date().toISOString()
            };

            record.討論記錄.一般討論.push(aiResponse);

            // 保持最近16條一般討論（約8輪對話）
            if (record.討論記錄.一般討論.length > 16) {
                record.討論記錄.一般討論 = record.討論記錄.一般討論.slice(-16);
            }
        }
    } catch (error) {
        console.error('AI 回應錯誤:', error);
        const errorResponse = {
            role: 'assistant',
            content: '抱歉，無法取得回應，請稍後再試。',
            timestamp: new Date().toISOString()
        };
        record.討論記錄.一般討論.push(errorResponse);
    }

    // 移除載入訊息
    const loading = document.getElementById(`history-discussion-loading-${recordIndex}`);
    if (loading) loading.remove();

    // 更新顯示並保存
    updateHistoryDiscussionDisplay(recordIndex, record.討論記錄);
    saveToStorage();
}

function updateHistoryDiscussionDisplay(recordIndex, 討論記錄) {
    const discussionArea = document.getElementById(`discussion-history-area-${recordIndex}`);
    if (!discussionArea) return;

    discussionArea.innerHTML = renderDiscussionHistory(討論記錄);
    discussionArea.scrollTop = discussionArea.scrollHeight;
}

// ========== 討論功能結束 ==========

function renderSessionCard(session) {
    const scoreColor = session.分數 >= 80 ? '#1a7f5a' : session.分數 >= 60 ? '#ed8936' : '#e53e3e';
    const scoreBg = session.分數 >= 80 ? 'rgba(26, 127, 90, 0.2)' : session.分數 >= 60 ? 'rgba(237, 137, 54, 0.2)' : 'rgba(229, 62, 62, 0.2)';
    const isSelected = selectedForDeletion.has(session.id);

    return `
        <div class="question-item" style="cursor: pointer; transition: all 0.3s ease; border-left: 4px solid ${scoreColor}; ${isSelected ? 'background: rgba(229, 62, 62, 0.15); border: 2px solid #e53e3e;' : ''}" onclick="${isInDeleteMode ? `toggleSessionSelection(${session.id}, event)` : `showSessionDetail(${session.id})`}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                        ${isInDeleteMode ? `<input type="checkbox" ${isSelected ? 'checked' : ''} onclick="toggleSessionSelection(${session.id}, event)" style="width: 20px; height: 20px; cursor: pointer;">` : ''}
                        <span style="font-size: 20px;">📁</span>
                        <span style="font-weight: 700; color: #ffffff; font-size: 16px;">${session.類型}</span>
                    </div>
                    <div style="font-size: 13px; color: #ffffff; ${isInDeleteMode ? 'margin-left: 30px;' : ''}">
                        🕐 ${session.時間}
                        ${session.總耗時 ? `<span style="color:#94a3b8; font-size:12px; margin-left:8px;">⏱ ${Math.floor(session.總耗時/60)}分${session.總耗時%60}秒</span>` : ''}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="background: ${scoreBg}; padding: 8px 16px; border-radius: 10px; border: 2px solid ${scoreColor};">
                        <div style="font-size: 24px; font-weight: 700; color: ${scoreColor};">${session.分數}分</div>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 15px;">
                <div style="padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; text-align: center;">
                    <div style="font-size: 12px; color: #ffffff;">題數</div>
                    <div style="font-size: 18px; font-weight: 600; color: #ffffff;">${session.題目數}</div>
                </div>
                <div style="padding: 8px; background: rgba(26, 127, 90, 0.15); border-radius: 8px; text-align: center;">
                    <div style="font-size: 12px; color: #ffffff;">答對</div>
                    <div style="font-size: 18px; font-weight: 600; color: #4ade80;">${session.答對數}</div>
                </div>
                <div style="padding: 8px; background: rgba(229, 62, 62, 0.15); border-radius: 8px; text-align: center;">
                    <div style="font-size: 12px; color: #ffffff;">答錯</div>
                    <div style="font-size: 18px; font-weight: 600; color: #dc2626;">${session.答錯數}</div>
                </div>
            </div>

            ${session.AI分析 ? `
                <div style="margin-top: 10px; padding: 8px 12px; background: rgba(102, 126, 234, 0.15); border-radius: 8px; display: flex; align-items: center; gap: 8px;">
                    <span>🤖</span>
                    <span style="color: #b4e0ff; font-size: 13px;">已完成AI分析</span>
                </div>
            ` : ''}

            ${!isInDeleteMode ? `
                <div style="margin-top: 12px; text-align: center; color: #ffffff; font-size: 13px;">
                    點擊查看詳細記錄 →
                </div>
            ` : ''}
        </div>
    `;
}

function updateHistoryDisplay(fromDetailReturn = false) {
    // 清空當前查看的session
    currentViewingSession = null;

    // 移除 viewing-detail class（恢復正常頂部大小）
    document.body.classList.remove('viewing-detail');

    // 顯示搜尋區域
    const searchArea = document.getElementById('history-search-area');
    if (searchArea) {
        searchArea.style.display = 'flex';
    }

    // 只有從詳細頁返回時才退出刪除模式
    if (fromDetailReturn && isInDeleteMode) {
        isInDeleteMode = false;
        selectedForDeletion.clear();
        updateDeleteButton();
    }

    const display = document.getElementById('history-display');

    // 檢查是否有測驗記錄
    if (testSessions.length === 0) {
        display.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ffffff;">
                <div style="font-size: 48px; margin-bottom: 20px;">📝</div>
                <p>尚無測驗記錄</p>
                <p style="font-size: 14px; color: #ffffff; margin-top: 10px;">完成測驗後點擊「儲存記錄」即可保存</p>
            </div>
        `;
        return;
    }

    // 顯示測驗session列表
    let html = '';

    // 如果在刪除模式，顯示控制按鈕
    if (isInDeleteMode) {
        html += `
            <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                <button class="btn btn-secondary" onclick="toggleSelectAll()" style="width: auto; padding: 8px 20px;">
                    ${selectedForDeletion.size === testSessions.length ? '✓ 全不選' : '☐ 全選'}
                </button>
                <button class="btn btn-secondary" onclick="cancelDeleteMode()" style="width: auto; padding: 8px 20px;">
                    ✕ 取消
                </button>
                <div style="flex: 1; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 14px;">
                    已選擇 ${selectedForDeletion.size} 筆
                </div>
            </div>
        `;
    }

    html += '<div style="display: flex; flex-direction: column; gap: 15px;">';
    testSessions.forEach(session => { html += renderSessionCard(session); });
    html += '</div>';
    display.innerHTML = html;
}

// 顯示單個session的詳細資料
function showSessionDetail(sessionId) {
    const session = testSessions.find(s => s.id === sessionId);
    if (!session) return;

    // 設置當前查看的session（用於答題記錄討論）
    currentViewingSession = session;

    // 添加 viewing-detail class 到 body（用於手機版縮小頂部）
    document.body.classList.add('viewing-detail');

    // 隱藏搜尋區域
    const searchArea = document.getElementById('history-search-area');
    if (searchArea) {
        searchArea.style.display = 'none';
    }

    const display = document.getElementById('history-display');
    const scoreColor = session.分數 >= 80 ? '#1a7f5a' : session.分數 >= 60 ? '#ed8936' : '#e53e3e';
    const wrongAnswers = session.答題記錄.filter(a => !a.是否正確);

    let html = `
        <div style="margin-bottom: 20px;">
            <button class="btn btn-secondary" onclick="updateHistoryDisplay(true)" style="width: auto; padding: 10px 20px; margin-bottom: 15px;">
                ← 返回測驗列表
            </button>
        </div>

        <!-- Session 標題資訊 -->
        <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 15px; padding: 25px; margin-bottom: 20px; border: 2px solid ${scoreColor};">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px; gap: 20px;">
                <div style="flex: 1; min-width: 0;">
                    <div class="session-title-wrapper" style="margin-bottom: 8px;">
                        <h3 id="session-name-${session.id}" style="color: #ffffff; font-size: 22px; margin: 0;">📁 ${session.類型}</h3>
                        <button onclick="editSessionName(${session.id})" class="btn btn-secondary session-edit-btn" style="padding: 4px 10px; font-size: 11px; width: auto; margin: 0;">
                            ✏️ 編輯
                        </button>
                    </div>
                    <div style="color: #ffffff; font-size: 14px;">🕐 ${session.時間}</div>
                </div>
                <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 15px 25px; border-radius: 12px; text-align: center; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); flex-shrink: 0;">
                    <div style="color: #ffffff; font-size: 14px; margin-bottom: 5px;">得分</div>
                    <div style="color: #ffffff; font-size: 32px; font-weight: 700;">${session.分數}分</div>
                </div>
            </div>

            <!-- 統計資訊 -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;">
                <div style="padding: 12px; background: rgba(255, 255, 255, 0.1); border-radius: 10px; text-align: center;">
                    <div style="color: #ffffff; font-size: 13px;">題庫數量</div>
                    <div style="color: #ffffff; font-size: 22px; font-weight: 600; margin-top: 5px;">${session.題目數}</div>
                </div>
                <div style="padding: 12px; background: rgba(26, 127, 90, 0.2); border-radius: 10px; text-align: center; border: 2px solid #1a7f5a;">
                    <div style="color: #ffffff; font-size: 13px;">答對題數</div>
                    <div style="color: #4ade80; font-size: 22px; font-weight: 600; margin-top: 5px;">${session.答對數}</div>
                </div>
                <div style="padding: 12px; background: rgba(229, 62, 62, 0.2); border-radius: 10px; text-align: center; border: 2px solid #e53e3e;">
                    <div style="color: #ffffff; font-size: 13px;">答錯題數</div>
                    <div style="color: #dc2626; font-size: 22px; font-weight: 600; margin-top: 5px;">${session.答錯數}</div>
                </div>
                <div style="padding: 12px; background: rgba(255, 255, 255, 0.1); border-radius: 10px; text-align: center;">
                    <div style="color: #ffffff; font-size: 13px;">正確率</div>
                    <div style="color: #ffffff; font-size: 22px; font-weight: 600; margin-top: 5px;">${session.正確率}%</div>
                </div>
            </div>
        </div>

        <!-- AI分析結果 -->
        ${session.AI分析 ? `
            <div style="background: rgba(102, 126, 234, 0.15); backdrop-filter: blur(10px); border-radius: 15px; padding: 20px; margin-bottom: 20px; border: 2px solid rgba(102, 126, 234, 0.5);">
                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                    <span style="font-size: 24px; margin-right: 10px;">🤖</span>
                    <span style="color: #ffffff; font-weight: 600; font-size: 18px;">AI 答題分析報告</span>
                </div>
                <div style="color: #ffffff; line-height: 1.8; white-space: pre-wrap; font-size: 15px;">${escapeHtml(session.AI分析)}</div>
            </div>
        ` : wrongAnswers.length > 0 ? `
            <div style="background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 15px; padding: 20px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.2); text-align: center;">
                <div style="color: #ffffff; margin-bottom: 15px;">此次測驗尚未進行AI分析</div>
                <button class="btn btn-primary" onclick="analyzeSessionWrongAnswers(${sessionId})" style="width: auto; padding: 12px 24px;">
                    🤖 立即分析
                </button>
                <div id="session-analysis-${sessionId}"></div>
            </div>
        ` : ''}

        <!-- 答題詳細記錄 -->
        <div style="margin-top: 20px;">
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 15px;">
                <h4 style="color: #ffffff; margin: 0; font-size: 18px;">📝 答題詳細記錄</h4>
                <input type="text" id="session-detail-search" placeholder="🔍 搜尋題目關鍵字..."
                    style="flex: 1; max-width: 400px; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.3);
                        background: rgba(255, 255, 255, 0.1); color: #d0d0d0; font-size: 14px; outline: none;"
                    oninput="filterSessionDetailQuestions()">
            </div>
            <div id="session-detail-questions-container">
    `;

    const totalTime = session.總耗時 || session.答題記錄.reduce((sum, r) => sum + (r.耗時 || 0), 0);

    session.答題記錄.forEach((record, i) => {
        const isCorrect = record.是否正確;
        const statusColor = isCorrect ? '#1a7f5a' : '#e53e3e';
        const statusIcon = isCorrect ? '✅' : '❌';

        html += `
            <div class="question-item session-detail-question-item" data-question-text="${escapeAttr(record.題目 + ' ' + record.選項.A + ' ' + record.選項.B + ' ' + record.選項.C + ' ' + record.選項.D)}" style="border-left: 4px solid ${statusColor}; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div class="question-header" style="flex: 1;">${i + 1}. ${record.題目}</div>
                    <div style="font-size: 24px; margin-left: 10px;">${statusIcon}</div>
                </div>

                <div style="margin-top: 10px;">
                    ${['A', 'B', 'C', 'D'].map(k => {
                        let style = 'padding: 5px 0;';
                        if (k === record.正確答案) {
                            style += 'color: #4ade80; font-weight: 600;';
                        }
                        if (k === record.使用者答案 && !isCorrect) {
                            style += 'color: #dc2626; text-decoration: line-through;';
                        }
                        return `<div style="${style}">${k}. ${record.選項[k]}</div>`;
                    }).join('')}
                </div>

                <div style="margin-top: 10px; padding: 10px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 6px; color: #ffffff;">
                    <strong>你的答案:</strong> <span style="color: #ffffff; font-size: 16px;">${record.使用者答案}</span>
                    ${!isCorrect ? ` | <strong>正確答案:</strong> <span style="color: #ffffff; font-size: 16px; font-weight: 600;">${record.正確答案}</span>` : ''}
                    ${record.AI提供答案 ? '<span style="margin-left: 10px; font-size: 12px; color: #fbbf24; background: rgba(251, 191, 36, 0.1); padding: 2px 6px; border-radius: 3px; border: 1px solid rgba(251, 191, 36, 0.3);">⚠️ AI提供答案，謹慎參考</span>' : ''}
                    ${record.耗時 ? `
                    <div style="margin-top:8px;">
                        <div style="display:flex; justify-content:space-between; font-size:12px; color:#94a3b8; margin-bottom:3px;">
                            <span>⏱ 作答時間</span>
                            <span>${record.耗時}秒（${totalTime > 0 ? Math.round(record.耗時 / totalTime * 100) : 0}%）</span>
                        </div>
                        <div style="height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
                            <div style="height:100%; width:${totalTime > 0 ? Math.min(100, Math.round(record.耗時 / totalTime * 100)) : 0}%; background:var(--border-neon, #00d4ff); border-radius:2px; transition:width 0.5s;"></div>
                        </div>
                    </div>` : ''}
                </div>

                ${record.詳解 ? `
                    <div style="margin-top: 10px; padding: 15px; background: rgba(237, 137, 54, 0.1); border-radius: 8px; border-left: 4px solid #ed8936;">
                        <div style="font-weight: 600; color: #ffc078; margin-bottom: 8px;">📖 題目詳解</div>
                        <div style="color: #ffc078; line-height: 1.6; font-size: 14px;">${record.詳解}</div>
                    </div>
                ` : ''}

                ${record.AI詳解 ? `
                    <div style="margin-top: 10px; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 8px; border-left: 4px solid #667eea;">
                        <div style="font-weight: 600; color: #b4e0ff; margin-bottom: 8px;">🤖 AI 生成解析</div>
                        <div style="color: #b4e0ff; line-height: 1.6; font-size: 14px;">${record.AI詳解}</div>
                    </div>
                ` : ''}

                <div style="margin-top: 10px; padding: 15px; background: rgba(168, 180, 255, 0.1); border-radius: 8px; border-left: 4px solid #a8b4ff;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; cursor: pointer;" onclick="toggleHistoryDiscussion(${i})">
                        <div style="font-weight: 600; color: #a8b4ff;">💭 題目討論 ${record.討論記錄 && (record.討論記錄.一般討論.length > 0 || record.討論記錄.重要討論.length > 0) ? `(${record.討論記錄.一般討論.length + record.討論記錄.重要討論.length})` : ''}</div>
                        <button class="btn btn-secondary" id="discussion-history-btn-${i}" onclick="event.stopPropagation(); toggleHistoryDiscussion(${i});" style="padding: 4px 16px; font-size: 13px; width: auto;">展開</button>
                    </div>
                    <div id="discussion-history-${i}" style="display: none;">
                        <div id="discussion-history-area-${i}" style="max-height: 300px; overflow-y: auto; margin-bottom: 15px; padding: 10px; background: rgba(0, 0, 0, 0.2); border-radius: 10px;">
                            ${record.討論記錄 && (record.討論記錄.一般討論.length > 0 || record.討論記錄.重要討論.length > 0) ? renderDiscussionHistory(record.討論記錄) : '<div style="text-align: center; color: #999; padding: 20px;">尚無討論內容，開始提問吧！</div>'}
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="text" id="history-discussion-input-${i}" placeholder="輸入你的問題或想法..."
                                style="flex: 5; padding: 12px 16px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 10px; color: #fff; font-size: 14px;"
                                onkeypress="if(event.key === 'Enter') sendHistoryDiscussionMessage(${i})">
                            <button class="btn btn-primary" onclick="sendHistoryDiscussionMessage(${i})" style="flex: 1; padding: 10px 12px; font-size: 13px; white-space: nowrap;">發送</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div></div>';
    display.innerHTML = html;
}

function filterSessionDetailQuestions() {
    const searchInput = document.getElementById('session-detail-search');
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const items = document.querySelectorAll('.session-detail-question-item');

    items.forEach(item => {
        const questionText = item.getAttribute('data-question-text').toLowerCase();
        if (keyword === '' || questionText.includes(keyword)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// 為已儲存的session分析錯題
async function analyzeSessionWrongAnswers(sessionId) {
    const session = testSessions.find(s => s.id === sessionId);
    if (!session) return;

    const wrongAnswers = session.答題記錄.filter(a => !a.是否正確);
    if (wrongAnswers.length === 0) {
        showInfoToast('此次測驗沒有錯題！');
        return;
    }

    const analysisContainer = document.getElementById(`session-analysis-${sessionId}`);
    analysisContainer.innerHTML = `
        <div style="padding: 20px; background: rgba(255, 255, 255, 0.1); border-radius: 12px; text-align: center; margin-top: 15px;">
            <span class="loading-spinner"></span>
            <div style="color: #ffffff; margin-top: 10px;">AI 正在分析錯題...</div>
        </div>
    `;

    try {
        const wrongQuestionsText = wrongAnswers.map((record, index) => {
            return `錯題 ${index + 1}：
題目：${record.題目}
您的答案：${record.使用者答案}
正確答案：${record.正確答案}`;
        }).join('\n\n');

        const prompt = `請分析以下錯題,找出使用者不擅長的題目類型和知識點。請用繁體中文(台灣用語)回答,不要使用簡體中文。

${wrongQuestionsText}

請提供：
1. 不擅長的題目類型 (例如:計算題、理解題、記憶題等)
2. 不擅長的知識點 (具體列出3-5個)
3. 學習建議 (簡潔具體,3-5點)

請以清晰的條列式呈現,每個部分用明確的標題區分。`;

        const response = await fetchWithProxyFallback(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`API 請求失敗: ${response.status}`);
        }

        const data = await response.json();

        if (data.choices && data.choices[0]?.message?.content) {
            const analysis = data.choices[0].message.content;

            // 更新session的AI分析
            session.AI分析 = analysis;
            saveToStorage();

            // 重新顯示詳細頁面
            showSessionDetail(sessionId);
        } else {
            throw new Error('無法生成分析');
        }
    } catch (error) {
        analysisContainer.innerHTML = `
            <div style="padding: 20px; background: rgba(229, 62, 62, 0.15); border-radius: 12px; border: 2px solid rgba(229, 62, 62, 0.5); margin-top: 15px;">
                <div style="color: #dc2626; font-weight: 600; margin-bottom: 10px;">❌ 分析失敗</div>
                <div style="color: #ffffff; font-size: 14px;">${escapeHtml(error.message)}</div>
            </div>
        `;
    }
}

// AI 分析錯題功能
async function analyzeWrongAnswers() {
    const wrongAnswers = currentSessionAnswers.filter(a => !a.是否正確);

    if (wrongAnswers.length === 0) {
        showInfoToast('沒有錯題需要分析！');
        return;
    }

    const analysisContainer = document.getElementById('analysis-result');
    analysisContainer.innerHTML = `
        <div style="padding: 20px; background: rgba(255, 255, 255, 0.1); border-radius: 12px; text-align: center;">
            <span class="loading-spinner"></span>
            <div style="color: #ffffff; margin-top: 10px;">AI 正在分析您的錯題...</div>
        </div>
    `;

    try {
        // 整理錯題資訊
        const wrongQuestionsText = wrongAnswers.map((record, index) => {
            return `錯題 ${index + 1}：
題目：${record.題目}
您的答案：${record.使用者答案}
正確答案：${record.正確答案}`;
        }).join('\n\n');

        const prompt = `請分析以下錯題,找出使用者不擅長的題目類型和知識點。請用繁體中文(台灣用語)回答,不要使用簡體中文。

${wrongQuestionsText}

請提供：
1. 不擅長的題目類型 (例如:計算題、理解題、記憶題等)
2. 不擅長的知識點 (具體列出3-5個)
3. 學習建議 (簡潔具體,3-5點)

請以清晰的條列式呈現,每個部分用明確的標題區分。`;

        const response = await fetchWithProxyFallback(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`API 請求失敗: ${response.status}`);
        }

        const data = await response.json();

        if (data.choices && data.choices[0]?.message?.content) {
            const analysis = data.choices[0].message.content;

            // 儲存分析結果到當前session
            window.currentSessionAnalysis = analysis;

            // 同步保存到最近的測驗記錄（testSessions使用unshift，所以最新的在[0]）
            if (testSessions.length > 0) {
                const latestSession = testSessions[0]; // 最新的記錄在索引0
                latestSession.AI分析 = analysis;
                saveToStorage();
                updateHistoryDisplay(); // 更新顯示以反映新的分析結果
            }

            analysisContainer.innerHTML = `
                <div style="padding: 20px; background: rgba(102, 126, 234, 0.15); backdrop-filter: blur(10px); border-radius: 12px; border: 2px solid rgba(102, 126, 234, 0.5); text-align: left;">
                    <div style="display: flex; align-items: center; margin-bottom: 15px;">
                        <span style="font-size: 24px; margin-right: 10px;">🤖</span>
                        <span style="color: #ffffff; font-weight: 600; font-size: 18px;">AI 答題分析報告</span>
                    </div>
                    <div style="color: #ffffff; line-height: 1.8; white-space: pre-wrap; font-size: 15px;">${escapeHtml(analysis)}</div>
                </div>
            `;
        } else {
            throw new Error('無法生成分析');
        }
    } catch (error) {
        analysisContainer.innerHTML = `
            <div style="padding: 20px; background: rgba(229, 62, 62, 0.15); border-radius: 12px; border: 2px solid rgba(229, 62, 62, 0.5);">
                <div style="color: #dc2626; font-weight: 600; margin-bottom: 10px;">❌ 分析失敗</div>
                <div style="color: #ffffff; font-size: 14px;">${escapeHtml(error.message)}</div>
            </div>
        `;
    }
}

// 提示儲存測驗並命名（彈出模態對話框）
function promptSaveSession() {
    const accuracy = quizStats.total > 0 ? Math.round((quizStats.correct / quizStats.total) * 100) : 0;
    const score = accuracy;

    // 創建模態對話框
    const modalHTML = `
        <div class="modal-overlay" id="save-session-modal">
            <div class="modal-content">
                <div style="text-align: center; margin-bottom: 25px;">
                    <div style="font-size: 50px; margin-bottom: 15px;">🎉</div>
                    <h2 style="color: #ffffff; font-size: 24px; margin-bottom: 10px;">測驗完成!</h2>
                    <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 20px; border-radius: 12px; margin-top: 15px;">
                        <div style="font-size: 16px; color: #ffffff; margin-bottom: 5px;">本次得分</div>
                        <div style="font-size: 48px; font-weight: 700; color: #ffffff;">${score}<span style="font-size: 24px;">分</span></div>
                    </div>
                </div>

                <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; text-align: center;">
                        <div>
                            <div style="color: #4ade80; font-size: 24px; font-weight: 600;">✓ ${quizStats.correct}</div>
                            <div style="color: #ffffff; font-size: 12px; opacity: 0.8;">答對</div>
                        </div>
                        <div>
                            <div style="color: #dc2626; font-size: 24px; font-weight: 600;">✗ ${quizStats.incorrect}</div>
                            <div style="color: #ffffff; font-size: 12px; opacity: 0.8;">答錯</div>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; color: #ffffff; margin-bottom: 8px; font-size: 14px; font-weight: 600;">📝 測驗名稱：</label>
                    <input type="text" id="session-name-input" placeholder="例如：民法測驗、第一次練習..."
                        style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.3);
                        background: rgba(255, 255, 255, 0.1); color: #ffffff; font-size: 16px; outline: none;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);"
                        value="綜合測驗 ${new Date().toLocaleDateString('zh-TW')}"
                        onkeypress="if(event.key === 'Enter') saveTestSessionWithName()">
                </div>

                <div style="color: #ffffff; font-size: 13px; opacity: 0.8; margin-bottom: 20px; text-align: center;">
                    💡 提示：儲存後才能繼續練習或查看詳細記錄
                </div>

                <button class="btn btn-primary" onclick="saveTestSessionWithName()" style="width: 100%; padding: 15px; font-size: 16px;">
                    💾 確定儲存
                </button>
            </div>
        </div>
    `;

    // 插入到 body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // 自動聚焦到輸入框
    setTimeout(() => {
        const input = document.getElementById('session-name-input');
        if (input) {
            input.focus();
            input.select();
        }
    }, 100);
}

// 關閉儲存模態框
function closeSaveModal() {
    const modal = document.getElementById('save-session-modal');
    if (modal) {
        modal.remove();
    }
}

// 使用自訂名稱儲存測驗session
function saveTestSessionWithName() {
    stopQuizTimer();
    const nameInput = document.getElementById('session-name-input');
    const sessionName = nameInput ? nameInput.value.trim() : '';

    if (!sessionName) {
        showErrorToast('請輸入測驗名稱！');
        if (nameInput) nameInput.focus();
        return;
    }

    // 保存最後一題的討論記錄
    saveQuestionDiscussion();
    if (currentSessionAnswers.length > 0) {
        const lastAnswerIndex = currentSessionAnswers.length - 1;
        const questionKey = `q_${currentQuestionIndex}`;
        const discussionData = questionDiscussions[questionKey] || { history: [], importantMessages: [] };

        currentSessionAnswers[lastAnswerIndex].討論記錄 = {
            一般討論: [...discussionData.history],
            重要討論: [...discussionData.importantMessages]
        };
    }

    const sessionEndTime = new Date();
    const accuracy = quizStats.total > 0 ? Math.round((quizStats.correct / quizStats.total) * 100) : 0;

    // 獲取當前試卷的名稱和 ID
    let paperName = '未命名試卷';
    let paperId = 'unknown';

    if (currentExamPaperId) {
        const currentPaper = examPapers.find(p => p.id === currentExamPaperId);
        if (currentPaper) {
            paperName = currentPaper.name;
            paperId = currentPaper.id;
        }
    }

    const session = {
        id: Date.now(),
        類型: sessionName, // 使用使用者輸入的名稱
        試卷名稱: paperName,
        試卷ID: paperId,
        測驗時間: currentSessionStartTime.toISOString(),
        開始時間: currentSessionStartTime,
        結束時間: sessionEndTime,
        時間: currentSessionStartTime.toLocaleString('zh-TW'),
        題目數: quizStats.total,
        答對數: quizStats.correct,
        答錯數: quizStats.incorrect,
        分數: accuracy,
        正確率: accuracy,
        總耗時: quizElapsedSecs,
        答題記錄: [...currentSessionAnswers],
        AI分析: window.currentSessionAnalysis || null
    };

    testSessions.unshift(session);

    // 更新試卷的測驗信息
    if (currentExamPaperId) {
        const isCompleted = quizStats.total === questionBank.length;
        updateExamPaperTestInfo(currentExamPaperId, currentQuestionIndex, isCompleted);

        // 完成測驗後清除保存的打亂題庫和測驗狀態，節省儲存空間
        if (isCompleted) {
            const paper = examPapers.find(p => p.id === currentExamPaperId);
            if (paper) {
                delete paper.shuffledQuestionBank;
                delete paper.currentSessionState;
            }
        }
    }

    saveToStorage();
    updateHistoryDisplay();
    updateQuestionDisplay(); // 更新題庫顯示以反映新的測驗狀態

    // 關閉模態框
    closeSaveModal();

    // 顯示完整結果畫面
    showQuizCompletionScreen();

    // 顯示成功訊息
    setTimeout(() => {
        showSuccessToast(`✅ 測驗記錄「${sessionName}」已成功儲存！`);
    }, 300);
}

// 選擇性刪除相關變數
let isInDeleteMode = false;
let selectedForDeletion = new Set();

function clearHistory() {
    if (!isInDeleteMode) {
        // 進入刪除選擇模式
        isInDeleteMode = true;
        selectedForDeletion.clear();
        updateDeleteButton();
        updateHistoryDisplay();
    } else {
        // 執行刪除
        if (selectedForDeletion.size === 0) {
            showInfoToast('請先選擇要刪除的記錄');
            return;
        }

        showConfirmModal(`確定要刪除已選擇的 ${selectedForDeletion.size} 筆記錄嗎？\n\n此操作無法復原`, () => {
            testSessions = testSessions.filter(session => !selectedForDeletion.has(session.id));
            recalculateStats();
            isInDeleteMode = false;
            selectedForDeletion.clear();
            saveToStorage();
            updateDeleteButton();
            updateHistoryDisplay();
            updateStats();
            showSuccessToast('✅ 已刪除選擇的記錄');
        });
    }
}

function updateDeleteButton() {
    const btn = document.getElementById('delete-history-btn');
    if (btn) {
        if (isInDeleteMode) {
            btn.textContent = '✓ 確認刪除';
            btn.style.background = 'linear-gradient(135deg, #e53e3e, #dc2626)';
        } else {
            btn.textContent = '🗑️ 清除記錄';
            btn.style.background = '';
        }
    }

    // 在刪除模式下禁用搜尋功能
    const searchInput = document.getElementById('history-search-input');
    const startDateInput = document.getElementById('history-start-date');
    const endDateInput = document.getElementById('history-end-date');
    const searchBtn = document.querySelector('#history-search-area button');

    if (searchInput) searchInput.disabled = isInDeleteMode;
    if (startDateInput) startDateInput.disabled = isInDeleteMode;
    if (endDateInput) endDateInput.disabled = isInDeleteMode;
    if (searchBtn) searchBtn.disabled = isInDeleteMode;
}

function cancelDeleteMode() {
    isInDeleteMode = false;
    selectedForDeletion.clear();
    updateDeleteButton();
    updateHistoryDisplay();
}

function toggleSelectAll() {
    if (selectedForDeletion.size === testSessions.length) {
        // 全部取消選擇
        selectedForDeletion.clear();
    } else {
        // 全部選擇
        selectedForDeletion.clear();
        testSessions.forEach(session => selectedForDeletion.add(session.id));
    }
    updateHistoryDisplay();
}

function toggleSessionSelection(sessionId, event) {
    event.stopPropagation();
    if (selectedForDeletion.has(sessionId)) {
        selectedForDeletion.delete(sessionId);
    } else {
        selectedForDeletion.add(sessionId);
    }
    updateHistoryDisplay();
}

function recalculateStats() {
    // 從剩餘的sessions重新計算統計
    quizStats = { correct: 0, incorrect: 0, total: 0 };
    testSessions.forEach(session => {
        session.答題記錄.forEach(record => {
            quizStats.total++;
            if (record.是否正確) {
                quizStats.correct++;
            } else {
                quizStats.incorrect++;
            }
        });
    });
}

// ========== Toast 通知系統 ==========

function _showToast(message, type) {
    const styles = {
        success: { bg: 'linear-gradient(135deg, #10b981, #059669)', shadow: 'rgba(16,185,129,0.4)' },
        error:   { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', shadow: 'rgba(239,68,68,0.4)' },
        info:    { bg: 'linear-gradient(135deg, #3b82f6, #2563eb)', shadow: 'rgba(59,130,246,0.4)' },
    };
    const s = styles[type] || styles.info;
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: ${s.bg}; color: white; padding: 16px 32px;
        border-radius: 12px; font-size: 16px; font-weight: 600;
        box-shadow: 0 10px 40px ${s.shadow}; z-index: 11000;
        animation: slideDown 0.3s ease-out;
        border: 2px solid rgba(255,255,255,0.3);
        max-width: 80vw; text-align: center; white-space: pre-line;
    `;
    document.body.appendChild(toast);
    const delay = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, delay);
}

function showSuccessToast(message) { _showToast(message, 'success'); }
function showErrorToast(message)   { _showToast(message, 'error'); }
function showInfoToast(message)    { _showToast(message, 'info'); }

// ========== 通用確認 Modal ==========

let _confirmCallback = null;

function showConfirmModal(message, onConfirm, options = {}) {
    _confirmCallback = onConfirm;
    document.getElementById('confirm-modal-title').textContent = options.title ?? '確認操作';
    document.getElementById('confirm-modal-message').textContent = message;
    const okBtn = document.getElementById('confirm-modal-ok');
    okBtn.textContent = options.okText ?? '確定';
    okBtn.className = 'btn ' + (options.okClass ?? 'btn-danger');
    document.getElementById('confirm-modal').classList.add('show');
}

function confirmModalOk() {
    document.getElementById('confirm-modal').classList.remove('show');
    if (_confirmCallback) { _confirmCallback(); _confirmCallback = null; }
}

function confirmModalCancel() {
    document.getElementById('confirm-modal').classList.remove('show');
    _confirmCallback = null;
}

function updateStats() {
    const questionCountEl = document.getElementById('question-count');
    const correctCountEl = document.getElementById('correct-count');
    const incorrectCountEl = document.getElementById('incorrect-count');
    const accuracyEl = document.getElementById('accuracy');

    if (questionCountEl) questionCountEl.textContent = questionBank.length;
    if (correctCountEl) correctCountEl.textContent = quizStats.correct;
    if (incorrectCountEl) incorrectCountEl.textContent = quizStats.incorrect;

    const accuracy = quizStats.total > 0 ?
        Math.round((quizStats.correct / quizStats.total) * 100) : 0;
    if (accuracyEl) accuracyEl.textContent = accuracy + '%';
}

function saveToStorage() {
    const data = {
        questionBank: questionBank,
        quizStats: quizStats,
        currentRole: currentRole,
        answerHistory: answerHistory,
        testSessions: testSessions,
        examPapers: examPapers,
        currentExamPaperId: currentExamPaperId,
        examPaperIdCounter: examPaperIdCounter,
        roleChatHistories: roleChatHistories,
        roleMessagesHTML: roleMessagesHTML
    };
    try {
        localStorage.setItem('ai_tutor_data', JSON.stringify(data));
    } catch (e) {
        console.error('儲存失敗:', e);
        showErrorToast('⚠️ 儲存空間不足，資料可能未能儲存！\n建議匯出試卷備份。');
    }
}

function loadFromStorage() {
    const data = localStorage.getItem('ai_tutor_data');
    if (data) {
        const parsed = JSON.parse(data);
        questionBank = parsed.questionBank || [];
        quizStats = parsed.quizStats || { correct: 0, incorrect: 0, total: 0 };
        answerHistory = parsed.answerHistory || [];
        testSessions = parsed.testSessions || [];
        examPapers = parsed.examPapers || [];
        currentExamPaperId = parsed.currentExamPaperId || null;
        examPaperIdCounter = parsed.examPaperIdCounter || 1;

        // 還原各角色對話記憶
        if (parsed.roleChatHistories) {
            Object.assign(roleChatHistories, parsed.roleChatHistories);
        }
        if (parsed.roleMessagesHTML) {
            Object.assign(roleMessagesHTML, parsed.roleMessagesHTML);
        }

        if (parsed.currentRole) {
            currentRole = parsed.currentRole;
            // 更新角色卡 active 狀態
            document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
            const activeCard = document.querySelector(`[data-role="${currentRole}"]`);
            if (activeCard) activeCard.classList.add('active');
            // 更新左側角色顯示
            const display = document.querySelector('.current-role-display');
            if (display) {
                display.querySelector('.role-avatar').textContent = roles[currentRole].avatar;
                display.querySelector('.role-name').textContent = roles[currentRole].name;
            }
            // 更新手機 header
            const mobileRoleDisplay = document.getElementById('mobile-role-display');
            if (mobileRoleDisplay) {
                mobileRoleDisplay.textContent = `${roles[currentRole].avatar} ${roles[currentRole].name}`;
            }

            // 還原當前角色的對話畫面與記憶
            const messagesContainer = document.getElementById('chat-messages');
            if (messagesContainer && roleMessagesHTML[currentRole]) {
                messagesContainer.innerHTML = roleMessagesHTML[currentRole];
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            chatHistory = [...(roleChatHistories[currentRole] || [])];
        }

        updateQuestionDisplay();
        updateStats();
        updateHistoryDisplay();
    }
}

// ========== 儲存試卷 Modal ==========

let _saveExamResolve = null;

function showSaveExamModal(count, timeDisplay, batches) {
    return new Promise(resolve => {
        _saveExamResolve = resolve;

        // 組合資訊
        const infoEl = document.getElementById('save-exam-info');
        infoEl.innerHTML = '';
        const lines = [
            batches ? `📦 處理了 ${batches} 個批次` : null,
            `📝 成功提取 <strong style="color:var(--accent-primary)">${count} 題</strong>單選題`,
            `⏱️ 花費時間：${timeDisplay}`
        ];
        lines.forEach(line => {
            if (!line) return;
            const p = document.createElement('p');
            p.innerHTML = line;
            infoEl.appendChild(p);
        });

        // 預設名稱
        document.getElementById('save-exam-name').value = `試卷 ${new Date().toLocaleDateString()}`;

        // 填充舊試卷清單
        const select = document.getElementById('save-exam-select');
        select.innerHTML = '';
        const existingTab = document.querySelector('.save-exam-tab[data-mode="existing"]');
        if (examPapers.length > 0) {
            examPapers.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.name}（${p.questions.length} 題）`;
                select.appendChild(opt);
            });
            existingTab.style.display = '';
        } else {
            existingTab.style.display = 'none';
        }

        switchSaveExamTab('new');
        document.getElementById('save-exam-modal').classList.add('show');
        setTimeout(() => document.getElementById('save-exam-name').focus(), 50);
    });
}

function switchSaveExamTab(mode) {
    document.querySelectorAll('.save-exam-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.mode === mode)
    );
    document.getElementById('save-exam-panel-new').style.display = mode === 'new' ? '' : 'none';
    document.getElementById('save-exam-panel-existing').style.display = mode === 'existing' ? '' : 'none';
}

function confirmSaveExamModal() {
    const mode = document.querySelector('.save-exam-tab.active').dataset.mode;
    let result;
    if (mode === 'new') {
        let name = document.getElementById('save-exam-name').value.trim();
        if (!name) name = `試卷 ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
        result = { mode: 'new', name };
    } else {
        const select = document.getElementById('save-exam-select');
        result = { mode: 'existing', paperId: parseInt(select.value) };
    }
    document.getElementById('save-exam-modal').classList.remove('show');
    if (_saveExamResolve) { _saveExamResolve(result); _saveExamResolve = null; }
}

function cancelSaveExamModal() {
    // 顯示確認提示，而非直接關閉
    document.getElementById('save-exam-main-footer').style.display = 'none';
    document.getElementById('save-exam-cancel-confirm').style.display = '';
}

function backFromCancelConfirm() {
    document.getElementById('save-exam-cancel-confirm').style.display = 'none';
    document.getElementById('save-exam-main-footer').style.display = '';
}

function forceCloseSaveExamModal() {
    document.getElementById('save-exam-cancel-confirm').style.display = 'none';
    document.getElementById('save-exam-main-footer').style.display = '';
    document.getElementById('save-exam-modal').classList.remove('show');
    if (_saveExamResolve) { _saveExamResolve(null); _saveExamResolve = null; }
}

// ========== 試卷右鍵/長按選單 ==========

let _ctxPaperId = null;
let _longPressTimer = null;
let _longPressTriggered = false;

function showPaperContextMenu(paperId, event) {
    if (isPaperDeleteMode) return;
    event.preventDefault();
    event.stopPropagation();
    _ctxPaperId = paperId;

    const menu = document.getElementById('paper-ctx-menu');
    menu.classList.add('show');

    const x = event.clientX ?? (event.touches?.[0]?.clientX ?? 0);
    const y = event.clientY ?? (event.touches?.[0]?.clientY ?? 0);
    const menuW = 170, menuH = 92;
    const vw = window.innerWidth, vh = window.innerHeight;
    menu.style.left = (x + menuW > vw ? x - menuW : x + 4) + 'px';
    menu.style.top  = (y + menuH > vh ? y - menuH : y + 4) + 'px';

    setTimeout(() => document.addEventListener('click', hidePaperContextMenu, { once: true }), 0);
}

function hidePaperContextMenu() {
    document.getElementById('paper-ctx-menu').classList.remove('show');
}

function ctxDuplicatePaper() {
    const id = _ctxPaperId;
    hidePaperContextMenu();
    if (id !== null) duplicateExamPaper(id);
}

function ctxDeletePaper() {
    const id = _ctxPaperId;
    hidePaperContextMenu();
    if (id !== null) deleteSingleExamPaper(id);
}

function deleteSingleExamPaper(paperId) {
    const paper = examPapers.find(p => p.id === paperId);
    if (!paper) return;
    showConfirmModal(`確定要刪除試卷「${paper.name}」嗎？\n\n此操作無法復原`, () => {
        examPapers = examPapers.filter(p => p.id !== paperId);
        if (currentExamPaperId === paperId) {
            questionBank = [];
            currentExamPaperId = null;
        }
        saveToStorage();
        updateQuestionDisplay();
        updateStats();
        showSuccessToast(`🗑️ 已刪除試卷「${paper.name}」`);
    });
}

function paperLongPressStart(paperId, event) {
    if (isPaperDeleteMode) return;
    _longPressTriggered = false;
    _longPressTimer = setTimeout(() => {
        _longPressTimer = null;
        _longPressTriggered = true;
        const touch = event.touches?.[0];
        showPaperContextMenu(paperId, touch
            ? { clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {}, stopPropagation: () => {} }
            : event
        );
    }, 500);
}

function paperLongPressEnd(event) {
    if (_longPressTimer) {
        clearTimeout(_longPressTimer);
        _longPressTimer = null;
        return;
    }
    if (_longPressTriggered) {
        event.preventDefault(); // 阻止長按後的 click 觸發
        _longPressTriggered = false;
    }
}

// ========== 輸入名稱 Modal（複製試卷等通用）==========

let _nameInputResolve = null;

function showNameInputModal(title, label, defaultValue) {
    return new Promise(resolve => {
        _nameInputResolve = resolve;
        document.getElementById('name-input-title').textContent = title;
        document.getElementById('name-input-label').textContent = label;
        const field = document.getElementById('name-input-field');
        field.value = defaultValue ?? '';
        document.getElementById('name-input-modal').classList.add('show');
        setTimeout(() => { field.focus(); field.select(); }, 50);
    });
}

function confirmNameInputModal() {
    const value = document.getElementById('name-input-field').value.trim();
    document.getElementById('name-input-modal').classList.remove('show');
    if (_nameInputResolve) { _nameInputResolve(value || null); _nameInputResolve = null; }
}

function cancelNameInputModal() {
    document.getElementById('name-input-modal').classList.remove('show');
    if (_nameInputResolve) { _nameInputResolve(null); _nameInputResolve = null; }
}

// ========== 試卷管理功能 ==========

function saveExamPaper(questions, name) {
    const examPaper = {
        id: examPaperIdCounter++,
        name: name.trim(),
        questions: [...questions],
        createdTime: new Date().toISOString(),
        lastTestTime: null,
        testCount: 0,
        lastQuestionIndex: 0, // 上次測驗到第幾題
        isCompleted: false // 是否完成過完整測驗
    };

    examPapers.push(examPaper);
    currentExamPaperId = examPaper.id;
    saveToStorage();
    updateQuestionDisplay(); // 立即更新題庫顯示
}

function addToExamPaper(paperId, questions) {
    const paper = examPapers.find(p => p.id === paperId);
    if (!paper) return;
    paper.questions.push(...questions);
    currentExamPaperId = paperId;
    saveToStorage();
    updateQuestionDisplay();
}

function loadExamPaper(paperId) {
    const paper = examPapers.find(p => p.id === paperId);
    if (paper) {
        questionBank = [...paper.questions];
        currentExamPaperId = paperId;
        updateQuestionDisplay();
        updateStats();
        saveToStorage();
    }
}

function updateExamPaperTestInfo(paperId, questionIndex, isCompleted) {
    const paper = examPapers.find(p => p.id === paperId);
    if (paper) {
        paper.lastTestTime = new Date().toISOString();
        paper.testCount++;
        if (isCompleted) {
            // 完成測驗時重置進度
            paper.lastQuestionIndex = 0;
            paper.isCompleted = true;
        } else {
            paper.lastQuestionIndex = questionIndex;
        }
        saveToStorage();
    }
}

function loadExamPaperAndShowDetail(paperId) {
    const paper = examPapers.find(p => p.id === paperId);
    if (!paper) return;

    questionBank = [...paper.questions];
    currentExamPaperId = paperId;
    saveToStorage();
    updateStats();

    // 顯示題目詳情
    showExamPaperDetail(paper);
}

// 計算每題的統計數據
function calculateQuestionStats(paper) {
    const stats = {};

    // 初始化每題的統計
    paper.questions.forEach((q, index) => {
        stats[index] = {
            正確次數: 0,
            錯誤次數: 0,
            選項統計: { A: 0, B: 0, C: 0, D: 0 }
        };
    });

    // 遍歷所有測驗記錄
    testSessions.forEach(session => {
        session.答題記錄.forEach(record => {
            // 找到對應的題目索引
            const questionIndex = paper.questions.findIndex(q =>
                q.題目 === record.題目
            );

            if (questionIndex !== -1) {
                const stat = stats[questionIndex];

                // 統計正確/錯誤次數
                if (record.是否正確) {
                    stat.正確次數++;
                } else {
                    stat.錯誤次數++;
                }

                // 統計選項選擇次數
                if (record.使用者答案 && stat.選項統計[record.使用者答案] !== undefined) {
                    stat.選項統計[record.使用者答案]++;
                }
            }
        });
    });

    return stats;
}

// ========== 匯出功能 ==========
function exportPaperAsJSON(paperId) {
    const paper = examPapers.find(p => p.id === paperId);
    if (!paper) return;
    const blob = new Blob([JSON.stringify(paper.questions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${paper.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccessToast('✅ JSON 已匯出');
}

function exportPaperAsPDF(paperId) {
    const paper = examPapers.find(p => p.id === paperId);
    if (!paper) return;
    const printEl = document.getElementById('print-content');
    if (!printEl) return;

    const optionLabels = ['A', 'B', 'C', 'D'];
    let questionsHtml = paper.questions.map((q, i) => `
        <div class="print-question">
            <div class="print-q-title">${i + 1}. ${q.題目}</div>
            <div class="print-options">
                ${optionLabels.map(k => q.選項[k] ? `<div>(${k}) ${q.選項[k]}</div>` : '').join('')}
            </div>
        </div>
    `).join('');

    let answersHtml = paper.questions.map((q, i) => `
        <span>${i + 1}.${q.答案}</span>
    `).join('  ');

    printEl.innerHTML = `
        <div class="print-header">
            <h1>${paper.name}</h1>
            <p>共 ${paper.questions.length} 題　　姓名：＿＿＿＿　　班級：＿＿＿＿　　日期：＿＿＿＿</p>
        </div>
        ${questionsHtml}
        <div class="print-answer-section">
            <h2>解答</h2>
            <div class="print-answers">${answersHtml}</div>
        </div>
    `;
    window.print();
    setTimeout(() => { printEl.innerHTML = ''; }, 1000);
}

function renamePaper(paperId) {
    const paper = examPapers.find(p => p.id === paperId);
    if (!paper) return;
    document.getElementById('rename-paper-id').value = paperId;
    document.getElementById('rename-paper-input').value = paper.name;
    document.getElementById('rename-paper-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('rename-paper-input').select(), 50);
}

function confirmRenamePaper() {
    const paperId = parseInt(document.getElementById('rename-paper-id').value);
    const newName = document.getElementById('rename-paper-input').value.trim();
    if (!newName) { showErrorToast('名稱不能為空'); return; }
    const paper = examPapers.find(p => p.id === paperId);
    if (!paper) return;
    paper.name = newName;
    saveToStorage();
    document.getElementById('rename-paper-modal').style.display = 'none';
    showSuccessToast('✅ 試卷已重新命名');
    showExamPaperDetail(paper);
}

function openInlineEditQuestion(paperId, questionIndex) {
    editingQuestionKey = `${paperId}-${questionIndex}`;
    const paper = examPapers.find(p => p.id === paperId);
    if (paper) showExamPaperDetail(paper);
}

function cancelInlineEditQuestion(paperId) {
    editingQuestionKey = null;
    const paper = examPapers.find(p => p.id === paperId);
    if (paper) showExamPaperDetail(paper);
}

function saveInlineEditQuestion(paperId, questionIndex) {
    const paper = examPapers.find(p => p.id === paperId);
    if (!paper || !paper.questions[questionIndex]) return;

    const title = document.getElementById('inline-edit-title').value.trim();
    const optA = document.getElementById('inline-edit-a').value.trim();
    const optB = document.getElementById('inline-edit-b').value.trim();
    const optC = document.getElementById('inline-edit-c').value.trim();
    const optD = document.getElementById('inline-edit-d').value.trim();
    const answer = document.getElementById('inline-edit-answer').value;
    const difficulty = document.getElementById('inline-edit-difficulty').value;
    const explanation = document.getElementById('inline-edit-explanation').value.trim();

    if (!title || !optA || !optB || !optC || !optD) {
        showErrorToast('題目和四個選項不能為空');
        return;
    }

    const q = paper.questions[questionIndex];
    q.題目 = title;
    q.選項 = { A: optA, B: optB, C: optC, D: optD };
    q.答案 = answer;
    q.難度 = difficulty;
    q.詳解 = explanation;
    q.AI提供答案 = false;

    editingQuestionKey = null;
    saveToStorage();
    showSuccessToast('✅ 題目已更新');
    showExamPaperDetail(paper);
}

function showExamPaperDetail(paper) {
    const display = document.getElementById('question-display');

    // 隱藏搜尋列與刪除試卷按鈕
    const searchArea = document.getElementById('paper-search-area');
    if (searchArea) searchArea.style.display = 'none';
    const deletePaperBtn = document.getElementById('delete-paper-btn');
    if (deletePaperBtn) deletePaperBtn.style.display = 'none';
    const mergePaperBtn = document.getElementById('merge-paper-btn');
    if (mergePaperBtn) mergePaperBtn.style.display = 'none';

    // 計算統計數據
    const questionStats = calculateQuestionStats(paper);

    let html = `
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:15px;">
            <button class="btn btn-secondary" onclick="updateQuestionDisplay()" style="width: auto; padding: 10px 20px; margin: 0;">
                ← 返回試卷列表
            </button>
            <button class="btn btn-secondary" onclick="exportPaperAsJSON(${paper.id})" style="width:auto; padding:10px 16px; margin:0;">⬇️ JSON</button>
            <button class="btn btn-secondary" onclick="exportPaperAsPDF(${paper.id})" style="width:auto; padding:10px 16px; margin:0;">🖨️ 列印</button>
        </div>

        <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 15px; padding: 25px; margin-bottom: 20px;">
            <h3 style="color:#ffffff; font-size:22px; margin:0 0 15px 0; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                📄 ${paper.name}
                <button onclick="renamePaper(${paper.id})" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#94a3b8; border-radius:6px; padding:3px 10px; font-size:13px; cursor:pointer; font-weight:400;">✏️ 改名</button>
            </h3>
            <div style="color: #ffffff; font-size: 14px; line-height: 1.8;">
                🕐 創建時間: ${new Date(paper.createdTime).toLocaleString('zh-TW')}<br>
                📊 題目數量: ${paper.questions.length} 題<br>
                🔢 測驗次數: ${paper.testCount} 次<br>
                📅 上次測驗: ${paper.lastTestTime ? new Date(paper.lastTestTime).toLocaleString('zh-TW') : '尚未測驗'}
                ${paper.testCount > 0 && paper.lastQuestionIndex < paper.questions.length ? `<br>📝 進度: 第 ${paper.lastQuestionIndex} / ${paper.questions.length} 題` : ''}
            </div>

            <div style="display:flex; gap:10px; margin-top:20px; flex-wrap:wrap;">
                ${paper.testCount > 0 && paper.lastQuestionIndex < paper.questions.length && !isQuestionDeleteMode ? `<button onclick="continueExamPaper(${paper.id})" style="padding:10px 20px; border-radius:12px; border:1px solid #7c6fcd; background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; font-size:14px; font-weight:600; cursor:pointer; white-space:nowrap;">▶️ 繼續測驗</button>` : ''}
                <button id="delete-questions-btn" onclick="toggleQuestionDeleteMode(${paper.id})" style="padding:10px 20px; border-radius:12px; border:1px solid #00d4ff; background:var(--accent-gradient,linear-gradient(135deg,#00d4ff,#0080ff)); color:#fff; font-size:14px; font-weight:600; cursor:pointer; white-space:nowrap;">🗑️ 刪除題目</button>
                ${isQuestionDeleteMode ? `<button onclick="cancelQuestionDeleteMode(${paper.id})" style="padding:10px 20px; border-radius:12px; border:1px solid rgba(148,163,184,0.3); background:rgba(148,163,184,0.1); color:#fff; font-size:14px; font-weight:600; cursor:pointer; white-space:nowrap;">✕ 取消</button>` : `<button onclick="duplicateExamPaper(${paper.id})" style="padding:10px 20px; border-radius:12px; border:1px solid rgba(148,163,184,0.3); background:rgba(148,163,184,0.1); color:#fff; font-size:14px; font-weight:600; cursor:pointer; white-space:nowrap;">📋 複製試卷</button>`}
            </div>
        </div>

        <div style="margin-bottom: 15px; display: flex; gap: 10px; align-items: center;">
            <strong style="color: #ffffff;">題目列表</strong>
            <input type="text" id="paper-detail-search" placeholder="🔍 搜尋題目關鍵字..."
                style="flex: 1; max-width: 400px; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.3);
                    background: rgba(255, 255, 255, 0.1); color: #d0d0d0; font-size: 14px; outline: none;"
                oninput="filterPaperDetailQuestions(${paper.id})">
        </div>
        <div id="paper-detail-questions-container">
    `;

    paper.questions.forEach((q, i) => {
        const isSelected = selectedQuestionsForDeletion.has(i);
        const stats = questionStats[i];
        const totalAttempts = stats.正確次數 + stats.錯誤次數;
        const accuracy = totalAttempts > 0 ? Math.round((stats.正確次數 / totalAttempts) * 100) : 0;

        html += `
            <div class="question-item paper-detail-question-item" data-question-text="${escapeAttr(q.題目 + ' ' + q.選項.A + ' ' + q.選項.B + ' ' + q.選項.C + ' ' + q.選項.D)}" style="${isQuestionDeleteMode ? 'cursor: pointer;' : ''} ${isSelected ? 'background: rgba(229, 62, 62, 0.15); border: 2px solid #e53e3e;' : ''}"
                 ${isQuestionDeleteMode ? `onclick="toggleQuestionSelection(${i}, event)"` : ''}>
                <div style="display: flex; align-items: start; gap: 10px;">
                    ${isQuestionDeleteMode ? `<input type="checkbox" ${isSelected ? 'checked' : ''} onclick="toggleQuestionSelection(${i}, event)" style="margin-top: 5px; width: 20px; height: 20px; cursor: pointer;">` : ''}
                    <div style="flex: 1;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                            <div style="font-weight:700; color:#ffffff; font-size:16px;">${i + 1}. ${q.題目}${q.難度 ? `<span class="difficulty-badge difficulty-${q.難度}">${{easy:'易',medium:'中',hard:'難'}[q.難度]}</span>` : ''}</div>
                            ${!isQuestionDeleteMode ? `<button onclick="openInlineEditQuestion(${paper.id}, ${i})" style="flex-shrink:0; margin-left:10px; padding:4px 10px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#94a3b8; border-radius:6px; font-size:12px; cursor:pointer; white-space:nowrap;">✏️ 編輯題目</button>` : ''}
                        </div>

                        ${totalAttempts > 0 ? `
                            <div style="margin-top: 12px;">
                                <button onclick="toggleQuestionStats(${i}, event)" style="width: 100%; padding: 10px 12px; background: rgba(102, 126, 234, 0.2); border: 1px solid rgba(102, 126, 234, 0.4); border-radius: 8px; color: #e0e0e0; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.3s;" onmouseover="this.style.background='rgba(102, 126, 234, 0.3)'" onmouseout="this.style.background='rgba(102, 126, 234, 0.2)'">
                                    <span>📊 答題統計 (答題 ${totalAttempts} 次 · 正確率 ${accuracy}%)</span>
                                    <span id="stats-arrow-${i}" style="transition: transform 0.3s;">▼</span>
                                </button>
                                <div id="question-stats-${i}" style="display: none; margin-top: 8px; padding: 12px; background: rgba(255, 255, 255, 0.08); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.15);">
                                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px;">
                                        <div style="text-align: center;">
                                            <div style="font-size: 12px; color: #ffffff; margin-bottom: 3px; font-weight: 600;">答題次數</div>
                                            <div style="font-size: 18px; font-weight: 700; color: #ffffff;">${totalAttempts}</div>
                                        </div>
                                        <div style="text-align: center;">
                                            <div style="font-size: 12px; color: #ffffff; margin-bottom: 3px; font-weight: 600;">答對</div>
                                            <div style="font-size: 18px; font-weight: 700; color: #4ade80;">✓ ${stats.正確次數}</div>
                                        </div>
                                        <div style="text-align: center;">
                                            <div style="font-size: 12px; color: #ffffff; margin-bottom: 3px; font-weight: 600;">答錯</div>
                                            <div style="font-size: 18px; font-weight: 700; color: #f87171;">✗ ${stats.錯誤次數}</div>
                                        </div>
                                    </div>
                                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.15);">
                                        <div style="font-size: 12px; color: #ffffff; margin-bottom: 5px; font-weight: 600;">選項選擇次數</div>
                                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                                            ${['A', 'B', 'C', 'D'].map(k => {
                                                const count = stats.選項統計[k];
                                                const isCorrect = k === q.答案;
                                                return `
                                                    <div style="text-align: center; padding: 6px; background: ${isCorrect ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.06)'}; border-radius: 5px; border: 1px solid ${isCorrect ? 'rgba(74, 222, 128, 0.4)' : 'rgba(255, 255, 255, 0.1)'};">
                                                        <div style="font-size: 14px; font-weight: 700; color: ${isCorrect ? '#4ade80' : '#ffffff'};">${k}</div>
                                                        <div style="font-size: 16px; font-weight: 700; color: ${isCorrect ? '#4ade80' : '#ffffff'}; margin-top: 2px;">${count}</div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                    <div style="margin-top: 8px; text-align: center;">
                                        <span style="font-size: 13px; color: #ffffff; font-weight: 600;">正確率: </span>
                                        <span style="font-size: 18px; font-weight: 700; color: ${accuracy >= 70 ? '#4ade80' : accuracy >= 40 ? '#fbbf24' : '#f87171'};">${accuracy}%</span>
                                    </div>
                                </div>
                            </div>
                        ` : ''}

                        <div style="margin-top: 10px;">
                            ${['A', 'B', 'C', 'D'].map(k =>
                                `<div style="padding: 5px 0; ${k === q.答案 ? 'color: #4ade80; font-weight: 600;' : ''}">${k}. ${q.選項[k]}</div>`
                            ).join('')}
                        </div>
                        <div class="question-answer">
                            ✔ 答案: ${q.答案 || q.正確答案 || '?'}
                            ${q.AI提供答案 ? '<span style="margin-left: 10px; font-size: 12px; color: #fbbf24; background: rgba(251, 191, 36, 0.1); padding: 2px 6px; border-radius: 3px; border: 1px solid rgba(251, 191, 36, 0.3);">⚠️ AI提供答案，謹慎參考</span>' : ''}
                        </div>
                        ${q.詳解 ? `<div style="margin-top:10px; font-size:13px; color:#b68320;">💡 ${q.詳解}</div>` : ''}
                        ${editingQuestionKey === `${paper.id}-${i}` ? `
<div style="margin-top:14px; padding:14px; background:rgba(0,0,0,0.3); border-radius:10px; border:1px solid rgba(0,212,255,0.2);">
    <div style="font-size:13px; color:#94a3b8; margin-bottom:10px; font-weight:600;">✏️ 編輯題目內容</div>
    <div style="margin-bottom:10px;">
        <label style="display:block; color:#94a3b8; font-size:12px; margin-bottom:4px;">題目</label>
        <textarea id="inline-edit-title" rows="2" style="width:100%; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.08); color:#fff; font-size:13px; resize:vertical; box-sizing:border-box; font-family:inherit;">${(q.題目 || '').replace(/`/g, '\\`')}</textarea>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
        ${['A','B','C','D'].map(k => `
        <div>
            <label style="display:block; color:#94a3b8; font-size:12px; margin-bottom:4px;">選項 ${k}</label>
            <input type="text" id="inline-edit-${k.toLowerCase()}" value="${(q.選項?.[k] || '').replace(/"/g, '&quot;')}" style="width:100%; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.08); color:#fff; font-size:13px; box-sizing:border-box;">
        </div>`).join('')}
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
        <div>
            <label style="display:block; color:#94a3b8; font-size:12px; margin-bottom:4px;">正確答案</label>
            <select id="inline-edit-answer" style="width:100%; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:#1a1f3a; color:#fff; font-size:13px;">
                ${['A','B','C','D'].map(k => `<option value="${k}" ${q.答案 === k ? 'selected' : ''}>${k}</option>`).join('')}
            </select>
        </div>
        <div>
            <label style="display:block; color:#94a3b8; font-size:12px; margin-bottom:4px;">難度</label>
            <select id="inline-edit-difficulty" style="width:100%; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:#1a1f3a; color:#fff; font-size:13px;">
                <option value="" ${!q.難度 ? 'selected' : ''}>未標記</option>
                <option value="easy" ${q.難度 === 'easy' ? 'selected' : ''}>易</option>
                <option value="medium" ${q.難度 === 'medium' ? 'selected' : ''}>中</option>
                <option value="hard" ${q.難度 === 'hard' ? 'selected' : ''}>難</option>
            </select>
        </div>
    </div>
    <div style="margin-bottom:10px;">
        <label style="display:block; color:#94a3b8; font-size:12px; margin-bottom:4px;">詳解</label>
        <textarea id="inline-edit-explanation" rows="2" style="width:100%; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.08); color:#fff; font-size:13px; resize:vertical; box-sizing:border-box; font-family:inherit;">${(q.詳解 || '').replace(/`/g, '\\`')}</textarea>
    </div>
    <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button onclick="cancelInlineEditQuestion(${paper.id})" style="padding:8px 18px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.08); color:#fff; cursor:pointer; font-size:13px;">取消</button>
        <button onclick="saveInlineEditQuestion(${paper.id}, ${i})" style="padding:8px 18px; border-radius:8px; border:none; background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; cursor:pointer; font-size:13px; font-weight:600;">💾 儲存</button>
    </div>
</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';

    display.innerHTML = html;
}

// 切換題目統計顯示
function toggleQuestionStats(questionIndex, event) {
    event.stopPropagation();
    const statsDiv = document.getElementById(`question-stats-${questionIndex}`);
    const arrow = document.getElementById(`stats-arrow-${questionIndex}`);

    if (statsDiv && arrow) {
        if (statsDiv.style.display === 'none') {
            statsDiv.style.display = 'block';
            arrow.style.transform = 'rotate(180deg)';
        } else {
            statsDiv.style.display = 'none';
            arrow.style.transform = 'rotate(0deg)';
        }
    }
}

function filterPaperDetailQuestions(paperId) {
    const searchInput = document.getElementById('paper-detail-search');
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const items = document.querySelectorAll('.paper-detail-question-item');

    items.forEach(item => {
        const questionText = item.getAttribute('data-question-text').toLowerCase();
        if (keyword === '' || questionText.includes(keyword)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// ========== 試卷合併相關函式 ==========
function togglePaperMergeMode() {
    isPaperMergeMode = !isPaperMergeMode;
    if (isPaperMergeMode) {
        isPaperDeleteMode = false;
        selectedPapersForDeletion.clear();
    }
    selectedPapersForMerge.clear();
    updateQuestionDisplay();
}

function togglePaperForMerge(paperId, event) {
    if (event) event.stopPropagation();
    if (selectedPapersForMerge.has(paperId)) {
        selectedPapersForMerge.delete(paperId);
    } else {
        selectedPapersForMerge.add(paperId);
    }
    updateQuestionDisplay();
}

function confirmMergeSelectedPapers() {
    if (selectedPapersForMerge.size < 2) {
        showErrorToast('請至少選擇 2 份試卷');
        return;
    }
    const selectedPapers = examPapers.filter(p => selectedPapersForMerge.has(p.id));
    const newName = prompt(`將合併 ${selectedPapers.map(p => p.name).join('、')}\n\n請輸入新試卷名稱：`, `合併試卷 ${new Date().toLocaleDateString('zh-TW')}`);
    if (!newName || !newName.trim()) return;

    // 合併並去重（以題目+答案為key）
    const seen = new Map();
    selectedPapers.forEach(p => {
        p.questions.forEach(q => {
            const key = q.題目 + '||' + q.答案;
            if (!seen.has(key)) seen.set(key, q);
        });
    });
    const mergedQuestions = [...seen.values()];

    const newPaper = {
        id: examPaperIdCounter++,
        name: newName.trim(),
        questions: mergedQuestions,
        createdTime: new Date().toISOString(),
        testCount: 0,
        lastTestTime: null,
        lastQuestionIndex: 0
    };
    examPapers.unshift(newPaper);
    saveToStorage();

    isPaperMergeMode = false;
    selectedPapersForMerge.clear();
    showSuccessToast(`✅ 已合併為「${newName.trim()}」（共 ${mergedQuestions.length} 題）`);
    updateQuestionDisplay();
}

// 試卷刪除相關函數
function togglePaperDeleteMode() {
    if (!isPaperDeleteMode) {
        isPaperDeleteMode = true;
        selectedPapersForDeletion.clear();
        updatePaperDeleteButton();
        updateQuestionDisplay();
    } else {
        if (selectedPapersForDeletion.size === 0) {
            showInfoToast('請先選擇要刪除的試卷');
            return;
        }

        showConfirmModal(`確定要刪除已選擇的 ${selectedPapersForDeletion.size} 份試卷嗎？\n\n此操作無法復原`, () => {
            examPapers = examPapers.filter(paper => !selectedPapersForDeletion.has(paper.id));
            if (selectedPapersForDeletion.has(currentExamPaperId)) {
                questionBank = [];
                currentExamPaperId = null;
            }
            isPaperDeleteMode = false;
            selectedPapersForDeletion.clear();
            saveToStorage();
            updatePaperDeleteButton();
            updateQuestionDisplay();
            updateStats();
            showSuccessToast('✅ 已刪除選擇的試卷');
        });
    }
}

function updatePaperDeleteButton() {
    const btn = document.getElementById('delete-paper-btn');
    if (btn) {
        if (isPaperDeleteMode) {
            btn.textContent = '✓ 確認刪除';
            btn.style.background = 'linear-gradient(135deg, #e53e3e, #dc2626)';
        } else {
            btn.textContent = '🗑️ 刪除試卷';
            btn.style.background = '';
        }
    }

    // 在刪除模式下禁用搜尋功能
    const searchInput = document.getElementById('paper-search-input');
    const createStartInput = document.getElementById('paper-create-start');
    const createEndInput = document.getElementById('paper-create-end');
    const testStartInput = document.getElementById('paper-test-start');
    const testEndInput = document.getElementById('paper-test-end');
    const statusFilter = document.getElementById('paper-status-filter');

    if (searchInput) searchInput.disabled = isPaperDeleteMode;
    if (createStartInput) createStartInput.disabled = isPaperDeleteMode;
    if (createEndInput) createEndInput.disabled = isPaperDeleteMode;
    if (testStartInput) testStartInput.disabled = isPaperDeleteMode;
    if (testEndInput) testEndInput.disabled = isPaperDeleteMode;
    if (statusFilter) statusFilter.disabled = isPaperDeleteMode;
}

function cancelPaperDeleteMode() {
    isPaperDeleteMode = false;
    selectedPapersForDeletion.clear();
    updatePaperDeleteButton();
    updateQuestionDisplay();
}

function togglePaperSelectAll() {
    if (selectedPapersForDeletion.size === examPapers.length) {
        selectedPapersForDeletion.clear();
    } else {
        selectedPapersForDeletion.clear();
        examPapers.forEach(paper => selectedPapersForDeletion.add(paper.id));
    }
    updateQuestionDisplay();
}

function togglePaperSelection(paperId, event) {
    event.stopPropagation();
    if (selectedPapersForDeletion.has(paperId)) {
        selectedPapersForDeletion.delete(paperId);
    } else {
        selectedPapersForDeletion.add(paperId);
    }
    updateQuestionDisplay();
}

// 題目刪除相關函數
function toggleQuestionDeleteMode(paperId) {
    const paper = examPapers.find(p => p.id === paperId);
    if (!paper) return;

    if (!isQuestionDeleteMode) {
        isQuestionDeleteMode = true;
        selectedQuestionsForDeletion.clear();
        showExamPaperDetail(paper);
        updateQuestionDeleteButton();
    } else {
        if (selectedQuestionsForDeletion.size === 0) {
            showInfoToast('請先選擇要刪除的題目');
            return;
        }

        const deleteCount = selectedQuestionsForDeletion.size;
        showConfirmModal(`確定要刪除已選擇的 ${deleteCount} 題嗎？\n\n此操作無法復原`, () => {
            const indices = Array.from(selectedQuestionsForDeletion).sort((a, b) => b - a);
            indices.forEach(index => paper.questions.splice(index, 1));
            if (currentExamPaperId === paperId) {
                questionBank = [...paper.questions];
            }
            isQuestionDeleteMode = false;
            selectedQuestionsForDeletion.clear();
            saveToStorage();
            updateStats();
            showExamPaperDetail(paper);
            showSuccessToast(`✅ 已刪除 ${indices.length} 題`);
        });
    }
}

function cancelQuestionDeleteMode(paperId) {
    const paper = examPapers.find(p => p.id === paperId);
    if (!paper) return;

    isQuestionDeleteMode = false;
    selectedQuestionsForDeletion.clear();
    showExamPaperDetail(paper);
}

function updateQuestionDeleteButton() {
    const btn = document.getElementById('delete-questions-btn');
    if (btn) {
        if (isQuestionDeleteMode) {
            btn.textContent = '✓ 確認刪除';
            btn.style.background = 'linear-gradient(135deg, #e53e3e, #dc2626)';
        } else {
            btn.textContent = '🗑️ 刪除題目';
            btn.style.background = '';
        }
    }
}

function toggleQuestionSelection(index, event) {
    event.stopPropagation();
    if (selectedQuestionsForDeletion.has(index)) {
        selectedQuestionsForDeletion.delete(index);
    } else {
        selectedQuestionsForDeletion.add(index);
    }

    // 找到當前試卷並重新顯示
    const paper = examPapers.find(p => p.id === currentExamPaperId);
    if (paper) {
        showExamPaperDetail(paper);
    }
}

// 複製試卷功能
async function duplicateExamPaper(paperId) {
    const paper = examPapers.find(p => p.id === paperId);
    if (!paper) return;

    const newName = await showNameInputModal('📋 複製試卷', '請輸入新試卷名稱：', `${paper.name} (副本)`);
    if (!newName) return;

    const newPaper = {
        id: examPaperIdCounter++,
        name: newName,
        questions: JSON.parse(JSON.stringify(paper.questions)), // 深拷貝題目
        createdTime: new Date().toISOString(),
        lastTestTime: null,
        testCount: 0,
        lastQuestionIndex: 0,
        isCompleted: false
    };

    examPapers.unshift(newPaper);
    saveToStorage();
    updateQuestionDisplay();
    showSuccessToast(`✅ 已複製試卷「${newName}」`);
}

// 修改答案功能相關變數
let editingPaperId = null;
let editingQuestionIndex = null;
let selectedNewAnswer = null;

// 修改答案功能
function editQuestionAnswer(paperId, questionIndex) {
    const paper = examPapers.find(p => p.id === paperId);
    if (!paper || !paper.questions[questionIndex]) {
        showErrorToast('❌ 找不到指定的題目');
        return;
    }

    const question = paper.questions[questionIndex];

    // 保存編輯信息
    editingPaperId = paperId;
    editingQuestionIndex = questionIndex;
    selectedNewAnswer = null;

    // 填充彈出視窗內容
    document.getElementById('edit-question-text').textContent = question.題目;

    // 顯示選項
    const optionsHtml = ['A', 'B', 'C', 'D']
        .map(k => `<div style="padding: 8px 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px; margin-bottom: 6px; ${k === question.答案 ? 'border: 2px solid #4ade80;' : ''}">
            <strong>${k}.</strong> ${question.選項[k]}
        </div>`)
        .join('');
    document.getElementById('edit-question-options').innerHTML = optionsHtml;

    // 顯示當前答案
    document.getElementById('edit-current-answer').textContent = question.答案;

    // 顯示/隱藏 AI 標記
    const aiBadge = document.getElementById('edit-ai-badge');
    if (question.AI提供答案) {
        aiBadge.style.display = 'inline-block';
    } else {
        aiBadge.style.display = 'none';
    }

    // 生成答案選擇按鈕
    const choicesHtml = ['A', 'B', 'C', 'D']
        .map(k => `<button
            onclick="selectNewAnswer('${k}')"
            id="choice-btn-${k}"
            style="padding: 15px; border-radius: 10px; border: 2px solid rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.1); color: #ffffff; font-size: 18px; font-weight: 600; cursor: pointer; transition: all 0.3s; ${k === question.答案 ? 'opacity: 0.5;' : ''}"
            ${k === question.答案 ? 'disabled' : ''}>
            ${k}
        </button>`)
        .join('');
    document.getElementById('edit-answer-choices').innerHTML = choicesHtml;

    // 顯示彈出視窗
    const modal = document.getElementById('edit-answer-modal');
    if (modal) {
        modal.classList.add('show');
        // 確保視窗置中
        setTimeout(() => {
            modal.scrollTop = 0;
        }, 10);
    }
}

function selectNewAnswer(answer) {
    selectedNewAnswer = answer;

    // 移除所有按鈕的選中狀態
    ['A', 'B', 'C', 'D'].forEach(k => {
        const btn = document.getElementById(`choice-btn-${k}`);
        if (btn) {
            btn.style.background = 'rgba(255, 255, 255, 0.1)';
            btn.style.border = '2px solid rgba(255, 255, 255, 0.3)';
            btn.style.transform = 'scale(1)';
        }
    });

    // 標記選中的按鈕
    const selectedBtn = document.getElementById(`choice-btn-${answer}`);
    if (selectedBtn) {
        selectedBtn.style.background = 'rgba(74, 222, 128, 0.3)';
        selectedBtn.style.border = '2px solid #4ade80';
        selectedBtn.style.transform = 'scale(1.05)';
    }
}

function confirmEditAnswer() {
    if (!selectedNewAnswer) {
        showErrorToast('❌ 請選擇新的答案');
        return;
    }

    const paper = examPapers.find(p => p.id === editingPaperId);
    if (!paper || !paper.questions[editingQuestionIndex]) {
        showErrorToast('❌ 找不到指定的題目');
        closeEditAnswerModal();
        return;
    }

    const question = paper.questions[editingQuestionIndex];
    const oldAnswer = question.答案;
    const newAnswer = selectedNewAnswer; // 保存新答案，避免關閉視窗後變數被清空

    if (newAnswer === oldAnswer) {
        showInfoToast('答案沒有改變');
        closeEditAnswerModal();
        return;
    }

    // 更新答案
    question.答案 = newAnswer;

    // 如果原本是 AI 提供的答案，修改後標記為人工修正
    if (question.AI提供答案) {
        question.AI提供答案 = false;
    }

    // 保存更改
    saveToStorage();

    // 關閉彈出視窗
    closeEditAnswerModal();

    // 重新顯示試卷詳情
    showExamPaperDetail(paper);

    // 顯示成功提示
    showSuccessToast(`✅ 答案已更新: ${oldAnswer} → ${newAnswer}`);
}

function closeEditAnswerModal() {
    const modal = document.getElementById('edit-answer-modal');
    if (modal) {
        modal.classList.remove('show');
    }

    // 清空編輯狀態
    editingPaperId = null;
    editingQuestionIndex = null;
    selectedNewAnswer = null;
}

// 繼續測驗功能
function continueExamPaper(paperId) {
    const paper = examPapers.find(p => p.id === paperId);
    if (!paper) return;

    // 關閉可能存在的選擇彈窗
    closeExamSelectionModal();

    // 載入試卷
    questionBank = [...paper.questions];
    currentExamPaperId = paperId;

    // 使用保存的打亂題庫，如果沒有則重新打亂
    if (paper.shuffledQuestionBank && paper.shuffledQuestionBank.length > 0) {
        shuffledQuestionBank = JSON.parse(JSON.stringify(paper.shuffledQuestionBank));
    } else {
        // 如果沒有保存的打亂題庫，則重新打亂並保存
        shuffledQuestionBank = shuffleArray([...questionBank]).map(q => remapQuestionOptions(q));
        paper.shuffledQuestionBank = JSON.parse(JSON.stringify(shuffledQuestionBank));
    }

    // 設置當前題目索引為上次停止的位置
    currentQuestionIndex = paper.lastQuestionIndex || 0;

    // 恢復測驗狀態（從保存的狀態中恢復）
    if (paper.currentSessionState) {
        currentSessionAnswers = JSON.parse(JSON.stringify(paper.currentSessionState.sessionAnswers || []));
        quizStats = JSON.parse(JSON.stringify(paper.currentSessionState.stats || { correct: 0, incorrect: 0, total: 0 }));
        currentSessionStartTime = new Date(paper.currentSessionState.startTime);
        questionDiscussions = JSON.parse(JSON.stringify(paper.currentSessionState.discussions || {}));

        // 同步到 answerHistory
        answerHistory = [...currentSessionAnswers];
    } else {
        // 如果沒有保存的狀態，則初始化
        quizStats = { correct: 0, incorrect: 0, total: 0 };
        currentSessionAnswers = [];
        currentSessionStartTime = new Date();
        questionDiscussions = {};
    }

    // 切換到互動練習頁面
    switchTab('quiz');

    // 延遲一下再顯示題目，確保頁面已經切換完成
    setTimeout(() => {
        // 顯示題目
        showQuestion();
    }, 50);
}

// 試卷搜尋和過濾功能
function filterExamPapers() {
    if (isPaperDeleteMode) {
        return;
    }

    const searchInput = document.getElementById('paper-search-input');
    const createStartInput = document.getElementById('paper-create-start');
    const createEndInput = document.getElementById('paper-create-end');
    const testStartInput = document.getElementById('paper-test-start');
    const testEndInput = document.getElementById('paper-test-end');
    const statusFilter = document.getElementById('paper-status-filter');

    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const createStart = createStartInput ? createStartInput.value : '';
    const createEnd = createEndInput ? createEndInput.value : '';
    const testStart = testStartInput ? testStartInput.value : '';
    const testEnd = testEndInput ? testEndInput.value : '';
    const status = statusFilter ? statusFilter.value : 'all';

    // 如果沒有任何篩選條件，顯示所有試卷
    if (!searchTerm && !createStart && !createEnd && !testStart && !testEnd && status === 'all') {
        updateQuestionDisplay();
        return;
    }

    const display = document.getElementById('question-display');

    // 過濾試卷
    const filteredPapers = examPapers.filter(paper => {
        // 名稱搜尋
        let nameMatch = true;
        if (searchTerm) {
            nameMatch = paper.name.toLowerCase().includes(searchTerm);
        }

        // 創建時間篩選
        let createDateMatch = true;
        if (createStart || createEnd) {
            const paperDate = new Date(paper.createdTime).toISOString().split('T')[0];
            if (createStart && createEnd) {
                createDateMatch = paperDate >= createStart && paperDate <= createEnd;
            } else if (createStart) {
                createDateMatch = paperDate >= createStart;
            } else if (createEnd) {
                createDateMatch = paperDate <= createEnd;
            }
        }

        // 測驗時間篩選
        let testDateMatch = true;
        if (testStart || testEnd) {
            if (!paper.lastTestTime) {
                testDateMatch = false;
            } else {
                const testDate = new Date(paper.lastTestTime).toISOString().split('T')[0];
                if (testStart && testEnd) {
                    testDateMatch = testDate >= testStart && testDate <= testEnd;
                } else if (testStart) {
                    testDateMatch = testDate >= testStart;
                } else if (testEnd) {
                    testDateMatch = testDate <= testEnd;
                }
            }
        }

        // 狀態篩選
        let statusMatch = true;
        if (status !== 'all') {
            if (status === 'untested') {
                statusMatch = paper.testCount === 0;
            } else if (status === 'in-progress') {
                statusMatch = paper.lastQuestionIndex > 0 && paper.lastQuestionIndex < paper.questions.length;
            } else if (status === 'tested') {
                statusMatch = paper.testCount > 0 && (paper.lastQuestionIndex === 0 || paper.lastQuestionIndex >= paper.questions.length);
            }
        }

        return nameMatch && createDateMatch && testDateMatch && statusMatch;
    });

    // 如果沒有符合的結果
    if (filteredPapers.length === 0) {
        let filterDesc = '';
        if (searchTerm) filterDesc += `關鍵字「${searchTerm}」`;
        if (createStart || createEnd) {
            if (filterDesc) filterDesc += '、';
            if (createStart && createEnd) {
                filterDesc += `創建時間 ${createStart} ~ ${createEnd}`;
            } else if (createStart) {
                filterDesc += `${createStart} 之後創建`;
            } else if (createEnd) {
                filterDesc += `${createEnd} 之前創建`;
            }
        }
        if (testStart || testEnd) {
            if (filterDesc) filterDesc += '、';
            if (testStart && testEnd) {
                filterDesc += `測驗時間 ${testStart} ~ ${testEnd}`;
            } else if (testStart) {
                filterDesc += `${testStart} 之後測驗`;
            } else if (testEnd) {
                filterDesc += `${testEnd} 之前測驗`;
            }
        }
        if (status !== 'all') {
            if (filterDesc) filterDesc += '、';
            const statusText = status === 'untested' ? '未測驗' : status === 'completed' ? '已完成' : '測驗中';
            filterDesc += `狀態:${statusText}`;
        }

        display.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ffffff;">
                <div style="font-size: 48px; margin-bottom: 20px;">🔍</div>
                <p>找不到符合條件的試卷</p>
                <p style="font-size: 14px; color: #ffffff; margin-top: 10px;">${filterDesc}</p>
                <p style="font-size: 14px; color: #ffffff; margin-top: 5px;">請嘗試其他條件</p>
            </div>
        `;
        return;
    }

    // 顯示過濾後的結果
    // 暫時替換examPapers來顯示
    const originalPapers = examPapers;
    examPapers = filteredPapers;
    updateQuestionDisplay();
    examPapers = originalPapers;
}

function clearPaperSearch() {
    const searchInput = document.getElementById('paper-search-input');
    const createStartInput = document.getElementById('paper-create-start');
    const createEndInput = document.getElementById('paper-create-end');
    const testStartInput = document.getElementById('paper-test-start');
    const testEndInput = document.getElementById('paper-test-end');
    const statusFilter = document.getElementById('paper-status-filter');

    if (searchInput) searchInput.value = '';
    if (createStartInput) createStartInput.value = '';
    if (createEndInput) createEndInput.value = '';
    if (testStartInput) testStartInput.value = '';
    if (testEndInput) testEndInput.value = '';
    if (statusFilter) statusFilter.value = 'all';

    updateQuestionDisplay();
}

function toggleSidebar() {
    const sidebar = document.getElementById('mobile-sidebar');
    sidebar.classList.toggle('show');
}

function toggleLeftPanel() {
    const leftPanel = document.getElementById('mobile-sidebar');
    const container = document.querySelector('.container');

    leftPanel.classList.toggle('collapsed');
    container.classList.toggle('left-collapsed');
}

function handleClosePanel() {
    // 檢查螢幕寬度，決定使用哪個函數
    if (window.innerWidth <= 900) {
        // 手機版：關閉彈出式選單
        toggleSidebar();
    } else {
        // 桌面版：收起左側面板
        toggleLeftPanel();
    }
}

// 編輯測驗記錄名稱
function editSessionName(sessionId) {
    const session = testSessions.find(s => s.id === sessionId);
    if (!session) return;

    const newName = prompt('請輸入新的測驗名稱:', session.類型);

    if (newName === null) {
        // 使用者取消
        return;
    }

    if (!newName.trim()) {
        showErrorToast('測驗名稱不可為空！');
        return;
    }

    // 更新名稱
    session.類型 = newName.trim();
    saveToStorage();

    // 重新顯示詳細頁面
    showSessionDetail(sessionId);

    // 顯示成功訊息
    showSuccessToast(`✅ 測驗名稱已更新為「${newName.trim()}」`);
}

// 搜尋答題記錄
function filterHistory() {
    // 在刪除模式下禁用搜尋
    if (isInDeleteMode) {
        return;
    }

    const searchInput = document.getElementById('history-search-input');
    const startDateInput = document.getElementById('history-start-date');
    const endDateInput = document.getElementById('history-end-date');

    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const startDate = startDateInput ? startDateInput.value : '';
    const endDate = endDateInput ? endDateInput.value : '';

    // 如果沒有任何篩選條件，顯示所有記錄
    if (!searchTerm && !startDate && !endDate) {
        updateHistoryDisplay();
        return;
    }

    const display = document.getElementById('history-display');

    // 檢查是否有測驗記錄
    if (testSessions.length === 0) {
        display.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ffffff;">
                <div style="font-size: 48px; margin-bottom: 20px;">📝</div>
                <p>尚無測驗記錄</p>
                <p style="font-size: 14px; color: #ffffff; margin-top: 10px;">完成測驗後點擊「儲存記錄」即可保存</p>
            </div>
        `;
        return;
    }

    // 過濾符合搜尋條件的記錄
    const filteredSessions = testSessions.filter(session => {
        // 名稱搜尋
        let nameMatch = true;
        if (searchTerm) {
            nameMatch = session.類型.toLowerCase().includes(searchTerm);
        }

        // 日期範圍篩選
        let dateMatch = true;
        if (startDate || endDate) {
            // 將開始時間轉換為日期字串 (YYYY-MM-DD)
            const sessionDate = new Date(session.開始時間);
            const sessionDateStr = sessionDate.toISOString().split('T')[0];

            if (startDate && endDate) {
                // 有開始和結束日期
                dateMatch = sessionDateStr >= startDate && sessionDateStr <= endDate;
            } else if (startDate) {
                // 只有開始日期
                dateMatch = sessionDateStr >= startDate;
            } else if (endDate) {
                // 只有結束日期
                dateMatch = sessionDateStr <= endDate;
            }
        }

        return nameMatch && dateMatch;
    });

    // 如果沒有符合的結果
    if (filteredSessions.length === 0) {
        let filterDesc = '';
        if (searchTerm) filterDesc += `關鍵字「${searchTerm}」`;
        if (startDate || endDate) {
            if (filterDesc) filterDesc += '、';
            if (startDate && endDate) {
                filterDesc += `日期範圍 ${startDate} ~ ${endDate}`;
            } else if (startDate) {
                filterDesc += `${startDate} 之後`;
            } else if (endDate) {
                filterDesc += `${endDate} 之前`;
            }
        }

        display.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ffffff;">
                <div style="font-size: 48px; margin-bottom: 20px;">🔍</div>
                <p>找不到符合條件的記錄</p>
                <p style="font-size: 14px; color: #ffffff; margin-top: 10px;">${filterDesc}</p>
                <p style="font-size: 14px; color: #ffffff; margin-top: 5px;">請嘗試其他條件</p>
            </div>
        `;
        return;
    }

    // 顯示過濾後的結果
    let filterInfo = [];
    if (searchTerm) filterInfo.push(`關鍵字「${searchTerm}」`);
    if (startDate && endDate) {
        filterInfo.push(`${startDate} ~ ${endDate}`);
    } else if (startDate) {
        filterInfo.push(`${startDate} 之後`);
    } else if (endDate) {
        filterInfo.push(`${endDate} 之前`);
    }

    let html = `<div style="margin-bottom: 15px; padding: 10px; background: rgba(102, 126, 234, 0.2); border-radius: 8px; border: 1px solid rgba(102, 126, 234, 0.4);">
        <div style="color: #ffffff; font-size: 14px;">
            🔍 搜尋結果：找到 <strong>${filteredSessions.length}</strong> 筆記錄
            ${filterInfo.length > 0 ? `<span style="opacity: 0.8; margin-left: 10px;">(${filterInfo.join('、')})</span>` : ''}
        </div>
    </div>`;

    html += '<div style="display: flex; flex-direction: column; gap: 15px;">';
    filteredSessions.forEach(session => { html += renderSessionCard(session); });
    html += '</div>';
    display.innerHTML = html;
}

// 清除搜尋
function clearHistorySearch() {
    const searchInput = document.getElementById('history-search-input');
    const startDateInput = document.getElementById('history-start-date');
    const endDateInput = document.getElementById('history-end-date');

    if (searchInput) {
        searchInput.value = '';
    }
    if (startDateInput) {
        startDateInput.value = '';
    }
    if (endDateInput) {
        endDateInput.value = '';
    }

    updateHistoryDisplay();
}

// ========== 題目生成功能 ==========

// 更新生成模式顯示
function updateGenerateMode() {
    const mode = document.getElementById('generate-mode').value;
    const countSection = document.getElementById('ai-count-section');
    const buttonText = document.getElementById('generate-button-text');

    if (mode === 'ai') {
        countSection.style.display = 'block';
        buttonText.textContent = '✨ 開始生成題目';
    } else {
        countSection.style.display = 'none';
        buttonText.textContent = '📋 合成錯題試卷';
    }
}

// 更新錯題清單顯示（所有模式都按考卷分類）
function updateWrongQuestionsList() {
    const source = document.getElementById('generate-source').value;
    const listContainer = document.getElementById('wrong-questions-list');

    // 根據選擇的模式獲取錯題
    let wrongQuestionsByPaper = {};
    let showCheckbox = false; // 是否顯示勾選框

    if (source === 'all') {
        wrongQuestionsByPaper = getWrongQuestionsByPaper();
        showCheckbox = false; // 所有錯題模式：只顯示，不可勾選
    } else if (source === 'recent') {
        wrongQuestionsByPaper = getRecentWrongQuestionsByPaper();
        showCheckbox = false; // 最近一次模式：只顯示，不可勾選
    } else if (source === 'custom') {
        wrongQuestionsByPaper = getWrongQuestionsByPaper();
        showCheckbox = true; // 自訂模式：可勾選
    }

    if (Object.keys(wrongQuestionsByPaper).length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #d0d0d0;">
                尚無錯題記錄
            </div>
        `;
        return;
    }

    // 按考卷分類顯示錯題
    let html = '';
    Object.entries(wrongQuestionsByPaper).forEach(([paperName, data]) => {
        const paperId = data.paperId;
        const questions = data.questions;
        const wrongCount = questions.length;

        html += `
            <div style="margin-bottom: 15px; background: rgba(255, 255, 255, 0.05); border-radius: 10px;
                padding: 12px; border: 1px solid rgba(255, 255, 255, 0.15);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; cursor: pointer;"
                    onclick="togglePaperQuestionsView('${paperId}')">
                    ${showCheckbox ? `
                        <input type="checkbox" class="paper-checkbox" data-paper-id="${paperId}"
                            onclick="event.stopPropagation(); togglePaperQuestions(this)"
                            style="margin-right: 10px; width: 20px; height: 20px; cursor: pointer; flex-shrink: 0;">
                    ` : ''}
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #ffffff; font-size: 15px;">
                            📋 ${paperName}
                        </div>
                        <div style="font-size: 12px; color: #d0d0d0; margin-top: 2px;">
                            共 ${wrongCount} 題錯題
                        </div>
                    </div>
                    <div style="color: #667eea; font-size: 12px; margin-left: 10px;">
                        <span class="toggle-icon" data-paper-id="${paperId}">▼ 展開</span>
                    </div>
                </div>

                <div class="paper-questions" data-paper-id="${paperId}" style="display: none;
                    padding-left: ${showCheckbox ? '30px' : '10px'}; margin-top: 8px; border-left: 2px solid rgba(102, 126, 234, 0.3);">
        `;

        questions.forEach((item, qIndex) => {
            html += `
                <div style="padding: 8px; margin-bottom: 6px; background: rgba(255, 255, 255, 0.03);
                    border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1);">
                    <div style="display: flex; align-items: start;">
                        ${showCheckbox ? `
                            <input type="checkbox" class="wrong-question-checkbox"
                                data-paper-id="${paperId}" data-q-index="${qIndex}"
                                style="margin-right: 10px; margin-top: 4px; width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;">
                        ` : ''}
                        <div style="flex: 1; color: #ffffff;">
                            <div style="font-size: 14px; margin-bottom: 4px;">${item.question.題目}</div>
                            <div style="font-size: 11px; color: #b0b0b0;">
                                錯誤次數: ${item.wrongCount} 次 | 正確答案: ${item.question.正確答案}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = html;
}

// 切換考卷題目展開/收起（純顯示）
function togglePaperQuestionsView(paperId) {
    const questionsDiv = document.querySelector(`.paper-questions[data-paper-id="${paperId}"]`);
    const toggleIcon = document.querySelector(`.toggle-icon[data-paper-id="${paperId}"]`);

    if (questionsDiv.style.display === 'none') {
        questionsDiv.style.display = 'block';
        toggleIcon.textContent = '▲ 收起';
    } else {
        questionsDiv.style.display = 'none';
        toggleIcon.textContent = '▼ 展開';
    }
}

// 切換考卷下的題目顯示
function togglePaperQuestions(checkbox) {
    const paperId = checkbox.dataset.paperId;
    const questionsDiv = document.querySelector(`.paper-questions[data-paper-id="${paperId}"]`);
    const questionCheckboxes = questionsDiv.querySelectorAll('.wrong-question-checkbox');

    if (checkbox.checked) {
        questionsDiv.style.display = 'block';
        // 全選該考卷下的所有題目
        questionCheckboxes.forEach(cb => cb.checked = true);
    } else {
        questionsDiv.style.display = 'none';
        // 取消選擇該考卷下的所有題目
        questionCheckboxes.forEach(cb => cb.checked = false);
    }
}

// 獲取按考卷分類的錯題（所有測驗記錄，按測驗次數分開）
function getWrongQuestionsByPaper() {
    const wrongQuestionsByPaper = {};

    console.log('📊 開始分析測驗記錄，總共有', testSessions.length, '個測驗記錄');

    // 遍歷所有測驗記錄，每次測驗都分開顯示
    testSessions.forEach((session, sessionIndex) => {
        const paperName = session.試卷名稱 || '未命名試卷';
        const paperId = session.試卷ID || 'unknown';
        const testTime = session.測驗時間 || (session.開始時間 instanceof Date ? session.開始時間.toISOString() : session.開始時間) || new Date().toISOString();
        const testDate = new Date(testTime);
        const dateStr = `${testDate.getMonth() + 1}/${testDate.getDate()} ${testDate.getHours().toString().padStart(2, '0')}:${testDate.getMinutes().toString().padStart(2, '0')}`;

        console.log(`  測驗 ${sessionIndex + 1}:`, paperName, '時間:', dateStr, '答題記錄數:', session.答題記錄?.length || 0);

        // 每次測驗都建立一個獨立的分類（試卷名稱 + 測驗時間）
        const uniqueKey = `${paperName} (${dateStr})`;

        const wrongQuestionsMap = new Map();

        session.答題記錄.forEach(record => {
            if (!record.是否正確) {
                const key = record.題目;

                if (wrongQuestionsMap.has(key)) {
                    wrongQuestionsMap.get(key).wrongCount++;
                } else {
                    wrongQuestionsMap.set(key, {
                        question: {
                            題目: record.題目,
                            選項: record.選項,
                            正確答案: record.正確答案
                        },
                        wrongCount: 1
                    });
                }
            }
        });

        // 如果這次測驗有錯題，就加入
        if (wrongQuestionsMap.size > 0) {
            wrongQuestionsByPaper[uniqueKey] = {
                paperId: `${paperId}_${sessionIndex}`,
                questions: Array.from(wrongQuestionsMap.values())
            };
            console.log(`    ✓ 找到 ${wrongQuestionsMap.size} 題錯題`);
        } else {
            console.log(`    ✗ 沒有錯題`);
        }
    });

    console.log('📊 分析完成，共找到', Object.keys(wrongQuestionsByPaper).length, '個測驗記錄有錯題');
    return wrongQuestionsByPaper;
}

// 獲取最近一次測驗的錯題（按考卷分類）
function getRecentWrongQuestionsByPaper() {
    if (testSessions.length === 0) return {};

    const recentSession = testSessions[0]; // 最新的記錄在索引0（unshift添加）
    const paperName = recentSession.試卷名稱 || '未命名試卷';
    const paperId = recentSession.試卷ID || 'unknown';

    const wrongQuestionsByPaper = {};
    const wrongQuestionsMap = new Map();

    recentSession.答題記錄.forEach(record => {
        if (!record.是否正確) {
            const key = record.題目;

            if (wrongQuestionsMap.has(key)) {
                wrongQuestionsMap.get(key).wrongCount++;
            } else {
                wrongQuestionsMap.set(key, {
                    question: {
                        題目: record.題目,
                        選項: record.選項,
                        正確答案: record.正確答案
                    },
                    wrongCount: 1
                });
            }
        }
    });

    if (wrongQuestionsMap.size > 0) {
        wrongQuestionsByPaper[paperName] = {
            paperId: paperId,
            questions: Array.from(wrongQuestionsMap.values())
        };
    }

    return wrongQuestionsByPaper;
}

// 獲取所有錯題（根據答題記錄統計）
function getAllWrongQuestions() {
    const wrongQuestionsMap = new Map();

    // 遍歷所有測驗記錄
    testSessions.forEach(session => {
        session.答題記錄.forEach(record => {
            if (!record.是否正確) {
                // 使用題目內容作為唯一標識
                const key = record.題目;

                if (wrongQuestionsMap.has(key)) {
                    wrongQuestionsMap.get(key).wrongCount++;
                } else {
                    wrongQuestionsMap.set(key, {
                        question: {
                            題目: record.題目,
                            選項: record.選項,
                            正確答案: record.正確答案
                        },
                        wrongCount: 1
                    });
                }
            }
        });
    });

    // 轉換為陣列並按錯誤次數排序
    return Array.from(wrongQuestionsMap.values())
        .sort((a, b) => b.wrongCount - a.wrongCount);
}

// 開始生成題目
async function startGenerateQuestions() {
    if (!currentUser) { openLoginModal('feature'); return; }
    const source = document.getElementById('generate-source').value;
    const mode = document.getElementById('generate-mode').value;
    const count = parseInt(document.getElementById('generate-count').value);
    const paperName = document.getElementById('generate-paper-name').value.trim();

    // 驗證輸入
    if (!paperName) {
        showErrorToast('請輸入試卷名稱');
        return;
    }

    if (mode === 'ai' && (count < 1 || count > 50)) {
        showErrorToast('生成題數必須在 1-50 之間');
        return;
    }

    // 獲取要分析的錯題
    let wrongQuestions = [];

    if (source === 'all') {
        wrongQuestions = getAllWrongQuestions();
    } else if (source === 'recent') {
        wrongQuestions = getRecentWrongQuestions();
    } else if (source === 'custom') {
        wrongQuestions = getSelectedWrongQuestions();
    }

    if (wrongQuestions.length === 0) {
        showInfoToast('沒有可分析的錯題記錄');
        return;
    }

    // 根據模式執行不同操作
    if (mode === 'ai') {
        // AI 生成相似題目
        await generateQuestionsWithAI(wrongQuestions, count, paperName);
    } else {
        // 直接合成錯題試卷
        createDirectWrongQuestionsPaper(wrongQuestions, paperName);
    }
}

// 直接合成錯題試卷
function createDirectWrongQuestionsPaper(wrongQuestions, paperName) {
    if (wrongQuestions.length === 0) {
        showInfoToast('沒有錯題可以合成');
        return;
    }

    // 將錯題轉換為試卷格式（統一欄位：正確答案 → 答案）
    const questions = wrongQuestions.map(item => {
        const q = { ...item.question };
        if (!q.答案 && q.正確答案) q.答案 = q.正確答案;
        return q;
    });

    // 創建新試卷
    const newPaper = {
        id: examPaperIdCounter++,
        name: paperName,
        questions: questions,
        createdTime: new Date().toISOString(),
        testCount: 0,
        lastTestTime: null,
        lastQuestionIndex: 0
    };

    examPapers.unshift(newPaper);
    saveToStorage();

    // 顯示結果
    const resultDiv = document.getElementById('generate-result');
    const resultText = document.getElementById('generate-result-text');

    resultDiv.style.display = 'block';
    resultText.innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <div style="font-size: 48px; margin-bottom: 15px;">✅</div>
            <div style="font-size: 18px; font-weight: 600; color: #10b981; margin-bottom: 10px;">
                錯題試卷合成成功！
            </div>
            <div style="color: #d0d0d0; font-size: 14px; margin-bottom: 20px;">
                已將 ${questions.length} 題錯題合成為試卷「${paperName}」
            </div>
            <button class="btn btn-primary" onclick="switchTab('questions')" style="margin-right: 10px;">
                📚 查看試卷
            </button>
            <button class="btn btn-secondary" onclick="location.reload()">
                ✨ 繼續生成
            </button>
        </div>
    `;

    // 自動切換到題庫檢視頁面
    setTimeout(() => {
        switchTab('questions');
        updateQuestionDisplay();
    }, 2000);
}

// 獲取最近一次測驗的錯題
function getRecentWrongQuestions() {
    if (testSessions.length === 0) return [];

    const recentSession = testSessions[0]; // 最新的記錄在索引0（unshift添加）
    const wrongQuestionsMap = new Map();

    recentSession.答題記錄.forEach(record => {
        if (!record.是否正確) {
            const key = record.題目;
            wrongQuestionsMap.set(key, {
                question: {
                    題目: record.題目,
                    選項: record.選項,
                    正確答案: record.正確答案
                },
                wrongCount: 1
            });
        }
    });

    return Array.from(wrongQuestionsMap.values());
}

// 獲取用戶選擇的錯題（新版：按考卷分類）
function getSelectedWrongQuestions() {
    const wrongQuestionsByPaper = getWrongQuestionsByPaper();
    const checkboxes = document.querySelectorAll('.wrong-question-checkbox:checked');

    const selected = [];
    checkboxes.forEach(checkbox => {
        const paperId = checkbox.dataset.paperId;
        const qIndex = parseInt(checkbox.dataset.qIndex);

        // 找到對應的考卷和題目
        Object.entries(wrongQuestionsByPaper).forEach(([paperName, data]) => {
            if (data.paperId === paperId && data.questions[qIndex]) {
                selected.push(data.questions[qIndex]);
            }
        });
    });

    return selected;
}

// 生成單批題目（最多20題）
async function generateQuestionsBatch(wrongQuestions, count) {
    // 準備錯題資訊
    const wrongQuestionsInfo = wrongQuestions.slice(0, 10).map((item, index) => {
        return `題目 ${index + 1}:
題目: ${item.question.題目}
選項: ${Object.entries(item.question.選項).map(([key, val]) => `${key}. ${val}`).join(', ')}
正確答案: ${item.question.正確答案}
錯誤次數: ${item.wrongCount}`;
    }).join('\n\n');

    // 構建 AI prompt
    const prompt = `你是一位專業且嚴謹的出題老師。請根據以下學生答錯的題目，分析其題型、考點和難度，然後生成 ${count} 道相似的新題目。

【學生的錯題】
${wrongQuestionsInfo}

【核心要求 - 必須嚴格遵守】
⚠️ 重要：必須生成完整的 ${count} 道題目，一題都不能少！
1. 生成 ${count} 道題目，每題必須是選擇題（ABCD四個選項）
2. 題型和考點要與錯題相似，但內容必須完全不同
3. 難度要與原題相當
4. ⚠️【必填】每題都必須有「正確答案」欄位，值必須是 A、B、C、D 其中一個
5. 必須使用繁體中文（台灣用語）
6. 詳解要簡短（20字以內），節省輸出空間

【準確性要求 - 極為重要】
⚠️ 題目內容必須符合事實、邏輯嚴謹
⚠️ 正確答案必須經過嚴格驗證，確保無誤
⚠️ 錯誤選項要有干擾性，但不能是正確答案
⚠️ 所有數據、概念、定義必須準確無誤
⚠️ 避免模稜兩可的表述，題目描述要清晰明確
⚠️【必填欄位檢查】每題必須包含：題目、選項(A/B/C/D)、正確答案、詳解

【輸出格式 - 所有欄位都是必填】
請嚴格按照以下 JSON 格式輸出，不要有任何其他文字。
⚠️ 特別注意：「正確答案」欄位是必填的，絕對不能遺漏！
必須包含全部 ${count} 題，每題都必須有以下完整結構：

[
  {
    "題目": "題目內容（必填）",
    "選項": {
      "A": "選項A內容（必填）",
      "B": "選項B內容（必填）",
      "C": "選項C內容（必填）",
      "D": "選項D內容（必填）"
    },
    "正確答案": "A（必填，只能是A/B/C/D其中一個）",
    "詳解": "簡短說明（必填）"
  }
]

【最終檢查清單】
生成完畢後，請自我檢查：
✓ 是否生成了完整的 ${count} 道題目？
✓ 每題是否都有「題目」欄位？
✓ 每題是否都有「選項」欄位，且包含A、B、C、D四個選項？
✓ ⚠️ 每題是否都有「正確答案」欄位，且值為A/B/C/D其中一個？
✓ 每題是否都有「詳解」欄位？

再次提醒：必須完整生成 ${count} 道題目，且每題都必須包含「正確答案」欄位！`;

    // 呼叫 AI API
    const estimatedTokens = Math.min(count * 400 + 1000, 32000);

    const response = await fetchWithProxyFallback(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ai-tutor.app',
            'X-Title': 'AI Tutor'
        },
        body: JSON.stringify({
            model: AI_MODEL,
            messages: [
                { role: 'system', content: `你是一位專業且嚴謹的出題老師，擅長根據學生的錯題生成相似的練習題。

【你的核心任務】
1. 確保題目與答案的準確性，絕不容許任何錯誤或模稜兩可的內容
2. ⚠️ 每題必須包含完整的四個欄位：「題目」、「選項」(A/B/C/D)、「正確答案」(A/B/C/D其中一個)、「詳解」
3. ⚠️ 特別注意：「正確答案」欄位是必填的，絕對不能遺漏或留空
4. 使用繁體中文（台灣用語）
5. 對每道題目進行嚴格的邏輯與事實檢查
6. 必須生成完整的 ${count} 道題目，一題都不能少

【輸出檢查】
生成後請自我檢查每一題是否都有「正確答案」欄位，如果沒有請立即補上！` },
                { role: 'user', content: prompt }
            ],
            max_tokens: estimatedTokens,
            temperature: 0.5
        })
    });

    if (!response.ok) {
        throw new Error(`API 請求失敗: ${response.status}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0]) {
        throw new Error('AI 回應格式錯誤');
    }

    const aiResponse = data.choices[0].message.content;
    console.log('📝 AI 原始回應:', aiResponse);

    // 解析 AI 生成的題目
    const generatedQuestions = extractJSONArray(aiResponse);
    console.log('📋 解析後的題目數量:', generatedQuestions?.length || 0);

    if (!generatedQuestions || generatedQuestions.length === 0) {
        throw new Error('無法解析 AI 生成的題目');
    }

    // 驗證和修正題目格式
    const validQuestions = [];
    let invalidCount = 0;
    const invalidReasons = [];

    generatedQuestions.forEach((q, index) => {
        let isValid = true;
        let reason = '';

        // 檢查題目欄位
        if (!q.題目 || typeof q.題目 !== 'string' || q.題目.trim() === '') {
            isValid = false;
            reason = '缺少或無效的「題目」欄位';
        }

        // 檢查選項欄位
        if (isValid && (!q.選項 || typeof q.選項 !== 'object')) {
            isValid = false;
            reason = '缺少或無效的「選項」欄位';
        }

        // 檢查選項數量和內容
        if (isValid) {
            const optionKeys = Object.keys(q.選項);
            if (optionKeys.length !== 4) {
                isValid = false;
                reason = `選項數量不正確（${optionKeys.length}個，應為4個）`;
            } else if (!optionKeys.includes('A') || !optionKeys.includes('B') || !optionKeys.includes('C') || !optionKeys.includes('D')) {
                isValid = false;
                reason = '選項必須包含A、B、C、D';
            }
        }

        // 檢查正確答案欄位（最重要！）
        if (isValid && (!q.正確答案 || typeof q.正確答案 !== 'string' || q.正確答案.trim() === '')) {
            isValid = false;
            reason = '❌ 缺少「正確答案」欄位或值為空（這是最常見的錯誤！）';
        }

        // 檢查正確答案是否在選項中
        if (isValid && !q.選項[q.正確答案]) {
            isValid = false;
            reason = `正確答案「${q.正確答案}」不在選項中`;
        }

        // 檢查詳解欄位（可選但建議有）
        if (isValid && !q.詳解) {
            q.詳解 = ''; // 自動補上空字串
        }

        if (isValid) {
            validQuestions.push(q);
        } else {
            invalidCount++;
            invalidReasons.push({ index: index + 1, reason, data: q });
            console.error(`❌ 題目 ${index + 1} 無效：${reason}`);
            console.log('完整題目資料:', JSON.stringify(q, null, 2));
        }
    });

    console.log(`✅ AI生成 ${generatedQuestions.length} 題，驗證通過 ${validQuestions.length} 題，無效 ${invalidCount} 題`);
    console.log(`📊 有效率: ${((validQuestions.length / count) * 100).toFixed(1)}%`);

    // 如果有無效題目，顯示詳細統計
    if (invalidCount > 0) {
        console.warn(`\n📋 無效題目統計：`);
        const reasonStats = {};
        invalidReasons.forEach(item => {
            reasonStats[item.reason] = (reasonStats[item.reason] || 0) + 1;
        });
        Object.entries(reasonStats).forEach(([reason, count]) => {
            console.warn(`  • ${reason}: ${count} 題`);
        });
        console.log(`🗑️ 已自動刪除這 ${invalidCount} 題無效題目\n`);
    }

    if (validQuestions.length === 0) {
        throw new Error('生成的題目格式全部不正確，請檢查 AI 設定');
    }

    // 如果題目數量不足，自動補充生成
    if (validQuestions.length < count) {
        const shortage = count - validQuestions.length;
        console.warn(`⚠️ 本批次目標 ${count} 題，實際有效 ${validQuestions.length} 題，短少 ${shortage} 題`);
        console.log(`🔄 正在自動補充生成 ${shortage} 題（已刪除無效題目）...\n`);

        try {
            // 遞迴呼叫自己來補充不足的題目
            const 補充Questions = await generateQuestionsBatch(wrongQuestions, shortage);
            validQuestions.push(...補充Questions);
            console.log(`\n✅ 補充完成！本批次最終生成 ${validQuestions.length} 題（目標 ${count} 題）`);
        } catch (error) {
            console.error('❌ 自動補充失敗:', error);
            console.log(`⚠️ 將使用目前已生成的 ${validQuestions.length} 題`);
        }
    } else {
        console.log(`✅ 本批次完成！成功生成 ${validQuestions.length} 題（目標 ${count} 題）`);
    }

    // 轉換欄位名稱
    return validQuestions.map(q => ({
        題目: q.題目,
        選項: q.選項,
        答案: q.正確答案,
        詳解: q.詳解 || '',
        AI提供答案: false
    }));
}

// 使用 AI 生成題目
async function generateQuestionsWithAI(wrongQuestions, count, paperName) {
    const statusDiv = document.getElementById('generate-status');
    const statusText = document.getElementById('generate-status-text');
    const statusCount = document.getElementById('generate-status-count');
    const progressFill = document.getElementById('generate-progress-fill');
    const resultDiv = document.getElementById('generate-result');
    const resultText = document.getElementById('generate-result-text');

    // 顯示狀態
    statusDiv.style.display = 'block';
    resultDiv.style.display = 'none';
    progressFill.style.width = '0%';
    progressFill.classList.add('progress-pulse');

    // 進度動畫 - 根據題數動態調整速度
    // 基準：30題約80秒，每題約2.67秒
    const estimatedTimeMs = count * 2670; // 每題2.67秒
    const targetProgress = 90; // 目標進度90%
    const updateInterval = 200; // 每200ms更新一次
    const totalUpdates = estimatedTimeMs / updateInterval; // 總更新次數
    const incrementPerUpdate = targetProgress / totalUpdates; // 每次增加的進度

    let progress = 0;
    const progressInterval = setInterval(() => {
        if (progress < 90) {
            progress += incrementPerUpdate;
            if (progress > 90) progress = 90;
            progressFill.style.width = progress + '%';
            statusCount.textContent = Math.floor(progress) + '%';
        }
    }, updateInterval);

    try {
        // 如果超過20題，分批生成
        const BATCH_SIZE = 20;
        let allGeneratedQuestions = [];

        statusText.innerHTML = '<span class="loading-spinner"></span>✨ AI 正在分析錯題並生成新題目...';

        if (count > BATCH_SIZE) {
            // 分批處理 - 平均分配題數
            const batches = Math.ceil(count / BATCH_SIZE);
            const baseCount = Math.floor(count / batches); // 每批基本題數
            const remainder = count % batches; // 餘數

            console.log(`📊 分批生成計畫：總共 ${count} 題，分 ${batches} 批`);
            console.log(`📊 每批基本題數：${baseCount}，前 ${remainder} 批多1題`);

            for (let i = 0; i < batches; i++) {
                // 前 remainder 批多分配1題
                const batchCount = baseCount + (i < remainder ? 1 : 0);

                console.log(`\n🔄 開始生成第 ${i + 1}/${batches} 批，目標 ${batchCount} 題`);
                console.log(`📈 目前已生成：${allGeneratedQuestions.length} 題`);

                const batchQuestions = await generateQuestionsBatch(wrongQuestions, batchCount);

                console.log(`✅ 第 ${i + 1} 批完成，實際生成 ${batchQuestions.length} 題（目標 ${batchCount} 題）`);

                allGeneratedQuestions = allGeneratedQuestions.concat(batchQuestions);

                console.log(`📊 累計已生成：${allGeneratedQuestions.length} 題`);

                // 更新進度顯示
                const batchProgress = ((i + 1) / batches) * 90;
                progress = batchProgress;
            }

            console.log(`\n🎯 所有批次完成！總共生成 ${allGeneratedQuestions.length} 題（目標 ${count} 題）`);
        } else {
            // 單批處理（會自動補充不足的題目）
            allGeneratedQuestions = await generateQuestionsBatch(wrongQuestions, count);
        }

        // ========== 最終完整性檢查 ==========
        console.log('\n🔍 開始最終完整性檢查...');

        let finalValidQuestions = [];
        let finalInvalidCount = 0;

        allGeneratedQuestions.forEach((q, index) => {
            // 嚴格檢查所有必要欄位
            const hasValidTitle = q.題目 && typeof q.題目 === 'string' && q.題目.trim() !== '';
            const hasValidOptions = q.選項 && typeof q.選項 === 'object' &&
                                   q.選項.A && q.選項.B && q.選項.C && q.選項.D;
            const hasValidAnswer = q.答案 && typeof q.答案 === 'string' && q.答案.trim() !== '';
            const answerInOptions = hasValidOptions && hasValidAnswer && q.選項[q.答案];

            if (hasValidTitle && hasValidOptions && hasValidAnswer && answerInOptions) {
                finalValidQuestions.push(q);
            } else {
                finalInvalidCount++;
                console.error(`❌ 最終檢查：題目 ${index + 1} 有缺陷`, {
                    有題目: hasValidTitle,
                    有選項: hasValidOptions,
                    有答案: hasValidAnswer,
                    答案在選項中: answerInOptions,
                    題目資料: q
                });
            }
        });

        console.log(`✅ 最終檢查完成：${finalValidQuestions.length} 題有效，${finalInvalidCount} 題無效`);

        // 如果最終檢查發現有缺陷，補充生成
        if (finalInvalidCount > 0) {
            console.warn(`🗑️ 刪除 ${finalInvalidCount} 題有缺陷的題目`);

            if (finalValidQuestions.length < count) {
                const finalShortage = count - finalValidQuestions.length;
                console.log(`🔄 最終補充生成 ${finalShortage} 題...`);

                try {
                    const finalSupplementQuestions = await generateQuestionsBatch(wrongQuestions, finalShortage);
                    finalValidQuestions.push(...finalSupplementQuestions);
                    console.log(`✅ 最終補充完成！共 ${finalValidQuestions.length} 題`);
                } catch (error) {
                    console.error('❌ 最終補充失敗:', error);
                }
            }
        }

        // 使用最終驗證後的題目
        allGeneratedQuestions = finalValidQuestions;
        console.log(`\n🎉 生成完成！最終題目數：${allGeneratedQuestions.length} 題（目標 ${count} 題）`);
        console.log('📝 所有生成的題目:', allGeneratedQuestions);

        // 完成進度
        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        statusCount.textContent = '100%';
        progressFill.classList.remove('progress-pulse');

        // 儲存為新試卷
        saveExamPaper(allGeneratedQuestions, paperName);

        // 顯示結果
        setTimeout(() => {
            statusDiv.style.display = 'none';
            resultDiv.style.display = 'block';
            resultText.innerHTML = `
                成功生成 ${allGeneratedQuestions.length} 道題目！<br>
                試卷名稱：${paperName}<br>
                <br>
                已自動儲存到「題庫檢視」，您可以前往查看或開始練習。
            `;

            // 自動切換到題庫檢視
            setTimeout(() => {
                switchTab('display');
            }, 2000);
        }, 500);

    } catch (error) {
        clearInterval(progressInterval);
        progressFill.classList.remove('progress-pulse');
        statusDiv.style.display = 'none';

        console.error('生成題目失敗:', error);
        showErrorToast('生成題目失敗: ' + error.message + '\n\n請檢查網路連線或稍後再試');
    }
}

// ========== 回到頂端功能 ==========
function scrollToTop() {
    const contentArea = document.querySelector('.content-area');
    if (!contentArea) return;

    contentArea.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// ========== ✨ 題目生成（從講義/課文出題） ==========

let genContentPendingImages = [];

async function handleGenContentAnyUpload(event) {
    if (!currentUser) { event.target.value = ''; openLoginModal('feature'); return; }
    const files = Array.from(event.target.files);
    event.target.value = '';
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const docFiles = files.filter(f => !f.type.startsWith('image/'));
    for (const img of imageFiles) await addGenContentImage(img);
    if (docFiles.length > 0) {
        if (docFiles[0].size > 100 * 1024 * 1024) { showErrorToast('❌ 檔案大小超過 100MB'); return; }
        await processTextFileForGen(docFiles[0]);
    }
}

function clearGenContentAll() {
    genContentPendingImages = [];
    updateGenContentImagePreviewUI();
    document.getElementById('gen-content-text').value = '';
    const badge = document.getElementById('gencontent-file-badge');
    if (badge) badge.style.display = 'none';
}

async function handleGenContentFileUpload(event) {
    if (!currentUser) { event.target.value = ''; openLoginModal('feature'); return; }
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    if (file.size > 100 * 1024 * 1024) { showErrorToast('❌ 檔案大小超過 100MB'); return; }
    await processTextFileForGen(file);
}

async function handleGenContentImageUpload(event) {
    if (!currentUser) { event.target.value = ''; openLoginModal('feature'); return; }
    const files = Array.from(event.target.files);
    event.target.value = '';
    for (const file of files) await addGenContentImage(file);
}

async function addGenContentImage(file) {
    const MAX_IMAGES = 8;
    if (genContentPendingImages.length >= MAX_IMAGES) { showInfoToast(`最多只能上傳 ${MAX_IMAGES} 張圖片`); return; }
    if (file.size > 8 * 1024 * 1024) { showErrorToast(`❌ 圖片「${file.name}」超過 8MB`); return; }
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            genContentPendingImages.push({ dataUrl: e.target.result, name: file.name || `圖片_${Date.now()}.png`, type: file.type });
            updateGenContentImagePreviewUI();
            resolve();
        };
        reader.onerror = () => resolve();
        reader.readAsDataURL(file);
    });
}

function removeGenContentImage(index) {
    genContentPendingImages.splice(index, 1);
    updateGenContentImagePreviewUI();
}

function clearGenContentImages() {
    genContentPendingImages = [];
    updateGenContentImagePreviewUI();
}

function updateGenContentImagePreviewUI() {
    const area = document.getElementById('gen-content-image-preview');
    const list = document.getElementById('gen-content-image-list');
    const countEl = document.getElementById('gen-content-image-count');
    if (!area) return;
    if (genContentPendingImages.length === 0) { area.style.display = 'none'; return; }
    area.style.display = '';
    if (countEl) countEl.textContent = genContentPendingImages.length;
    list.innerHTML = '';
    genContentPendingImages.forEach((img, i) => {
        const thumb = document.createElement('div');
        thumb.className = 'image-thumb';
        const imgEl = document.createElement('img');
        imgEl.src = img.dataUrl; imgEl.alt = img.name; imgEl.title = img.name;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'image-thumb-remove'; removeBtn.innerHTML = '✕';
        removeBtn.onclick = (e) => { e.stopPropagation(); removeGenContentImage(i); };
        thumb.appendChild(imgEl); thumb.appendChild(removeBtn); list.appendChild(thumb);
    });
}

async function processTextFileForGen(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const textarea = document.getElementById('gen-content-text');
    textarea.value = `📄 正在解析 ${ext.toUpperCase()} 檔案...\n請稍候...`;
    try {
        let content = '';
        let extractedImages = [];

        if (ext === 'txt') {
            content = await readFileAsText(file);
        } else if (ext === 'docx') {
            content = await extractTextFromDOCX(file);
        } else if (ext === 'pdf') {
            textarea.value = '📄 正在提取 PDF 文字...';
            content = await extractTextFromPDF(file);
            // 若文字很少（每頁平均<80字），推測為掃描版，自動轉圖片
            const pdfPageCount = Math.max(1, Math.ceil(content.length / 500));
            if (content.trim().length < pdfPageCount * 80) {
                textarea.value = '🖼️ PDF 文字稀少，正在轉換頁面為圖片...';
                extractedImages = await extractPDFPagesAsImages(file);
                if (extractedImages.length > 0 && content.trim().length < 20) content = '';
            }
        } else if (ext === 'pptx' || ext === 'ppt') {
            content = await extractTextFromPPTX(file);
            // 同時提取 PPTX 內嵌圖片
            textarea.value = `📄 文字提取完成，正在檢查圖片...\n共 ${content.length} 字元`;
            extractedImages = await extractImagesFromPPTX(file);
        } else {
            throw new Error('不支援的格式，請上傳 TXT、DOCX、PDF 或 PPTX');
        }

        if ((!content || content.trim().length < 20) && extractedImages.length === 0) {
            throw new Error('無法從檔案中提取到有效內容');
        }

        textarea.value = content;

        // 加入提取到的圖片
        if (extractedImages.length > 0) {
            const toAdd = extractedImages.slice(0, 40 - genContentPendingImages.length);
            genContentPendingImages.push(...toAdd);
            updateGenContentImagePreviewUI();
            showInfoToast(`🖼️ 發現 ${toAdd.length} 張內嵌圖片，已加入辨識`);
        }

        const badge = document.getElementById('gencontent-file-badge');
        const badgeText = document.getElementById('gencontent-file-badge-text');
        if (badge) {
            const imgNote = extractedImages.length > 0 ? `・${extractedImages.length} 張圖片` : '';
            badgeText.textContent = `📄 ${file.name}（${content.length} 字元${imgNote}）`;
            badge.style.display = 'flex';
        }
        showSuccessToast(`✅ ${ext.toUpperCase()} 解析成功！共 ${content.length} 字元${extractedImages.length > 0 ? `・${extractedImages.length} 張圖片` : ''}`);
    } catch (error) {
        textarea.value = '';
        showErrorToast(`❌ 解析失敗: ${error.message}`);
    }
}

// 從 PPTX 提取內嵌圖片
async function extractImagesFromPPTX(file) {
    if (typeof JSZip === 'undefined') return [];
    try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const mediaFiles = Object.keys(zip.files).filter(name =>
            name.startsWith('ppt/media/') && /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name)
        );
        const images = [];
        for (const mediaPath of mediaFiles.slice(0, 40)) {
            const ext = mediaPath.split('.').pop().toLowerCase();
            const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
            const blob = await zip.file(mediaPath).async('blob');
            const dataUrl = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.readAsDataURL(new Blob([blob], { type: mime }));
            });
            images.push({ dataUrl, name: mediaPath.split('/').pop(), type: mime });
        }
        return images;
    } catch { return []; }
}

// 將 PDF 每頁渲染成圖片（用於掃描版 PDF）
async function extractPDFPagesAsImages(file) {
    if (typeof pdfjsLib === 'undefined') return [];
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pageCount = Math.min(pdf.numPages, 40);
        const images = [];
        for (let i = 1; i <= pageCount; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            images.push({ dataUrl, name: `page_${i}.jpg`, type: 'image/jpeg' });
        }
        return images;
    } catch { return []; }
}

async function extractTextFromPPTX(file) {
    if (typeof JSZip === 'undefined') throw new Error('PPTX 解析庫未載入，請重新整理頁面');
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const slideFiles = Object.keys(zip.files)
        .filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/))
        .sort((a, b) => {
            const na = parseInt(a.match(/\d+/)[0]);
            const nb = parseInt(b.match(/\d+/)[0]);
            return na - nb;
        });
    if (slideFiles.length === 0) throw new Error('找不到投影片內容');
    const parser = new DOMParser();
    let allText = '';
    for (const slideName of slideFiles) {
        const xmlStr = await zip.file(slideName).async('string');
        const xmlDoc = parser.parseFromString(xmlStr, 'text/xml');
        const textNodes = xmlDoc.getElementsByTagName('a:t');
        let slideText = '';
        for (const node of textNodes) {
            const t = node.textContent.trim();
            if (t) slideText += t + ' ';
        }
        if (slideText.trim()) allText += slideText.trim() + '\n';
    }
    if (!allText.trim()) throw new Error('投影片中沒有找到文字內容');
    return allText.trim();
}

async function startGenFromContent() {
    if (!currentUser) { openLoginModal('feature'); return; }
    const text = document.getElementById('gen-content-text').value.trim();
    const count = parseInt(document.getElementById('gen-content-count').value);
    const type = 'mc';
    const difficulty = document.getElementById('gen-content-difficulty').value;
    const paperName = document.getElementById('gen-content-paper-name').value.trim();

    if (!text && genContentPendingImages.length === 0) {
        showErrorToast('請先上傳檔案或輸入內容'); return;
    }
    if (!paperName) { showErrorToast('請輸入試卷名稱'); return; }
    if (count < 1 || count > 50) { showErrorToast('生成題數必須在 1-50 之間'); return; }

    const statusDiv = document.getElementById('gen-content-status');
    const statusText = document.getElementById('gen-content-status-text');
    const statusCount = document.getElementById('gen-content-status-count');
    const progressFill = document.getElementById('gen-content-progress-fill');
    const resultDiv = document.getElementById('gen-content-result');
    const btnText = document.getElementById('gen-content-btn-text');

    statusDiv.style.display = 'block';
    resultDiv.style.display = 'none';
    progressFill.style.width = '0%';
    progressFill.classList.add('progress-pulse');
    btnText.textContent = '⏳ 生成中...';

    let progress = 0;
    const setProgress = (pct) => {
        progress = pct;
        progressFill.style.width = pct + '%';
        statusCount.textContent = Math.floor(pct) + '%';
    };

    try {
        let allQuestions = [];
        const typeLabel = { mixed: '混合題型（單選題與是非題）', mc: '單選題（ABCD四選一）', tf: '是非題（判斷對錯，選項為「正確」和「錯誤」）' }[type];
        const diffLabel = { mixed: '混合難度（簡單、中等、困難各佔比例）', easy: '簡單', medium: '中等', hard: '困難' }[difficulty];

        const images = [...genContentPendingImages];
        const IMGS_PER_BATCH = 5;  // 每批圖片數
        const Q_PER_BATCH = 20;    // 每批題數上限

        if (images.length > IMGS_PER_BATCH) {
            // ── 圖片分批模式 ──────────────────────────────
            const imgBatches = [];
            for (let i = 0; i < images.length; i += IMGS_PER_BATCH) {
                imgBatches.push(images.slice(i, i + IMGS_PER_BATCH));
            }
            const totalBatches = imgBatches.length;
            statusText.innerHTML = `<span class="loading-spinner"></span>✨ 共 ${images.length} 頁，分 ${totalBatches} 批處理...`;

            for (let i = 0; i < totalBatches; i++) {
                const remaining = count - allQuestions.length;
                const batchesLeft = totalBatches - i;
                const batchCount = Math.ceil(remaining / batchesLeft);
                statusText.innerHTML = `<span class="loading-spinner"></span>✨ 第 ${i + 1} / ${totalBatches} 批（第 ${i * IMGS_PER_BATCH + 1}–${Math.min((i + 1) * IMGS_PER_BATCH, images.length)} 頁）`;
                const batch = await genContentBatch(text, imgBatches[i], batchCount, typeLabel, diffLabel);
                allQuestions = allQuestions.concat(batch);
                setProgress(((i + 1) / totalBatches) * 90);
            }
        } else {
            // ── 題數分批模式（文字為主，無大量圖片）────────
            const qBatches = count > Q_PER_BATCH ? Math.ceil(count / Q_PER_BATCH) : 1;
            for (let i = 0; i < qBatches; i++) {
                const batchCount = Math.floor(count / qBatches) + (i < count % qBatches ? 1 : 0);
                statusText.innerHTML = `<span class="loading-spinner"></span>✨ AI 出題中${qBatches > 1 ? `（第 ${i + 1} / ${qBatches} 批）` : ''}...`;
                const batch = await genContentBatch(text, images, batchCount, typeLabel, diffLabel);
                allQuestions = allQuestions.concat(batch);
                setProgress(((i + 1) / qBatches) * 90);
            }
        }

        progressFill.style.width = '100%';
        progressFill.classList.remove('progress-pulse');
        statusCount.textContent = '100%';

        // 欄位映射（AI 有時回傳 正確答案 而非 答案）
        allQuestions.forEach(q => {
            if (!q.答案 && q.正確答案) q.答案 = q.正確答案;
        });

        // 驗證題目並標準化
        const validQuestions = allQuestions
            .filter(q => q.題目 && q.選項 && q.選項.A && q.選項.B && q.答案 && ['A','B','C','D'].includes(q.答案?.toUpperCase?.()))
            .map(normalizeQuestion);

        if (validQuestions.length === 0) throw new Error('AI 未能生成有效題目，請確認內容是否足夠');

        // 建立試卷
        const newPaper = {
            id: examPaperIdCounter++,
            name: paperName,
            questions: validQuestions,
            createdTime: new Date().toISOString(),
            testCount: 0,
            lastTestTime: null,
            lastQuestionIndex: 0
        };
        examPapers.unshift(newPaper);
        saveToStorage();

        resultDiv.style.display = 'block';
        document.getElementById('gen-content-result-text').innerHTML = `
            <div style="text-align:center; padding:20px;">
                <div style="font-size:48px; margin-bottom:12px;">✅</div>
                <div style="font-size:18px; font-weight:600; color:#10b981; margin-bottom:8px;">生成完成！</div>
                <div style="color:#d0d0d0; font-size:14px; margin-bottom:16px;">已生成 ${validQuestions.length} 題，儲存為試卷「${paperName}」</div>
                <button class="btn btn-primary" onclick="switchTab('display')" style="margin-right:8px;">📋 查看試卷</button>
                <button class="btn btn-secondary" onclick="switchTab('quiz')">🎯 開始練習</button>
            </div>`;
        statusDiv.style.display = 'none';
        btnText.textContent = '✨ 開始生成題目';
        showSuccessToast(`✅ 已生成 ${validQuestions.length} 題！`);
        setTimeout(() => switchTab('display'), 2500);
    } catch (error) {
        progressFill.classList.remove('progress-pulse');
        statusDiv.style.display = 'none';
        btnText.textContent = '✨ 開始生成題目';
        showErrorToast('❌ 生成失敗：' + error.message);
    }
}

async function genContentBatch(text, images, count, typeLabel, diffLabel) {
    const textPart = text ? `【內容文字】\n${text.slice(0, 8000)}` : '';

    const prompt = `你是一位專業的出題老師。請根據以下提供的內容，生成 ${count} 道考試題目。

${textPart}

【出題要求】
1. 題目必須完全根據提供的內容，考查重要知識點
2. 題型：${typeLabel}
3. 難度：${diffLabel}
4. 使用繁體中文（台灣用語）
5. 每題須根據複雜程度標記難度：easy（基礎）、medium（應用）、hard（分析推論）
6. 必須生成完整的 ${count} 道題目

【輸出格式】
請嚴格按照以下 JSON 格式輸出，不要有任何其他文字：
[
  {
    "題目": "題目內容（必填）",
    "選項": {
      "A": "選項A（必填）",
      "B": "選項B（必填）",
      "C": "選項C（必填）",
      "D": "選項D（必填）"
    },
    "答案": "A（必填，只能是A/B/C/D其中一個）",
    "詳解": "簡短說明（必填）",
    "難度": "easy/medium/hard（必填）"
  }
]

注意：是非題時，A為「正確」，B為「錯誤」，C和D可設為干擾選項或相同為「無」。`;

    // 建立 messages（支援圖片）
    const userContent = [];
    if (images && images.length > 0) {
        for (const img of images) {
            userContent.push({
                type: 'image_url',
                image_url: { url: img.dataUrl }
            });
        }
    }
    userContent.push({ type: 'text', text: prompt });

    const estimatedTokens = Math.min(count * 400 + 2000, 32000);
    const response = await fetchWithProxyFallback(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ai-tutor.app',
            'X-Title': 'AI Tutor'
        },
        body: JSON.stringify({
            model: AI_MODEL,
            messages: [
                { role: 'system', content: '你是一位專業的出題老師，請根據提供的內容出題，輸出純 JSON 格式。' },
                { role: 'user', content: userContent }
            ],
            max_tokens: estimatedTokens,
            temperature: 0.5
        })
    });

    if (!response.ok) throw new Error(`API 請求失敗: ${response.status}`);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // 解析 JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('AI 回應格式錯誤');
    const parsed = JSON.parse(jsonMatch[0]);
    // 統一欄位：正確答案 → 答案
    parsed.forEach(q => { if (!q.答案 && q.正確答案) q.答案 = q.正確答案; });
    return parsed;
}

// ========== 滾動自動隱藏頂部元素 + 回到頂端按鈕 ==========
function initScrollAutoHide() {
    const contentArea = document.querySelector('.content-area');
    const titleRow = document.querySelector('.title-row');
    const functionTabs = document.querySelector('.function-tabs');
    const mobileHeader = document.querySelector('.mobile-header');

    const bottomNav = document.querySelector('.mobile-bottom-nav');
    const backToTopBtn = document.getElementById('back-to-top');

    if (!contentArea) return;

    let lastScrollTop = 0;
    let ticking = false;
    let isHidden = false; // 追蹤當前狀態
    let lastActionTime = 0; // 上次動作時間

    // 節流函式：使用 requestAnimationFrame 確保動畫流暢
    function handleScroll() {
        const now = Date.now();
        const scrollTop = contentArea.scrollTop;
        const scrollThreshold = 100; // 滾動超過100px才開始隱藏
        const scrollDelta = scrollTop - lastScrollTop; // 滾動距離（帶方向）

        // 檢查是否接近頂部（50px 範圍內）
        const nearTop = scrollTop < 50;

        // 控制回到頂端按鈕顯示/隱藏（滾動超過300px時顯示）
        if (backToTopBtn) {
            if (scrollTop > 300) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        }

        // 剛執行完動作後 500ms 內忽略滾動事件，避免因佈局改變導致的自動滾動
        if (now - lastActionTime < 500) {
            lastScrollTop = scrollTop;
            ticking = false;
            return;
        }

        // 如果接近頂部，自動顯示標題
        if (nearTop && isHidden) {
            isHidden = false;
            lastActionTime = now;
            if (titleRow) titleRow.classList.remove('header-hidden');
            if (functionTabs) functionTabs.classList.remove('header-hidden');
            if (mobileHeader) mobileHeader.classList.remove('header-hidden');

            if (bottomNav) bottomNav.classList.remove('nav-hidden');
            lastScrollTop = scrollTop;
            ticking = false;
            return;
        }

        // 必須滾動至少 20px 才觸發，避免佈局改變造成的微小滾動
        if (Math.abs(scrollDelta) < 20) {
            ticking = false;
            return;
        }

        // 判斷滾動方向
        const isScrollingDown = scrollDelta > 0;
        const isPastThreshold = scrollTop > scrollThreshold;

        // 接近底部時不隱藏，避免到底後繼續觸發隱藏邏輯
        const atBottom = scrollTop + contentArea.clientHeight >= contentArea.scrollHeight - 80;

        // 往下滾動且超過閾值 - 隱藏
        if (isScrollingDown && isPastThreshold && !isHidden && !atBottom) {
            isHidden = true;
            lastActionTime = now;
            if (titleRow) titleRow.classList.add('header-hidden');
            if (functionTabs) functionTabs.classList.add('header-hidden');
            if (mobileHeader) mobileHeader.classList.add('header-hidden');

            if (bottomNav) bottomNav.classList.add('nav-hidden');
        }
        // 往上滾動足夠距離 - 顯示
        else if (scrollDelta < -20 && isHidden) {
            isHidden = false;
            lastActionTime = now;
            if (titleRow) titleRow.classList.remove('header-hidden');
            if (functionTabs) functionTabs.classList.remove('header-hidden');
            if (mobileHeader) mobileHeader.classList.remove('header-hidden');

            if (bottomNav) bottomNav.classList.remove('nav-hidden');
        }

        lastScrollTop = scrollTop;
        ticking = false;
    }

    // 滾動事件監聽（使用 requestAnimationFrame 優化性能）
    contentArea.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(handleScroll);
            ticking = true;
        }
    });
}

// ========== 帳號系統 ==========
const GUEST_CHAT_LIMIT = 5;
let currentUser = null; // { username, loginAt }
let _loginIsRegister = false;

function _hashPwd(pwd) {
    let h = 0;
    for (let i = 0; i < pwd.length; i++) h = (Math.imul(31, h) + pwd.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}
function _getAccounts() { return JSON.parse(localStorage.getItem('ai_tutor_accounts') || '[]'); }
function _saveAccounts(a) { localStorage.setItem('ai_tutor_accounts', JSON.stringify(a)); }

function getGuestRemaining() {
    const u = JSON.parse(localStorage.getItem('ai_tutor_guest') || '{"count":0}');
    return Math.max(0, GUEST_CHAT_LIMIT - u.count);
}
function incrementGuestUsage() {
    const u = JSON.parse(localStorage.getItem('ai_tutor_guest') || '{"count":0}');
    u.count++;
    localStorage.setItem('ai_tutor_guest', JSON.stringify(u));
}

function initAuth() {
    const session = localStorage.getItem('ai_tutor_session');
    if (session) {
        try { currentUser = JSON.parse(session); } catch(e) {}
    }
    updateAuthUI();
}

function updateAuthUI() {
    const remaining = getGuestRemaining();
    document.querySelectorAll('.js-auth-indicator').forEach(btn => {
        if (currentUser) {
            btn.textContent = '👤 ' + currentUser.username;
            btn.classList.add('logged-in');
        } else {
            btn.textContent = `訪客(${remaining})`;
            btn.classList.remove('logged-in');
        }
    });
    _renderSettingsAccountBlock();
}

function onAuthIndicatorClick() {
    if (currentUser) openSettings();
    else openLoginModal();
}

function openLoginModal(reason) {
    const modal = document.getElementById('login-modal');
    if (!modal) return;
    // 重置
    _loginIsRegister = false;
    _updateLoginUI();
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-password2').value = '';
    document.getElementById('login-error').style.display = 'none';
    // 原因提示
    const reasonBox = document.getElementById('login-reason-box');
    const guestBtn  = document.getElementById('login-guest-btn');
    if (reason === 'chat_limit') {
        reasonBox.style.display = 'block';
        reasonBox.textContent = '⚠️ 訪客對話次數已用完，請登入或註冊後繼續使用';
        guestBtn.style.display = 'none';
    } else if (reason === 'feature') {
        reasonBox.style.display = 'block';
        reasonBox.textContent = '⚠️ 此功能需要登入帳號才能使用';
        guestBtn.style.display = 'block';
    } else {
        reasonBox.style.display = 'none';
        guestBtn.style.display = 'block';
    }
    document.getElementById('login-guest-remain').textContent = getGuestRemaining();
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('login-username').focus(), 100);
}

function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'none';
}

function toggleLoginRegister() {
    _loginIsRegister = !_loginIsRegister;
    _updateLoginUI();
}

function _updateLoginUI() {
    document.getElementById('login-title').textContent       = _loginIsRegister ? '註冊帳號' : '登入帳號';
    document.getElementById('login-submit-btn').textContent  = _loginIsRegister ? '註冊' : '登入';
    document.getElementById('login-toggle-btn').textContent  = _loginIsRegister ? '已有帳號？直接登入' : '還沒有帳號？立即註冊';
    document.getElementById('login-password2').style.display = _loginIsRegister ? 'block' : 'none';
    document.getElementById('login-error').style.display = 'none';
}

function submitLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl  = document.getElementById('login-error');
    const showErr  = msg => { errorEl.textContent = msg; errorEl.style.display = 'block'; };

    if (!username || !password) return showErr('請填寫帳號和密碼');
    const accounts = _getAccounts();
    const hash = _hashPwd(password);

    if (_loginIsRegister) {
        const pwd2 = document.getElementById('login-password2').value;
        if (password !== pwd2)  return showErr('兩次密碼不一致');
        if (password.length < 4) return showErr('密碼至少需要 4 個字元');
        if (accounts.find(a => a.username === username)) return showErr('此帳號已存在');
        accounts.push({ username, passwordHash: hash, createdAt: Date.now() });
        _saveAccounts(accounts);
        currentUser = { username, loginAt: Date.now() };
        localStorage.setItem('ai_tutor_session', JSON.stringify(currentUser));
        closeLoginModal();
        updateAuthUI();
        showInfoToast(`✅ 註冊成功，歡迎 ${username}！`);
    } else {
        const account = accounts.find(a => a.username === username && a.passwordHash === hash);
        if (!account) return showErr('帳號或密碼錯誤');
        currentUser = { username, loginAt: Date.now() };
        localStorage.setItem('ai_tutor_session', JSON.stringify(currentUser));
        closeLoginModal();
        updateAuthUI();
        showInfoToast(`✅ 歡迎回來，${username}！`);
    }
}

function logoutUser() {
    currentUser = null;
    localStorage.removeItem('ai_tutor_session');
    updateAuthUI();
    // 切回對話頁
    switchTab('chat');
    showInfoToast('已登出');
}

function _renderSettingsAccountBlock() {
    const el = document.getElementById('settings-account-info');
    if (!el) return;
    if (currentUser) {
        el.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,212,255,0.06); border:1px solid rgba(0,212,255,0.2); border-radius:10px; padding:10px 14px;">
                <div>
                    <div style="font-size:14px; color:#e0f2fe; font-weight:600;">👤 ${currentUser.username}</div>
                    <div style="font-size:11px; color:#64748b; margin-top:2px;">已登入・完整功能可用</div>
                </div>
                <button onclick="logoutUser(); closeSettings();" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:8px; color:#fca5a5; font-size:12px; padding:6px 12px; cursor:pointer;">登出</button>
            </div>`;
    } else {
        el.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:10px 14px;">
                <div>
                    <div style="font-size:14px; color:#94a3b8;">未登入（訪客）</div>
                    <div style="font-size:11px; color:#64748b; margin-top:2px;">剩餘 ${getGuestRemaining()} 次對話・其他功能鎖定</div>
                </div>
                <button onclick="closeSettings(); openLoginModal();" style="background:var(--accent-gradient); border:none; border-radius:8px; color:#fff; font-size:12px; padding:6px 14px; cursor:pointer; font-weight:600;">登入</button>
            </div>`;
    }
}

// 點擊背景關閉登入 Modal
document.addEventListener('click', function(e) {
    const modal = document.getElementById('login-modal');
    if (modal && e.target === modal) closeLoginModal();
});

// ========== 設定 Modal ==========

// 設定資料（每個 section 有 mode: 'default'|'custom' 及 items 陣列）
let _sd = {
    theme: 'cyber-blue',
    apiKey:    { mode: 'default', items: [], nextId: 1 },
    model:     { mode: 'default', items: [], nextId: 1 },
    apiUrl:    { mode: 'default', items: [], nextId: 1 },
    maxTokens: { mode: 'default', value: _DEFAULT_MAX_TOKENS },
};

function _applySettingsValues() {
    ['apiKey', 'model', 'apiUrl'].forEach(sec => {
        const active = _sd[sec].items.find(i => i.active);
        if (_sd[sec].mode === 'custom' && active) {
            if (sec === 'apiKey') API_KEY  = active.value;
            if (sec === 'model')  AI_MODEL = active.value;
            if (sec === 'apiUrl') API_URL  = active.value;
        } else {
            if (sec === 'apiKey') API_KEY  = '';   // v1.71：Key 在後端，前端不設定
            if (sec === 'model')  AI_MODEL = _DEFAULT_AI_MODEL;
            if (sec === 'apiUrl') API_URL  = _DEFAULT_API_URL;
        }
    });
    MAX_TOKENS = (_sd.maxTokens.mode === 'custom' && _sd.maxTokens.value >= 1000)
        ? _sd.maxTokens.value : _DEFAULT_MAX_TOKENS;
}

// ---- 自訂顏色 ----
function _rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function applyCustomTheme(hex) {
    if (!hex || !hex.startsWith('#') || hex.length < 7) return;
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    const [h, s, l] = _rgbToHsl(r, g, b);
    const aL  = Math.max(l, 55);   // accent lightness（保證夠亮）
    const aL2 = Math.min(aL + 15, 85);
    const aL3 = Math.max(aL - 15, 30);
    const bgS = Math.min(s, 70);

    const root = document.documentElement;
    root.style.setProperty('--primary-bg',       `hsl(${h},${bgS}%,7%)`);
    root.style.setProperty('--secondary-bg',     `hsl(${h},${bgS}%,11%)`);
    root.style.setProperty('--accent-gradient',  `linear-gradient(135deg,hsl(${h},${s}%,${aL2}%) 0%,hsl(${h},${s}%,${aL}%) 50%,hsl(${h},${s}%,${aL3}%) 100%)`);
    root.style.setProperty('--accent-glow',      `hsla(${h},${s}%,${aL}%,0.5)`);
    root.style.setProperty('--border-neon',      `hsla(${h},${s}%,${aL}%,0.3)`);
    root.style.setProperty('--text-primary',     `hsl(${h},25%,90%)`);
    root.style.setProperty('--text-secondary',   `hsl(${h},15%,60%)`);
    root.setAttribute('data-theme', 'custom');

    // body 背景漸層（需注入 <style>）
    let styleEl = document.getElementById('custom-theme-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'custom-theme-style';
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
        html[data-theme="custom"] body::before {
            background:
                radial-gradient(circle at 10% 20%, hsla(${h},${s}%,${aL}%,0.15) 0%, transparent 30%),
                radial-gradient(circle at 90% 80%, hsla(${h},${s}%,${aL3}%,0.15) 0%, transparent 30%),
                radial-gradient(circle at 50% 50%, hsla(${h},${s}%,${aL3}%,0.1) 0%, transparent 40%);
        }
        html[data-theme="custom"] body::after {
            background-image:
                linear-gradient(hsla(${h},${s}%,${aL}%,0.03) 1px, transparent 1px),
                linear-gradient(90deg, hsla(${h},${s}%,${aL}%,0.03) 1px, transparent 1px);
        }
        html[data-theme="custom"] .mob-tab.active { color: hsl(${h},${s}%,${aL}%); }
        html[data-theme="custom"] .mob-tab.active .mob-tab-icon {
            filter: drop-shadow(0 0 6px hsla(${h},${s}%,${aL}%,0.7));
        }
    `;

    // 更新卡片預覽色
    const preview = document.getElementById('custom-color-preview');
    if (preview) preview.style.background = `linear-gradient(135deg,hsl(${h},${bgS}%,7%) 40%,hsl(${h},${s}%,${aL}%))`;

    document.querySelectorAll('.theme-card-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === 'custom');
    });

    _sd.customColor = hex;
    _sd.theme = 'custom';
}

const THEMES = {
    'cyber-blue': {
        '--primary-bg': '#0a0e27',
        '--secondary-bg': '#111827',
        '--accent-gradient': 'linear-gradient(135deg, #00d4ff 0%, #0099ff 50%, #0061ff 100%)',
        '--accent-glow': 'rgba(0, 212, 255, 0.5)',
        '--border-neon': 'rgba(0, 212, 255, 0.3)',
        '--text-primary': '#e0f2fe',
        '--text-secondary': '#94a3b8',
    },
    'violet': {
        '--primary-bg': '#12071f',
        '--secondary-bg': '#1a0d2e',
        '--accent-gradient': 'linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #5b21b6 100%)',
        '--accent-glow': 'rgba(168, 85, 247, 0.5)',
        '--border-neon': 'rgba(168, 85, 247, 0.3)',
        '--text-primary': '#f3e8ff',
        '--text-secondary': '#c084fc',
    },
    'matrix': {
        '--primary-bg': '#041a0c',
        '--secondary-bg': '#052e16',
        '--accent-gradient': 'linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
        '--accent-glow': 'rgba(34, 197, 94, 0.5)',
        '--border-neon': 'rgba(34, 197, 94, 0.3)',
        '--text-primary': '#dcfce7',
        '--text-secondary': '#86efac',
    },
    'rose': {
        '--primary-bg': '#1a0514',
        '--secondary-bg': '#2d0a1f',
        '--accent-gradient': 'linear-gradient(135deg, #f43f5e 0%, #e11d48 50%, #be123c 100%)',
        '--accent-glow': 'rgba(244, 63, 94, 0.5)',
        '--border-neon': 'rgba(244, 63, 94, 0.3)',
        '--text-primary': '#ffe4e6',
        '--text-secondary': '#fda4af',
    }
};

function applyTheme(theme) {
    if (theme === 'custom') {
        if (_sd.customColor) applyCustomTheme(_sd.customColor);
        return;
    }
    const vars = THEMES[theme] || THEMES['cyber-blue'];
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.setAttribute('data-theme', theme);
    _sd.theme = theme;
    document.querySelectorAll('.theme-card-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

function selectThemeCard(theme) {
    if (theme !== 'custom') applyTheme(theme);
    // custom 由 color input 的 oninput 觸發
}

function loadSettings() {
    const saved = localStorage.getItem('ai_tutor_settings_v3');
    if (!saved) return;
    try {
        const s = JSON.parse(saved);
        if (s.theme)     _sd.theme = s.theme;
        if (s.apiKey)    _sd.apiKey    = s.apiKey;
        if (s.model)     _sd.model     = s.model;
        if (s.apiUrl)    _sd.apiUrl    = s.apiUrl;
        if (s.maxTokens) _sd.maxTokens = s.maxTokens;
        applyTheme(_sd.theme);
        _applySettingsValues();
    } catch (e) {
        console.error('設定載入失敗:', e);
    }
}

function openSettings() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    _renderSettingsAccountBlock();
    // 標記目前主題
    document.querySelectorAll('.theme-card-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === _sd.theme);
    });
    // 恢復自訂顏色 input 值與預覽
    if (_sd.customColor) {
        const ci = document.getElementById('custom-color-input');
        if (ci) ci.value = _sd.customColor;
        const [r, g, b] = [1,3,5].map(i => parseInt(_sd.customColor.slice(i, i+2), 16));
        const [h, s, l] = _rgbToHsl(r, g, b);
        const aL = Math.max(l, 55);
        const preview = document.getElementById('custom-color-preview');
        if (preview) preview.style.background = `linear-gradient(135deg,hsl(${h},${Math.min(s,70)}%,7%) 40%,hsl(${h},${s}%,${aL}%))`;
    }
    // 渲染各區塊
    ['apiKey', 'model', 'apiUrl', 'maxTokens'].forEach(_renderSection);
    modal.style.display = 'flex';
}

function closeSettings() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
}

function saveSettings() {
    // 讀取 maxTokens 自訂值
    if (_sd.maxTokens.mode === 'custom') {
        const v = parseInt(document.getElementById('settings-max-tokens')?.value);
        if (!isNaN(v) && v >= 1000) _sd.maxTokens.value = v;
    }
    _sd.theme = document.documentElement.getAttribute('data-theme') || 'cyber-blue';
    localStorage.setItem('ai_tutor_settings_v3', JSON.stringify(_sd));
    _applySettingsValues();
    closeSettings();
    showInfoToast('✅ 設定已儲存');
}

// ---- Section 渲染 ----
function _renderSection(sec) {
    const s = _sd[sec];
    // 更新 toggle 按鈕
    const toggleGroup = document.getElementById(`${sec}-mode-toggle`);
    if (toggleGroup) {
        toggleGroup.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === s.mode);
        });
    }
    // 顯示/隱藏自訂區塊
    const area = document.getElementById(`${sec}-custom-area`);
    if (area) area.style.display = s.mode === 'custom' ? 'block' : 'none';
    // 渲染清單（maxTokens 用 input 不用清單）
    if (sec !== 'maxTokens') _renderItemList(sec);
    // maxTokens 填入現有值
    if (sec === 'maxTokens' && s.mode === 'custom') {
        const el = document.getElementById('settings-max-tokens');
        if (el && s.value) el.value = s.value;
    }
}

function _renderItemList(sec) {
    const listEl = document.getElementById(`${sec}-list`);
    if (!listEl) return;
    const items = _sd[sec].items;
    if (!items.length) {
        listEl.innerHTML = '<div style="text-align:center;padding:12px 0;color:#475569;font-size:13px;">尚無項目，請在下方新增</div>';
        return;
    }
    listEl.innerHTML = items.map(item => {
        const preview = sec === 'apiKey'
            ? '···' + item.value.slice(-6)
            : (item.value.length > 32 ? item.value.slice(0, 32) + '…' : item.value);
        const name = item.name || (sec === 'model' ? item.value.split('/').pop() : item.value.slice(0, 12));
        return `<div class="settings-item">
            <button class="item-select-btn ${item.active ? 'active' : ''}" onclick="selectSettingsItem('${sec}',${item.id})">
                <span class="item-dot"></span>
                <span class="item-name">${name}</span>
                <span class="item-preview">${preview}</span>
            </button>
            <button class="item-delete-btn" onclick="removeSettingsItem('${sec}',${item.id})">🗑</button>
        </div>`;
    }).join('');
}

// ---- 項目操作 ----
function setSettingsMode(sec, mode) {
    _sd[sec].mode = mode;
    _renderSection(sec);
}

function addSettingsItem(sec) {
    const nameEl  = document.getElementById(`new-${sec}-name`);
    const valueEl = document.getElementById(`new-${sec}-value`);
    const value   = valueEl?.value.trim();
    if (!value) { showInfoToast('請輸入值'); return; }
    const s = _sd[sec];
    s.items.push({ id: s.nextId++, name: nameEl?.value.trim() || '', value, active: s.items.length === 0 });
    if (nameEl)  nameEl.value  = '';
    if (valueEl) valueEl.value = '';
    _renderItemList(sec);
}

function removeSettingsItem(sec, id) {
    const s = _sd[sec];
    const wasActive = s.items.find(i => i.id === id)?.active;
    s.items = s.items.filter(i => i.id !== id);
    if (wasActive && s.items.length) s.items[0].active = true;
    _renderItemList(sec);
}

function selectSettingsItem(sec, id) {
    _sd[sec].items.forEach(i => i.active = (i.id === id));
    _renderItemList(sec);
}

function _apiHint(msg) {
    if (/API 請求失敗|401|403|Authentication|Unauthorized|Missing.*header/i.test(msg))
        return '\n\n💡 請至設定 → 📖 使用教學，確認每項都要按 ＋ 加入列表、點藍點啟用後再儲存。';
    return '';
}

function prefillNewItem(sec, name, value) {
    const nameEl  = document.getElementById(`new-${sec}-name`);
    const valueEl = document.getElementById(`new-${sec}-value`);
    if (nameEl)  nameEl.value  = name;
    if (valueEl) valueEl.value = value;
}

// 點擊背景關閉設定
document.addEventListener('click', function(e) {
    const modal = document.getElementById('settings-modal');
    if (modal && e.target === modal) closeSettings();
});
