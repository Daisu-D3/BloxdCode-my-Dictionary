let dataList = [];

const statusText = document.getElementById('statusText');
const searchBox = document.getElementById('searchBox');
const listContainer = document.getElementById('listContainer');
const toast = document.getElementById('toast');

// ページを開いた瞬間に自動でファイルを読み込む
window.addEventListener('DOMContentLoaded', async () => {
    statusText.innerHTML = "⏳ データを自動読み込み中...";
    
    try {
        // blocks.txt と api.md (またはtxt) を同時に読み込む
        const [blocksResponse, apiResponse] = await Promise.all([
            fetch('blocks.txt').catch(() => null),
            fetch('api.md').catch(() => fetch('api.txt').catch(() => null))
        ]);

        let blockCount = 0;
        let apiCount = 0;

        // ブロックファイルの解析
        if (blocksResponse && blocksResponse.ok) {
            const blocksText = await blocksResponse.text();
            blockCount = parseBlockData(blocksText);
        }

        // APIファイルの解析
        if (apiResponse && apiResponse.ok) {
            const apiText = await apiResponse.text();
            apiCount = parseApiData(apiText);
        }

        // 読み込み結果の表示
        if (blockCount === 0 && apiCount === 0) {
            statusText.innerHTML = "⚠️ データファイルが見つかりません。<br><small>同じフォルダに blocks.txt や api.md を配置してください。</small>";
        } else {
            statusText.innerHTML = `✅ 読み込み完了: ブロック ${blockCount} 件 / API ${apiCount} 件`;
            searchBox.disabled = false;
            searchBox.value = "";
            renderList(dataList);
        }

    } catch (error) {
        console.error(error);
        statusText.textContent = "❌ データの読み込み中にエラーが発生しました。";
    }
});

// ブロックデータ解析
function parseBlockData(text) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== "");
    lines.forEach((name, index) => {
        dataList.push({
            id: `block-${index}`,
            type: 'block',
            name: name,
            description: '',
            params: [],
            rawText: name
        });
    });
    return lines.length;
}

// APIデータ解析
function parseApiData(text) {
    const sections = text.split(/##\s+/);
    let count = 0;
    
    sections.forEach((section, index) => {
        if (!section.trim()) return;

        const lines = section.split('\n');
        const name = lines[0].trim();
        
        let description = "";
        let tableStarted = false;
        let tableLines = [];
        let rawText = section;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('|')) {
                tableStarted = true;
                tableLines.push(line);
            } else if (tableStarted && line === "") {
                tableStarted = false;
            } else if (!tableStarted && line !== "" && !line.startsWith('###')) {
                if (!line.startsWith('Returns:')) {
                    description += (description ? "\n" : "") + line;
                }
            }
        }

        const params = [];
        if (tableLines.length > 2) {
            for (let j = 2; j < tableLines.length; j++) {
                const cols = tableLines[j].split('|').map(c => c.trim()).filter(c => c !== "");
                if (cols.length >= 2) {
                    params.push({
                        name: cols[0] || "",
                        type: cols[1] || "",
                        desc: cols[2] || ""
                    });
                }
            }
        }

        dataList.push({
            id: `api-${index}`,
            type: 'api',
            name,
            description,
            params,
            rawText
        });
        count++;
    });
    return count;
}

// 検索処理
searchBox.addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase();
    const filtered = dataList.filter(item => item.rawText.toLowerCase().includes(keyword));
    renderList(filtered);
});

// リスト表示
function renderList(items) {
    listContainer.innerHTML = "";
    
    if (items.length === 0) {
        listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">一致するデータが見つかりません</div>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'api-card';
        card.id = item.id;

        const header = document.createElement('div');
        header.className = 'api-header';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'api-name';
        nameDiv.textContent = item.name;

        const btnArea = document.createElement('div');
        btnArea.className = 'action-btns';

        const copyNameBtn = document.createElement('button');
        copyNameBtn.className = 'btn btn-copy-name';
        copyNameBtn.textContent = 'コピー';
        copyNameBtn.addEventListener('click', () => {
            copyToClipboard(item.name, copyNameBtn, 'コピー');
        });
        btnArea.appendChild(copyNameBtn);

        if (item.type === 'api') {
            const translateBtn = document.createElement('button');
            translateBtn.className = 'btn btn-translate';
            translateBtn.textContent = '翻訳';
            translateBtn.addEventListener('click', () => {
                translateCard(item, card, translateBtn);
            });
            btnArea.appendChild(translateBtn);

            const copyAllBtn = document.createElement('button');
            copyAllBtn.className = 'btn btn-copy-all';
            copyAllBtn.textContent = '全説明コピー';
            copyAllBtn.addEventListener('click', () => {
                copyToClipboard(`## ${item.rawText}`, copyAllBtn, '全説明コピー');
            });
            btnArea.appendChild(copyAllBtn);
        }

        header.appendChild(nameDiv);
        header.appendChild(btnArea);
        card.appendChild(header);

        if (item.type === 'api' && item.description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'api-description';
            descDiv.textContent = item.description;
            card.appendChild(descDiv);
        }

        if (item.type === 'api' && item.params.length > 0) {
            const table = document.createElement('table');
            table.className = 'param-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Parameter</th>
                        <th>Type</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    ${item.params.map(p => `
                        <tr>
                            <td><strong>${p.name}</strong></td>
                            <td><span class="param-type">${escapeHtml(p.type)}</span></td>
                            <td class="param-desc">${escapeHtml(p.desc)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
            card.appendChild(table);
        }

        listContainer.appendChild(card);
    });
}

// 翻訳実行処理
async function translateCard(item, cardElement, button) {
    if (button.disabled || button.textContent === '翻訳済') return;
    
    button.textContent = '翻訳中...';
    button.disabled = true;

    try {
        if (item.description) {
            const translatedDesc = await fetchTranslation(item.description);
            const descDiv = cardElement.querySelector('.api-description');
            if (descDiv) {
                const transDiv = document.createElement('div');
                transDiv.className = 'translated-text';
                transDiv.textContent = translatedDesc;
                descDiv.parentNode.insertBefore(transDiv, descDiv.nextSibling);
            }
        }

        const descCells = cardElement.querySelectorAll('.param-desc');
        for (let cell of descCells) {
            const originalText = cell.textContent.trim();
            if (originalText && originalText !== '-') {
                const translatedParam = await fetchTranslation(originalText);
                const transDiv = document.createElement('div');
                transDiv.className = 'translated-text';
                transDiv.style.margin = '4px 0 0 0';
                transDiv.textContent = translatedParam;
                cell.appendChild(transDiv);
            }
        }

        button.textContent = '翻訳済';
        button.style.backgroundColor = '#7f8c8d';
    } catch (error) {
        console.error(error);
        button.textContent = '失敗(再試行)';
        button.disabled = false;
    }
}

// 翻訳APIのリクエスト関数
async function fetchTranslation(text) {
    if (!text.trim()) return text;
    const response = await fetch(`https://translated.net{encodeURIComponent(text)}&langpair=en|ja`);
    if (!response.ok) throw new Error('翻訳失敗');
    const data = await response.json();
    return data.responseData.translatedText;
}

// コピー処理
function copyToClipboard(text, button, originalText) {
    navigator.clipboard.writeText(text).then(() => {
        showToast();
        button.textContent = '完了!';
        button.classList.add('copied');
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 1200);
    });
}

function showToast() {
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 1500);
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
