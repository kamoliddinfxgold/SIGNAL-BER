const dropZone = document.getElementById('dropZone');
const imageInput = document.getElementById('imageInput');
const previewContainer = document.getElementById('previewContainer');
const imagePreview = document.getElementById('imagePreview');
const resetBtn = document.getElementById('resetBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingState = document.getElementById('loadingState');
const resultContainer = document.getElementById('resultContainer');
const apiKeyInput = document.getElementById('apiKey');
const toggleApiKeyBtn = document.getElementById('toggleApiKey');
const saveStrategyBtn = document.getElementById('saveStrategyBtn');

// API Key configuration
const ENV_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Load API Key from localStorage
let storedKey = localStorage.getItem('openai_api_key');
if (!storedKey && ENV_API_KEY) {
    storedKey = ENV_API_KEY;
    localStorage.setItem('openai_api_key', storedKey);
}
apiKeyInput.value = storedKey || '';

// Save API Key on input
apiKeyInput.addEventListener('input', () => {
    localStorage.setItem('openai_api_key', apiKeyInput.value.trim());
});

// History & Strategies Elements

const historyList = document.getElementById('historyList');
const historyCount = document.getElementById('historyCount');
const toggleHistory = document.getElementById('toggleHistory');
const historyContent = document.getElementById('historyContent');

const strategiesList = document.getElementById('strategiesList');
const strategiesCount = document.getElementById('strategiesCount');
const toggleStrategies = document.getElementById('toggleStrategies');
const strategiesContent = document.getElementById('strategiesContent');

let currentBase64Image = null;
let lastAnalysisResult = null;

// Persistent Data
let signalHistory = JSON.parse(localStorage.getItem('signalHistory') || '[]');
let savedStrategies = JSON.parse(localStorage.getItem('savedStrategies') || '[]');
let totalTokenUsage = parseInt(localStorage.getItem('totalTokenUsage') || '0');

// Initialize UI
updateListsUI();
updateUsageUI();

// Toggle Sections
toggleHistory.addEventListener('click', () => {
    toggleHistory.classList.toggle('active');
    historyContent.classList.toggle('active');
});

toggleStrategies.addEventListener('click', () => {
    toggleStrategies.classList.toggle('active');
    strategiesContent.classList.toggle('active');
});


    // Settings Toggle
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsContent = document.getElementById('settingsContent');

    if (settingsToggle && settingsContent) {
        settingsToggle.addEventListener('click', () => {
            settingsContent.classList.toggle('active');
            const icon = settingsToggle.querySelector('i');
            if (settingsContent.classList.contains('active')) {
                icon.className = 'fa-solid fa-times';
            } else {
                icon.className = 'fa-solid fa-key';
            }
        });
    }

    // Toggle API Key Visibility
toggleApiKeyBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleApiKeyBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
        apiKeyInput.type = 'password';
        toggleApiKeyBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
});

// Drag and Drop Events
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

// File Input Change Event
imageInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

// Reset Upload
resetBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Ota elementning click eventini to'xtatadi
    resetUpload();
});

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Iltimos, faqat rasm faylini yuklang!');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        currentBase64Image = e.target.result;
        imagePreview.src = currentBase64Image;
        previewContainer.style.display = 'block';
        document.getElementById('uploadContent').style.display = 'none'; // Hide upload instructions
        dropZone.style.padding = '1rem'; // Reduce padding for image
        analyzeBtn.disabled = false;
        resultContainer.style.display = 'none'; // Yangi rasm yuklanganda eski natijani yashirish
    };
    reader.readAsDataURL(file);
}

// Outcome Modal Elements
const outcomeModal = document.getElementById('outcomeModal');
const btnProfit = document.getElementById('btnProfit');
const btnLoss = document.getElementById('btnLoss');
const btnSkipOutcome = document.getElementById('btnSkipOutcome');

function resetUpload() {
    if (lastAnalysisResult && !lastAnalysisResult.outcomePrompted) {
        // Show custom modal instead of alert
        outcomeModal.classList.add('active');
        return; // Wait for user interaction in modal
    }

    performReset();
}

function performReset() {
    currentBase64Image = null;
    imageInput.value = '';
    previewContainer.style.display = 'none';
    document.getElementById('uploadContent').style.display = 'block'; // Show upload instructions
    dropZone.style.padding = '6rem 2rem'; // Restore padding
    imagePreview.src = '';
    analyzeBtn.disabled = true;
    lastAnalysisResult = null;
    resultContainer.style.display = 'none';
    outcomeModal.classList.remove('active');
}

// Modal Button Listeners
btnProfit.addEventListener('click', () => saveOutcome("Foydada"));
btnLoss.addEventListener('click', () => saveOutcome("Ziyon bilan"));
btnSkipOutcome.addEventListener('click', () => performReset());

function saveOutcome(outcome) {
    if (lastAnalysisResult) {
        lastAnalysisResult.outcome = outcome;
        lastAnalysisResult.outcomePrompted = true;

        const historyIndex = signalHistory.findIndex(item => item.timestamp === lastAnalysisResult.timestamp);
        if (historyIndex !== -1) {
            signalHistory[historyIndex].outcome = outcome;
            localStorage.setItem('signalHistory', JSON.stringify(signalHistory));
            updateListsUI();
        }
    }
    performReset();
}

analyzeBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('Iltimos API Key kiriting!');
        apiKeyInput.focus();
        return;
    }

    if (!currentBase64Image) {
        alert('Iltimos tahlil qilish uchun rasm yuklang!');
        return;
    }

    // UI State Update
    analyzeBtn.disabled = true;
    loadingState.style.display = 'block';
    resultContainer.style.display = 'none';
    
    // Smooth scroll to loading state
    loadingState.scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
        const { result, usage } = await analyzeWithOpenAI(currentBase64Image, apiKey);
        displayResult(result);
        updateTokenUsage(usage.total_tokens);
        
        // Smooth scroll to top of results
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
        
    } catch (error) {
        console.error(error);
        alert("Xatolik yuz berdi: " + error.message);
    } finally {
        analyzeBtn.disabled = false;
        loadingState.style.display = 'none';
    }
});

async function analyzeWithOpenAI(base64Image, apiKey) {
    // Extract base64 properly
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.split(';')[0].split(':')[1];

    const promptText = `
    Sen O'zbekistondagi eng kuchli crypto va forex texnik analizatorisan.
    Foydalanuvchi yuborgan trading chart rasmini diqqat bilan tahlil qil.
    Quyidagi muhim jihatlarga e'tibor ber:
    1. Trend yo'nalishi (up, down, sideway)
    2. Support va Resistance zonalar
    3. Candlestick patternlar
    4. Indikatorlar (agar ko'rinsa: RSI, MACD, EMA vs)
    
    Tahlildan so'ng, qat'iy va aynan quyidagi JSON formatida javob berishing SHART:
    {
      "signal": "BUY", 
      "confidence": "85%",
      "entryPrice": "1.0543",
      "takeProfit": "1.0600",
      "stopLoss": "1.0500",
      "analysis": "Rasmdagi holatga ko'ra narx o'zining kuchli support zonasiga kelgan. Shuningdek, RSI indikatori oversold (haddan tashqari sotilgan) holatini ko'rsatmoqda. Bullish engulfing patterni shakllangani uchun narxning o'sish ehtimoli yuqori..."
    }
    
    Eslatma:
    - signal qiymati faqay "BUY", "SELL" yoki "NEUTRAL" bo'lishi mumkin.
    - confidence (ishonch foizi) raqam va % belgisi bo'lsin.
    - entryPrice agar aniq bo'lmasa "Hozirgi narx" deb yozing.
    - agar imkoni boricha rasmda ko'ringan narxlarga qarab TP va SL ni aniq raqamlarda bergin.
    - Javob faqat JSON object ko'rinishida bo'lsin, boshqa hech qanday so'z qo'shma.
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "Siz ekspert treyder va texnik tahlilchisiz. Siz faqat JSON formatida javob qaytarasiz."
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: promptText },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64Data}`,
                                detail: "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens: 800,
            temperature: 0.1, // Aniqroq natija olish uchun past temperature
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) {
        let errMsg = "OpenAI bilan bog'lanishda xatolik";
        try {
            const errorData = await response.json();
            errMsg = errorData.error?.message || errMsg;
        } catch(e) {}
        throw new Error(errMsg);
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content;
    const usage = data.usage;
    
    try {
        return {
            result: JSON.parse(resultText),
            usage: usage
        };
    } catch (e) {
        throw new Error("AI noto'g'ri formatda javob qaytardi.");
    }
}

function updateTokenUsage(tokens) {
    totalTokenUsage += tokens;
    localStorage.setItem('totalTokenUsage', totalTokenUsage);
    
    document.getElementById('lastUsage').textContent = tokens;
    updateUsageUI();
}

function updateUsageUI() {
    const totalEl = document.getElementById('totalUsage');
    if (totalEl) {
        totalEl.textContent = totalTokenUsage.toLocaleString();
    }
}

function displayResult(data) {
    const signalBadgeEl = document.getElementById('signalBadge');
    const confidenceEl = document.getElementById('confidence');
    const entryEl = document.getElementById('entryPrice');
    const tpEl = document.getElementById('takeProfit');
    const slEl = document.getElementById('stopLoss');
    const analysisEl = document.getElementById('analysisContent');

    // Default holatga qaytarish orqali tozalash
    signalBadgeEl.className = 'signal-badge';
    
    // Yangi ma'lumotlarni o'rnatish
    signalBadgeEl.textContent = data.signal.toUpperCase();
    
    // Ranga moslash
    if (data.signal.toUpperCase() === 'BUY') {
        signalBadgeEl.classList.add('buy');
    } else if (data.signal.toUpperCase() === 'SELL') {
        signalBadgeEl.classList.add('sell');
    } else {
        signalBadgeEl.classList.add('neutral');
    }
    
    confidenceEl.textContent = data.confidence;
    entryEl.textContent = data.entryPrice;
    tpEl.textContent = data.takeProfit;
    slEl.textContent = data.stopLoss;
    
    // Tahlil matnini HTML qilib qo'yish
    analysisEl.innerHTML = formatTextToParagraphs(data.analysis);

    resultContainer.style.display = 'block';

    // Save to history and keep last result for saving as strategy
    lastAnalysisResult = { ...data, timestamp: new Date().toLocaleString() };
    saveToHistory(lastAnalysisResult);
}

// Logic for Saving
saveStrategyBtn.addEventListener('click', () => {
    if (lastAnalysisResult) {
        saveToStrategies(lastAnalysisResult);
        alert('Strategiya muvaffaqiyatli saqlandi!');
    }
});

function saveToHistory(item) {
    signalHistory.unshift(item); // Add to beginning
    if (signalHistory.length > 50) signalHistory.pop(); // Keep last 50
    localStorage.setItem('signalHistory', JSON.stringify(signalHistory));
    updateListsUI();
}

function saveToStrategies(item) {
    // Check if already saved (basic check by timestamp)
    if (savedStrategies.some(s => s.timestamp === item.timestamp)) return;
    
    savedStrategies.unshift(item);
    localStorage.setItem('savedStrategies', JSON.stringify(savedStrategies));
    updateListsUI();
}

window.deleteHistoryItem = function(index) {
    signalHistory.splice(index, 1);
    localStorage.setItem('signalHistory', JSON.stringify(signalHistory));
    updateListsUI();
};

window.deleteStrategyItem = function(index) {
    savedStrategies.splice(index, 1);
    localStorage.setItem('savedStrategies', JSON.stringify(savedStrategies));
    updateListsUI();
};


function updateListsUI() {
    // Update History
    historyCount.textContent = signalHistory.length;
    if (signalHistory.length === 0) {
        historyList.innerHTML = '<div class="empty-msg">Hozircha tarix mavjud emas</div>';
    } else {
        historyList.innerHTML = signalHistory.map((item, index) => `
            <div class="signal-item">
                <div class="item-left">
                    <div class="item-title">
                        <span class="item-badge ${item.signal.toLowerCase()}">${item.signal}</span>
                        ${item.outcome ? `<span class="item-outcome ${item.outcome === 'Foydada' ? 'profit' : 'loss'}">${item.outcome}</span>` : ''}
                        <span class="item-price">${item.entryPrice}</span>
                    </div>
                    <span class="item-date">${item.timestamp}</span>
                </div>
                <div class="item-actions">
                    <button class="btn-item-action view" onclick="viewSignalDetails(${index}, 'history')" title="Ko'rish"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn-item-action delete" onclick="deleteHistoryItem(${index})" title="O'chirish"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }

    // Update Strategies
    strategiesCount.textContent = savedStrategies.length;
    if (savedStrategies.length === 0) {
        strategiesList.innerHTML = '<div class="empty-msg">Saqlangan strategiyalar yo\'q</div>';
    } else {
        strategiesList.innerHTML = savedStrategies.map((item, index) => `
            <div class="signal-item">
                <div class="item-left">
                    <div class="item-title">
                        <span class="item-badge ${item.signal.toLowerCase()}">${item.signal}</span>
                        ${item.outcome ? `<span class="item-outcome ${item.outcome === 'Foydada' ? 'profit' : 'loss'}">${item.outcome}</span>` : ''}
                        <span class="item-price">${item.entryPrice}</span>
                    </div>
                    <span class="item-date">${item.timestamp}</span>
                </div>
                <div class="item-actions">
                    <button class="btn-item-action view" onclick="viewSignalDetails(${index}, 'strategy')" title="Ko'rish"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn-item-action delete" onclick="deleteStrategyItem(${index})" title="O'chirish"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }
}

// Function to view details from the list
window.viewSignalDetails = function(index, type) {
    const data = type === 'history' ? signalHistory[index] : savedStrategies[index];
    displayResult(data);
    
    // Prevent auto-saving back to history if we are viewing from lists
    // We can do this by checking if we're already viewing it
    // But for simplicity, we'll just scroll up
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function formatTextToParagraphs(text) {
    if (!text) return "";
    return text.split('\n')
               .filter(line => line.trim() !== '')
               .map(line => `<p style="margin-bottom: 0.5rem">${line}</p>`)
               .join('');
}




