// AI suggestion module for EcoCityBuilder

// IMPORTANT: Replace with your actual DeepSeek API Key
// It's highly recommended to manage API keys securely, not hardcoding them.
const DEEPSEEK_API_KEY = 'sk-9e68aaeeb7c342fcb8eb9a5748bc6780'; // 使用现有文件中的Key，但提示用户替换
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

let isGameReady = false; // Flag to track if the game scene is ready

// --- Internal Helper Function for API Calls ---
async function callDeepSeekInternal(prompt, apiKey, maxTokens = 200) {
    const suggestionTextElement = document.getElementById('suggestion-text');
    suggestionTextElement.textContent = '正在联系 AI 助手...'; // Generic loading message

    // REMOVED/COMMENTED OUT: Check for default/placeholder API key
    /*
    if (apiKey === 'YOUR_API_KEY' || apiKey === 'sk-9e68aaeeb7c342fcb8eb9a5748bc6780') {
        console.warn("Using a default or placeholder API Key. Please replace it with your actual DeepSeek API Key in src/js/ai.js. AI suggestions will be simulated.");
        suggestionTextElement.textContent = '警告：正在使用默认 API 密钥。AI 功能受限。';
        return null; 
    }
    */

    // Directly proceed with the API call using the provided apiKey
    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "deepseek-chat", // Use the appropriate model
                messages: [{
                    role: "user",
                    content: prompt
                }],
                temperature: 0.5, // Slightly lower temp for more deterministic rule summary
                max_tokens: maxTokens // Use the passed or default maxTokens value
            })
        });

        if (!response.ok) {
            let errorMsg = `API 请求失败: ${response.status}`;
            try {
                const errorData = await response.json();
                console.error('API Error:', response.status, errorData);
                errorMsg += ` ${errorData.error?.message || '未知错误'}`;
                if (response.status === 401) { // Unauthorized
                    errorMsg += '。请检查您的 DeepSeek API 密钥是否正确并有效。';
                }
            } catch (e) {
                console.error('Failed to parse error response:', e);
                errorMsg += ' (无法解析错误详情)';
            }
            suggestionTextElement.textContent = errorMsg;
            return null; // Indicate error
        }

        const data = await response.json();
        console.log("API Response:", data);

        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content.trim(); // Return the content
        } else {
            suggestionTextElement.textContent = '未能从 AI 获取有效响应。';
            return null; // Indicate error
        }

    } catch (error) {
        console.error('Error during DeepSeek API call:', error);
        let errorText = '调用 AI 时出错。';
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            errorText += ' 请检查您的网络连接。';
        } else {
            errorText += ' 请检查网络连接或API密钥配置。';
        }
        suggestionTextElement.textContent = errorText;
        return null; // Indicate error
    }
}

document.addEventListener('game-ready', () => {
    console.log('AI module received game-ready event.');
    console.log('AI module: typeof window.getGameState in game-ready listener:', typeof window.getGameState); // Add log
    isGameReady = true;
    // Enable buttons now that the game is ready
    const aiButton = document.getElementById('ai-button');
    const sendQuestionButton = document.getElementById('send-ai-question');
    const questionInput = document.getElementById('ai-question-input');
    if(aiButton) aiButton.disabled = false;
    if(sendQuestionButton) sendQuestionButton.disabled = false;
    if(questionInput) questionInput.disabled = false;
    // Update suggestion text if it was showing an error or waiting message
    const suggestionTextElement = document.getElementById('suggestion-text');
    if (suggestionTextElement && (suggestionTextElement.textContent.startsWith('错误：') || suggestionTextElement.textContent === '等待游戏加载...')) {
        suggestionTextElement.textContent = '游戏已就绪，点击按钮获取建议...';
    }
});

async function getAISuggestion() {
    console.log("Attempting to get AI suggestion...");
    console.log('AI module: typeof window.getGameState at start of getAISuggestion:', typeof window.getGameState); // Add log
    const suggestionTextElement = document.getElementById('suggestion-text');
    if (!suggestionTextElement) {
        console.error("Suggestion text element not found!");
        return;
    }

    suggestionTextElement.textContent = '正在思考...'; // Indicate loading

    // 0. Check if game is ready
    if (!isGameReady) {
        console.warn("Game is not ready yet. AI suggestion aborted.");
        suggestionTextElement.textContent = '错误：游戏尚未准备就绪，请稍候...';
        return;
    }

    // 1. Gather current game state using the exposed function
    let currentGameState;
    // Double-check if the function exists even after game-ready
    if (typeof window.getGameState === 'function') {
        currentGameState = window.getGameState();
    } else {
        console.error("getGameState function is not accessible even after game-ready event!");
        suggestionTextElement.textContent = '错误：游戏已就绪但无法访问状态函数。';
        return;
    }

    if (!currentGameState) {
        console.error("Failed to retrieve game state!");
        suggestionTextElement.textContent = '错误：无法获取游戏状态。';
        return;
    }

    // Process buildings array to get counts
    const buildingCounts = currentGameState.buildings.reduce((acc, building) => {
        acc[building.type] = (acc[building.type] || 0) + 1;
        return acc;
    }, {});

    const gameState = {
        money: currentGameState.money,
        pollution: currentGameState.pollution,
        happiness: currentGameState.happiness,
        population: currentGameState.population,
        buildings: buildingCounts, // Use the calculated counts
        // events: currentEvents || [] // Add if event tracking is implemented
    };

    // 2. Format the input prompt for the LLM
    let prompt = `当前城市状态：\n`;
    prompt += `- 资金：${gameState.money}\n`;
    prompt += `- 污染：${gameState.pollution}\n`;
    prompt += `- 居民满意度：${gameState.happiness}\n`;
    prompt += `- 人口：${gameState.population}\n`;
    prompt += `- 建筑分布：`;
    const buildingDesc = Object.entries(gameState.buildings)
                             .map(([type, count]) => `${count}个${buildingData[type]?.imageKey || type}`) // Use readable names if possible
                             .join('，');
    prompt += buildingDesc || '无';
    // prompt += `\n- 近期事件：${gameState.events.join('，') || '无'}`; // Uncomment if events are added
    prompt += `\n\n游戏目标：\n`;
    prompt += `1. 零碳城市：污染降至0，资金≥5000。\n`;
    prompt += `2. 人口繁荣：满意度≥80，人口≥100000。\n`;
    prompt += `3. 经济霸主：资金≥30000。\n`;
    prompt += `请根据当前状况，提供3条中文优化建议，帮助我达成任一目标，每条建议不超过30字并简述理由。`;

    console.log("Formatted Prompt:\n", prompt);

    // 3. Call the DeepSeek API
    try {
        // Simple check if the key is still the placeholder/default
        if (DEEPSEEK_API_KEY === 'YOUR_API_KEY' || DEEPSEEK_API_KEY === 'sk-115f9a71a87a4bd6bd58c5b100495da3') { // Check against placeholder and the one found
             console.warn("Using a default or placeholder API Key. Please replace it with your actual DeepSeek API Key in src/js/ai.js. AI suggestions will be simulated.");
             // Simulate a response for testing
             const simulatedResponse = `1. 建议建造公园：可降低污染(-2)，提升满意度(+5)。\n2. 考虑增加住宅：提升人口(+100)和满意度(+2)。\n3. 若资金允许，用太阳能电站替换工厂：大幅减少污染。`;
             suggestionTextElement.innerHTML = simulatedResponse.replace(/\n/g, '<br>'); // Display simulated response
             return;
        }

        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "deepseek-chat", // Use the appropriate model
                messages: [{
                    role: "user",
                    content: prompt
                }],
                temperature: 0.7,
                max_tokens: 150 // Increased token limit for more detailed suggestions
            })
        });

        if (!response.ok) {
            let errorMsg = `API 请求失败: ${response.status}`;
            try {
                const errorData = await response.json();
                console.error('API Error:', response.status, errorData);
                errorMsg += ` ${errorData.error?.message || '未知错误'}`;
                if (response.status === 401) { // Unauthorized
                    errorMsg += '。请检查您的 DeepSeek API 密钥是否正确并有效。';
                }
            } catch (e) {
                console.error('Failed to parse error response:', e);
                errorMsg += ' (无法解析错误详情)';
            }
            suggestionTextElement.textContent = errorMsg;
            return;
        }

        const data = await response.json();
        console.log("API Response:", data);

        // 4. Parse and display the response
        if (data.choices && data.choices.length > 0) {
            const suggestion = data.choices[0].message.content.trim();
            // suggestionTextElement.innerHTML = suggestion.replace(/\n/g, '<br>');
            displaySuggestionsWithActions(suggestion);
            // TODO: Optionally add to history log
        } else {
            suggestionTextElement.textContent = '未能获取建议。';
        }

    } catch (error) {
        console.error('Error fetching AI suggestion:', error);
        let errorText = '获取建议时出错。';
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            errorText += ' 请检查您的网络连接。';
        } else {
            errorText += ' 请检查网络连接或API密钥配置。';
        }
        suggestionTextElement.textContent = errorText;
    }
}

// Ensure the function is globally accessible if called via onclick in HTML
// or via event listener set up after DOMContentLoaded
// Function to handle user's specific questions
async function askAIQuestion() {
    console.log("Attempting to answer user question...");
    console.log('AI module: typeof window.getGameState at start of askAIQuestion:', typeof window.getGameState); // Add log
    const questionInputElement = document.getElementById('ai-question-input');
    const suggestionTextElement = document.getElementById('suggestion-text');

    if (!questionInputElement || !suggestionTextElement) {
        console.error("Required elements (input or suggestion text) not found!");
        return;
    }

    const userQuestion = questionInputElement.value.trim();
    if (!userQuestion) {
        suggestionTextElement.textContent = '请输入您的问题。';
        return;
    }

    suggestionTextElement.textContent = '正在思考您的问题...'; // Indicate loading
    questionInputElement.disabled = true; // Disable input while processing
    document.getElementById('send-ai-question').disabled = true;

    // 0. Check if game is ready
    if (!isGameReady) {
        console.warn("Game is not ready yet. AI question aborted.");
        suggestionTextElement.textContent = '错误：游戏尚未准备就绪，请稍候...';
        questionInputElement.disabled = false;
        document.getElementById('send-ai-question').disabled = false;
        return;
    }

    // 1. Gather current game state
    let currentGameState;
    if (typeof window.getGameState === 'function') {
        currentGameState = window.getGameState();
    } else {
        console.error("getGameState function is not accessible when asking question!");
        suggestionTextElement.textContent = '错误：无法访问游戏状态函数。';
        questionInputElement.disabled = false;
        document.getElementById('send-ai-question').disabled = false;
        return;
    }

    if (!currentGameState) {
        console.error("Failed to retrieve game state for question!");
        suggestionTextElement.textContent = '错误：无法获取游戏状态。';
        questionInputElement.disabled = false;
        document.getElementById('send-ai-question').disabled = false;
        return;
    }

    // Process buildings array to get counts
    const buildingCounts = currentGameState.buildings.reduce((acc, building) => {
        acc[building.type] = (acc[building.type] || 0) + 1;
        return acc;
    }, {});

    const gameStateForPrompt = {
        money: currentGameState.money,
        pollution: currentGameState.pollution,
        happiness: currentGameState.happiness,
        population: currentGameState.population,
        buildings: buildingCounts
    };

    // Retrieve the full game rules (ensure game.js loaded first)
    let fullRulesContext = '';
    if (typeof fullGameRulesMarkdown === 'string' && fullGameRulesMarkdown.length > 100) { // Basic check for content
        fullRulesContext = fullGameRulesMarkdown;
        console.log("Successfully retrieved fullGameRulesMarkdown for AI prompt."); // Add confirmation log
    } else {
        console.error('CRITICAL: fullGameRulesMarkdown not found or empty! AI CANNOT follow rules.');
        suggestionTextElement.textContent = '错误：无法加载游戏规则，AI无法提供有效建议。';
        // Re-enable inputs and return
        questionInputElement.disabled = false;
        document.getElementById('send-ai-question').disabled = false;
        questionInputElement.value = userQuestion; // Keep user question
        return; // Stop execution if rules are missing
    }

    // 2. Format the input prompt with STRONG instructions
    const instructions = 
`**CRITICAL INSTRUCTIONS:**
1. You MUST act as a game advisor for EcoCity Builder.
2. Your advice MUST be based **STRICTLY AND SOLELY** on the provided 'GAME RULES' below.
3. **ONLY suggest buildings, mechanics, and values EXPLICITLY defined in the 'GAME RULES'.** Check the list carefully before answering.
4. **DO NOT mention, suggest, or hallucinate ANY building, mechanic, or value NOT present in the 'GAME RULES'.**
5. All values (cost, pollution, happiness, income, limits, etc.) MUST match the 'GAME RULES' exactly.
6. **Respond ONLY in Chinese (中文).**
7. Use the exact English building names as defined in the 'GAME RULES' table (e.g., 'House', 'Factory', 'Wastewater') when referring to specific buildings, but provide the rest of the explanation in Chinese.
`;

    let gameStatePrompt = `**Current City State:**\n`;
    gameStatePrompt += `- Money: ${gameStateForPrompt.money}\n`;
    gameStatePrompt += `- Pollution: ${gameStateForPrompt.pollution}\n`;
    gameStatePrompt += `- Happiness: ${gameStateForPrompt.happiness}\n`;
    gameStatePrompt += `- Population: ${gameStateForPrompt.population}\n`;
    gameStatePrompt += `- Buildings: `;
    const buildingDesc = Object.entries(gameStateForPrompt.buildings)
                             .map(([type, count]) => `${count} ${window.buildingData?.[type]?.displayName || type}`) // Use DisplayName for status
                             .join(', ') || 'None';
    gameStatePrompt += buildingDesc + '\n';

    const rulesSection = 
`**GAME RULES:**
---
${fullRulesContext}
---
`;

    const questionSection = `**User Question:**
${userQuestion}`;

    // Assemble the final prompt with instructions first
    const finalPrompt = `${instructions}
${gameStatePrompt}
${rulesSection}
${questionSection}

Based ONLY on the rules and current state, answer the user question in Chinese:`;

    console.log("Formatted Prompt for Question (check instructions and rules):");
    console.log(finalPrompt);

    // 3. Call the DeepSeek API using the internal helper - explicitly pass a higher max_tokens
    const answer = await callDeepSeekInternal(finalPrompt, DEEPSEEK_API_KEY, 500); // Increased max_tokens to 500

    // 4. Parse and display the response
    if (answer) {
        // suggestionTextElement.innerHTML = answer.replace(/\n/g, '<br>');
        displaySuggestionsWithActions(answer); // Use existing function if it parses/displays well
    } else {
        // Error message already set by callDeepSeekInternal
        console.log("Failed to get answer from AI.");
    }

    // Re-enable input
    questionInputElement.disabled = false;
    document.getElementById('send-ai-question').disabled = false;
    if(!answer) { // Keep user question if AI failed
        questionInputElement.value = userQuestion;
    } else {
        questionInputElement.value = ''; // Clear input on success
    }
}

// Add event listeners after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Remove the aiButton listener setup from here
    // const aiButton = document.getElementById('ai-button'); 
    const sendQuestionButton = document.getElementById('send-ai-question');
    const questionInput = document.getElementById('ai-question-input');

    // Keep listener setup for question input and button
    // if (aiButton) { 
    //     aiButton.addEventListener('click', getAISuggestion);
    //     aiButton.disabled = true; // Disable initially until game is ready
    // }
    if (sendQuestionButton) {
        sendQuestionButton.addEventListener('click', askAIQuestion);
        sendQuestionButton.disabled = true; // Disable initially until game is ready
    }
    // Optional: Allow pressing Enter in the input field to send the question
    if (questionInput) {
        questionInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter' && !sendQuestionButton.disabled) { // Only send if button is enabled
                askAIQuestion();
            }
        });
        questionInput.disabled = true; // Disable initially
    }

    // Initial message indicating waiting for game
    const suggestionTextElement = document.getElementById('suggestion-text');
    if (suggestionTextElement) {
        suggestionTextElement.textContent = '等待游戏加载...';
    }
    
    // Also disable the rules button initially (it will be enabled in game-ready listener)
    const rulesButton = document.getElementById('ai-button'); 
    if (rulesButton) {
        rulesButton.disabled = true;
    }
});

// Make original function globally accessible if needed elsewhere, though event listener is preferred
window.getAISuggestion = getAISuggestion;
// Make new function globally accessible if needed
window.askAIQuestion = askAIQuestion;


// New function to display suggestions and add action buttons
function displaySuggestionsWithActions(suggestionText) {
    const suggestionTextElement = document.getElementById('suggestion-text');
    if (!suggestionTextElement) return;

    suggestionTextElement.innerHTML = ''; // Clear previous suggestions
    const suggestions = suggestionText.split('\n').filter(s => s.trim() !== '');

    suggestions.forEach((suggestion, index) => {
        const suggestionDiv = document.createElement('div');
        suggestionDiv.classList.add('suggestion-item');

        const textSpan = document.createElement('span');
        textSpan.textContent = suggestion;
        suggestionDiv.appendChild(textSpan);

        // Try to parse action
        const action = parseActionFromSuggestion(suggestion);
        if (action) {
            const actionButton = document.createElement('button');
            actionButton.textContent = `执行 ${action.type}`; // e.g., 执行 建造公园
            actionButton.classList.add('pixel-button', 'action-button');
            actionButton.onclick = () => {
                console.log(`Executing action: ${action.type} ${action.target || ''}`);
                // Call the game function to perform the action
                if (window.game && typeof window.game.placeBuildingByType === 'function') {
                    window.game.placeBuildingByType(action.target);
                } else {
                    console.error('Game function placeBuildingByType not found!');
                    alert('无法执行操作：游戏功能未找到。');
                }
            };
            suggestionDiv.appendChild(actionButton);
        }

        suggestionTextElement.appendChild(suggestionDiv);
    });
}

// Simple parser for actions (can be improved with regex)
function parseActionFromSuggestion(suggestion) {
    suggestion = suggestion.toLowerCase(); // Case-insensitive matching
    if (suggestion.includes('建造公园') || suggestion.includes('建公园')) {
        return { type: '建造', target: 'park' };
    }
    if (suggestion.includes('增加住宅') || suggestion.includes('建住宅')) {
        return { type: '建造', target: 'house' };
    }
    if (suggestion.includes('建造工厂') || suggestion.includes('建工厂')) {
        return { type: '建造', target: 'factory' };
    }
    if (suggestion.includes('太阳能电站') || suggestion.includes('建太阳能')) {
        return { type: '建造', target: 'solar' };
    }
    if (suggestion.includes('风力涡轮机') || suggestion.includes('建风力')) {
        return { type: '建造', target: 'wind' };
    }
    // Add more building types as needed
    // Example for removal (if needed later)
    // if (suggestion.includes('拆除工厂')) {
    //     return { type: '拆除', target: 'factory' };
    // }
    return null; // No clear action found
}

// Event listener for the main AI button
// Make original function globally accessible if needed elsewhere, though event listener is preferred
window.getAISuggestion = getAISuggestion;
// Make new function globally accessible if needed
window.askAIQuestion = askAIQuestion;