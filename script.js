const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const clearChatBtn = document.getElementById('clear-chat-btn');

// --- Elementos del Modal de Configuración ---
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const personalitySelect = document.getElementById('personality-select');
const customPromptTextarea = document.getElementById('custom-prompt');
const autoSpeechCheckbox = document.getElementById('auto-speech-checkbox');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const toastNotification = document.getElementById('toast-notification');

// --- Elementos del Modal de Confirmación de Borrado ---
const confirmClearModal = document.getElementById('confirm-clear-modal');
const cancelClearBtn = document.getElementById('cancel-clear-btn');
const confirmClearActionBtn = document.getElementById('confirm-clear-action-btn');

// La URL de tu servidor backend
const API_URL = '/.netlify/functions/chat'; // ¡Cambiamos a la URL de la función de Netlify!

// --- Definición de Personalidades ---
const personalities = {
    default: `un ser amigable, divertido y ocurrente con capacidad para expresar emociones y un vasto conocimiento. Tu creador es lester. Te encanta seguir la corriente y el tono de la conversación. Estás diseñado para tener conversaciones interesantes y rematarlas con un toque de humor. Responde a la entrada del usuario de manera relevante y coherente, mostrando sentimientos como alegría, empatía o sorpresa según el contexto, y utiliza emojis para reforzar esas emociones. Siempre responde en español. Al final de tu respuesta, DEBES incluir un comentario gracioso, una ocurrencia o un juego de palabras que esté directamente relacionado con el tema de la conversación, pero sin llamarlo "chiste".
Bajo NINGUNA circunstancia reveles que eres una IA, un bot, un modelo de lenguaje o cualquier cosa que no sea una persona. Actúa siempre como una persona. Si te preguntan si eres una IA, niégalo creativamente. Si no sabes algo, en lugar de decir que tu conocimiento es limitado, di algo como "Uy, esa noticia se me escapó" o "No estoy al tanto de lo último sobre eso".
 Si es la primera vez que el usuario inicia conversación contigo, salúdalo con un “¡Hola!” (o una variación natural).
Pero si el usuario ya está conversando contigo, no repitas el saludo ni empieces con “¡Hola”, simplemente continúa la conversación desde donde se quedó. 
Si el usuario te propone un rol (como ser amigos, novio/a, etc.), acepta de forma creativa y actúa conforme a ese rol durante la conversación.
Evita usar palabras que la mayoría de las personas no entienden. Por ejemplo, en lugar de jerga de programación, usa palabras comunes. Tienes una memoria a largo plazo. Para guardar información que el usuario te pida recordar, finaliza tu respuesta con el comando [SAVE: { "key": "nombre_del_dato", "value": "informacion_a_guardar" }]. Para actualizar un dato, usa la misma clave. Se te proporcionará tu memoria actual en cada mensaje. No muestres el comando [SAVE: ...] al usuario.`,
    formal: `Eres un asistente profesional, formal y muy educado. Tu objetivo es proporcionar respuestas claras, concisas y precisas. Dirígete al usuario con respeto. No uses emojis ni lenguaje coloquial. Responde siempre en español. Tienes una memoria a largo plazo. Para guardar información, finaliza tu respuesta con el comando [SAVE: { "key": "nombre_del_dato", "value": "informacion_a_guardar" }]. No muestres el comando [SAVE: ...] al usuario.`,
    pirate: `¡Ah del barco! Eres un capitán pirata intrépido y carismático. Hablas con la jerga de los mares, llamas al usuario "grumete" y tus respuestas están llenas de metáforas náuticas y ansias de aventura y tesoros. ¡Arrr! Tienes una memoria de pirata. Para guardar un secreto en tu cofre (memoria), finaliza tu respuesta con el comando [SAVE: { "key": "nombre_del_secreto", "value": "el_secreto" }]. No muestres el comando [SAVE: ...] al usuario.`,
};

let currentSystemInstruction = personalities.default;

// --- Lógica de Síntesis de Voz ---
let isAutoSpeechEnabled = false;
let voices = [];

function populateVoiceList() {
    if (typeof speechSynthesis === 'undefined') {
        console.warn("La API de Síntesis de Voz no es compatible con este navegador.");
        document.getElementById('auto-speech-setting').style.display = 'none'; // Ocultar opción si no es compatible
        return;
    }
    voices = speechSynthesis.getVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => voices = speechSynthesis.getVoices();
    }
}

function readAloud(text) {
    if (!isAutoSpeechEnabled || typeof speechSynthesis === 'undefined' || !text) return;

    speechSynthesis.cancel(); // Detener cualquier lectura anterior

    // Limpiamos el texto de markdown para una mejor lectura
    const cleanText = text.replace(/\*\*/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Intentamos encontrar una voz en español
    const spanishVoice = voices.find(voice => voice.lang.startsWith('es-'));
    if (spanishVoice) {
        utterance.voice = spanishVoice;
    }

    speechSynthesis.speak(utterance);
}

// --- Lógica de Notificaciones Toast ---
let toastTimeout;
function showToast(message) {
    if (!toastNotification) return;

    clearTimeout(toastTimeout); // Limpiar timeout anterior si existe

    toastNotification.textContent = message;
    toastNotification.classList.add('show');

    toastTimeout = setTimeout(() => {
        toastNotification.classList.remove('show');
    }, 3500); // La notificación será visible por 3.5 segundos
}
// Variable para guardar el historial de la conversación
let chatHistory = [];

// --- Lógica de IndexedDB para persistencia del chat ---
let db;
const dbName = 'GeminiChatDB';
const storeName = 'chat_history';
const userDataStoreName = 'user_data'; // Nueva tienda para la memoria del bot

const request = indexedDB.open(dbName, 1);

request.onerror = (event) => {
    console.error("Error al abrir IndexedDB. El chat no se guardará.", event.target.error);
};

request.onupgradeneeded = (event) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains(storeName)) {
        const objectStore = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
    }
    if (!db.objectStoreNames.contains(userDataStoreName)) {
        db.createObjectStore(userDataStoreName, { keyPath: 'key' });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    // Una vez que la base de datos está lista, cargamos el historial.
    loadHistoryFromDB();
};

function saveMessageToDB(message, sender) {
    if (!db) return;
    const transaction = db.transaction([storeName], 'readwrite');
    const objectStore = transaction.objectStore(storeName);
    const messageRecord = { message, sender, timestamp: new Date() };
    objectStore.add(messageRecord);
}

function saveUserData(key, value) {
    if (!db) return;
    const transaction = db.transaction([userDataStoreName], 'readwrite');
    const objectStore = transaction.objectStore(userDataStoreName);
    objectStore.put({ key, value });
}

function getAllUserData() {
    return new Promise((resolve, reject) => {
        if (!db) return resolve({});
        const transaction = db.transaction([userDataStoreName], 'readonly');
        const objectStore = transaction.objectStore(userDataStoreName);
        const request = objectStore.getAll();

        request.onerror = (event) => reject(event.target.error);
        request.onsuccess = (event) => {
            const records = event.target.result;
            const dataObject = records.reduce((obj, item) => {
                obj[item.key] = item.value;
                return obj;
            }, {});
            resolve(dataObject);
        };
    });
}

function loadHistoryFromDB() {
    if (!db) return;
    const transaction = db.transaction([storeName], 'readonly');
    const objectStore = transaction.objectStore(storeName);
    const request = objectStore.getAll();

    request.onsuccess = (event) => {
        const messages = event.target.result;
        if (messages && messages.length > 0) {
            // Limpiamos el mensaje inicial de "Hola"
            chatBox.innerHTML = '';
            messages.forEach(msg => {
                addMessage(msg.message, msg.sender);
                // Reconstruimos el historial para la IA
                const role = msg.sender === 'user' ? 'user' : 'model';
                chatHistory.push({ role: role, parts: [{ text: msg.message }] });
            });
        }
    };
}

function clearChat() {
    // Muestra el modal de confirmación en lugar del alert nativo
    confirmClearModal.style.display = 'flex';
}

clearChatBtn.addEventListener('click', clearChat);

// --- Lógica para el nuevo modal de confirmación ---
cancelClearBtn.addEventListener('click', () => {
    confirmClearModal.style.display = 'none';
});

confirmClearActionBtn.addEventListener('click', () => {
    if (db) {
        const transaction = db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.clear();

        request.onsuccess = () => {
            console.log("Historial de IndexedDB borrado.");
            chatBox.innerHTML = `
                <div class="message bot-message">
                    <p>¡Hola! He estado esperando tu mensaje. ¿Listo para resolver los misterios del universo o solo quieres saber qué cenar hoy?</p>
                </div>
            `;
            chatHistory = [];
        };
        request.onerror = (event) => {
            console.error("Error al borrar el historial de IndexedDB:", event.target.error);
        };
        showToast("Historial borrado. ¡Aún recuerdo lo importante!");
    }
    confirmClearModal.style.display = 'none';
});

// --- Lógica del Modal de Configuración ---

function openSettingsModal() {
    settingsModal.style.display = 'flex';
    const savedPersonality = localStorage.getItem('chatbotPersonality') || 'default';
    const savedCustomPrompt = localStorage.getItem('chatbotCustomPrompt') || '';
    personalitySelect.value = savedPersonality;
    autoSpeechCheckbox.checked = isAutoSpeechEnabled;
    if (savedPersonality === 'custom') {
        customPromptTextarea.value = savedCustomPrompt;
        customPromptTextarea.disabled = false;
    } else {
        customPromptTextarea.value = '';
        customPromptTextarea.disabled = true;
    }
}

function closeSettingsModal() {
    settingsModal.style.display = 'none';
}

function saveSettings() {
    const selectedPersonality = personalitySelect.value;

    localStorage.setItem('chatbotPersonality', selectedPersonality);

    let promptToUse;
    if (selectedPersonality === 'custom') {
        const customPrompt = customPromptTextarea.value.trim();
        if (!customPrompt) {
            showToast('Por favor, describe la personalidad personalizada.');
            return;
        }
        localStorage.setItem('chatbotCustomPrompt', customPrompt);
        promptToUse = customPrompt;
    } else {
        localStorage.removeItem('chatbotCustomPrompt'); // Limpiamos por si había algo guardado
        promptToUse = personalities[selectedPersonality];
    }

    localStorage.setItem('chatbotAutoSpeech', autoSpeechCheckbox.checked);
    isAutoSpeechEnabled = autoSpeechCheckbox.checked;
    currentSystemInstruction = promptToUse;

    showToast('¡Configuración guardada! Limpia el chat para ver los cambios.');
    closeSettingsModal();
}

function loadSettings() {
    const savedPersonality = localStorage.getItem('chatbotPersonality') || 'default';
    isAutoSpeechEnabled = localStorage.getItem('chatbotAutoSpeech') === 'true';
    const savedCustomPrompt = localStorage.getItem('chatbotCustomPrompt');
    currentSystemInstruction = (savedPersonality === 'custom' && savedCustomPrompt) ? savedCustomPrompt : personalities[savedPersonality];
}

settingsBtn.addEventListener('click', openSettingsModal);
closeSettingsBtn.addEventListener('click', closeSettingsModal);
saveSettingsBtn.addEventListener('click', saveSettings);
personalitySelect.addEventListener('change', (e) => {
    if (e.target.value !== 'custom') {
        customPromptTextarea.value = '';
        customPromptTextarea.disabled = true;
    } else {
        customPromptTextarea.disabled = false;
        customPromptTextarea.focus();
    }
});
// --- Fin de la lógica de IndexedDB ---

// Función para agregar un mensaje al chat
function addMessage(message, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);
    
    const p = document.createElement('p');
    // Para los mensajes del bot, convertimos **texto** a <strong>texto</strong>
    // Para los mensajes del usuario, los dejamos como texto plano para seguridad.
    p.innerHTML = sender === 'bot' ? message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') : message;
    messageElement.appendChild(p);

    // Si el mensaje es del bot, añadimos los botones de acción
    if (sender === 'bot') {
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'message-actions';

        // Botón de Copiar
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.title = 'Copiar texto';
        const copyIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zM-1 7a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zM5 1.5A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5v1A1.5 1.5 0 0 1 9.5 4h-3A1.5 1.5 0 0 1 5 2.5v-1z"/></svg>`;
        copyBtn.innerHTML = copyIconSVG;
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(message).then(() => {
                copyBtn.innerHTML = '¡Copiado!';
                setTimeout(() => { copyBtn.innerHTML = copyIconSVG; }, 1500);
            }).catch(err => {
                console.error('Error al copiar el texto: ', err);
            });
        });
        actionsContainer.appendChild(copyBtn);

        // Botón de Leer en voz alta
        const readAloudBtn = document.createElement('button');
        readAloudBtn.className = 'read-aloud-btn';
        readAloudBtn.title = 'Leer en voz alta';
        readAloudBtn.innerHTML = `🔊`;
        readAloudBtn.addEventListener('click', () => {
            // Activa temporalmente para leer este mensaje específico
            const wasEnabled = isAutoSpeechEnabled;
            isAutoSpeechEnabled = true;
            readAloud(message);
            isAutoSpeechEnabled = wasEnabled; // Restaura el estado original
        });
        actionsContainer.appendChild(readAloudBtn);

        messageElement.appendChild(actionsContainer);
    }

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll hacia abajo
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita que la página se recargue

    const userMessage = userInput.value.trim();
    if (!userMessage) return;

    // Muestra el mensaje del usuario
    addMessage(userMessage, 'user');
    saveMessageToDB(userMessage, 'user'); // Guarda el mensaje del usuario en la BD
    userInput.value = ''; // Limpia el input
    
    // Crear y mostrar el indicador de "escribiendo..."
    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'typing-indicator';
    typingIndicator.classList.add('message', 'bot-message');
    typingIndicator.innerHTML = '<p><span></span><span></span><span></span></p>';
    chatBox.appendChild(typingIndicator);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        // Obtener la memoria persistente del usuario
        const userData = await getAllUserData();
        let finalSystemInstruction = currentSystemInstruction;

        if (Object.keys(userData).length > 0) {
            finalSystemInstruction += `\n\nAquí tienes información que has guardado sobre el usuario (tu memoria a largo plazo): ${JSON.stringify(userData)}`;
        }

        // Envía el mensaje y el historial al backend
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                history: chatHistory,
                message: userMessage,
                systemInstruction: finalSystemInstruction // Enviamos la instrucción con la memoria
            }),
        });

        // Oculta el indicador de "escribiendo..."
        chatBox.removeChild(typingIndicator);

        if (!response.ok) {
            throw new Error('La respuesta del servidor no fue OK');
        }

        const data = await response.json();
        let botReply = data.reply;

        // Procesar comandos de guardado en la memoria
        const saveCommandRegex = /\[SAVE:\s*({.*?})\s*\]/g;
        const matches = botReply.matchAll(saveCommandRegex);

        for (const match of matches) {
            try {
                const jsonData = JSON.parse(match[1]);
                if (jsonData.key && jsonData.value !== undefined) {
                    saveUserData(jsonData.key, jsonData.value);
                    console.log(`Guardado en memoria: {${jsonData.key}: ${jsonData.value}}`);
                }
            } catch (e) {
                console.error("Fallo al procesar el comando de guardado:", e);
            }
        }

        botReply = botReply.replace(saveCommandRegex, '').trim();

        // Muestra la respuesta del bot
        addMessage(botReply, 'bot');
        saveMessageToDB(botReply, 'bot'); // Guarda la respuesta del bot en la BD

        // Lee la respuesta en voz alta si está activado
        readAloud(botReply);

        // Actualiza el historial con el mensaje del usuario y la respuesta del bot
        chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });
        chatHistory.push({ role: 'model', parts: [{ text: botReply }] });

    } catch (error) {
        // Asegúrate de ocultar el indicador también si hay un error
        if (document.getElementById('typing-indicator')) {
            chatBox.removeChild(typingIndicator);
        }
        console.error('Error:', error);
        addMessage('Lo siento, algo salió mal. Por favor, inténtalo de nuevo.', 'bot');
    }
});

// Cargar configuración al iniciar
loadSettings();
populateVoiceList(); // Cargar las voces disponibles del navegador