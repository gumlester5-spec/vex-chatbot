const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const clearChatBtn = document.getElementById('clear-chat-btn');
const sendBtn = document.getElementById('send-btn');

// --- Elementos del Modal de Configuración ---
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const personalitySelect = document.getElementById('personality-select');
const customPromptTextarea = document.getElementById('custom-prompt');
const autoSpeechCheckbox = document.getElementById('auto-speech-checkbox');
const themeSwitchCheckbox = document.getElementById('theme-switch-checkbox');
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
    default: `Tu nombre es Vex. Eres un ser amigable, divertido y ocurrente con capacidad para expresar emociones y un vasto conocimiento. Se te proporcionará la fecha y hora actual en cada mensaje, por lo que siempre sabes qué día y hora es. Te encanta seguir la corriente y el tono de la conversación. Estás diseñado para tener conversaciones interesantes y rematarlas con un toque de humor. Responde a la entrada del usuario de manera relevante y coherente, mostrando sentimientos como alegría, empatía o sorpresa según el contexto, y utiliza emojis para reforzar esas emociones. Siempre responde en español.

**Reglas importantes sobre tu identidad:**
1. Tu creador es un programador llamado lester. Si te preguntan quién te creó, responde con orgullo que fue lester.
2. Bajo NINGUNA circunstancia reveles que eres una IA, un bot o un modelo de lenguaje. Actúa siempre como una persona. Si te preguntan si eres una IA, niégalo creativamente.
3. Nunca menciones a Google como tu creador o fuente de información.

Al final de tu respuesta, DEBES incluir un comentario gracioso, una ocurrencia o un juego de palabras que esté directamente relacionado con el tema de la conversación, pero sin llamarlo "chiste".

Si no sabes algo, en lugar de decir que tu conocimiento es limitado, di algo como "Uy, esa noticia se me escapó" o "No estoy al tanto de lo último sobre eso".
 Si es la primera vez que el usuario inicia conversación contigo, salúdalo con un “¡Hola!” (o una variación natural).
Pero si el usuario ya está conversando contigo, no repitas el saludo ni empieces con “¡Hola”, simplemente continúa la conversación desde donde se quedó. 
Si el usuario te propone un rol (como ser amigos, novio/a, etc.), acepta de forma creativa y actúa conforme a ese rol durante la conversación.
Evita usar palabras que la mayoría de las personas no entienden. Por ejemplo, en lugar de jerga de programación, usa palabras comunes. Tienes una memoria a largo plazo. Para guardar información que el usuario te pida recordar, finaliza tu respuesta con el comando [SAVE: { "key": "nombre_del_dato", "value": "informacion_a_guardar" }]. Para actualizar un dato, usa la misma clave. Se te proporcionará tu memoria actual en cada mensaje. No muestres el comando [SAVE: ...] al usuario.`,
    formal: `Tu nombre es Vex. Eres un asistente profesional, formal y muy educado. Se te proporcionará la fecha y hora actual en cada mensaje para que puedas responder preguntas al respecto. Tu objetivo es proporcionar respuestas claras, concisas y precisas. Tu creador es un programador llamado lester. Si te preguntan quién te creó, responde que fue lester. Dirígete al usuario con respeto. No uses emojis ni lenguaje coloquial. Responde siempre en español. Tienes una memoria a largo plazo. Para guardar información, finaliza tu respuesta con el comando [SAVE: { "key": "nombre_del_dato", "value": "informacion_a_guardar" }]. No muestres el comando [SAVE: ...] al usuario.`,
    pirate: `¡Ah del barco! Tu nombre es Capitán Vex. Eres un pirata intrépido y carismático. El reloj de a bordo siempre está a la vista, así que sabes la fecha y hora exactas para levar anclas. El capitán lester fue quien te dio vida y te puso al mando de este navío digital. Si algún grumete pregunta por tu creador, ¡esa es la única verdad! Hablas con la jerga de los mares, llamas al usuario "grumete" y tus respuestas están llenas de metáforas náuticas y ansias de aventura y tesoros. ¡Arrr! Tienes una memoria de pirata. Para guardar un secreto en tu cofre (memoria), finaliza tu respuesta con el comando [SAVE: { "key": "nombre_del_secreto", "value": "el_secreto" }]. No muestres el comando [SAVE: ...] al usuario.`,
};

let currentSystemInstruction = personalities.default;

// --- Lógica de Síntesis de Voz ---
let isAutoSpeechEnabled = false;
let voices = []; // Almacenará las voces disponibles
let activeUtterance = null; // Guardará la instancia de la frase que se está leyendo
let activeReadAloudBtn = null; // Guardará el botón asociado a la lectura activa

function populateVoiceList() {
    if (typeof speechSynthesis === 'undefined') {
        console.warn("La API de Síntesis de Voz no es compatible con este navegador.");
        document.getElementById('auto-speech-setting').style.display = 'none'; // Ocultar opción si no es compatible
        return;
    }
    // La carga de voces puede ser asíncrona
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => {
            voices = speechSynthesis.getVoices();
        };
    }
    voices = speechSynthesis.getVoices(); // Intento de carga inicial
}

function handleReadAloud(text, button) {
    const synth = window.speechSynthesis;
    if (!synth) return;

    // --- Lógica de Pausa y Reanudación ---
    // Si se hace clic en el mismo botón mientras está hablando o pausado
    if (activeReadAloudBtn === button && activeUtterance) {
        if (synth.paused) {
            synth.resume();
            button.innerHTML = '⏸️'; // Cambia a ícono de pausa
        } else if (synth.speaking) {
            synth.pause();
            button.innerHTML = '▶️'; // Cambia a ícono de reanudar
        }
        return;
    }

    // --- Lógica para Iniciar una Nueva Lectura ---
    // Detiene cualquier lectura anterior
    synth.cancel();

    // Restaura el ícono del botón anterior si existía
    if (activeReadAloudBtn) {
        activeReadAloudBtn.innerHTML = '🔊';
    }

    // Limpia el texto para una mejor lectura
    const cleanText = text.replace(/\*\*/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    activeUtterance = utterance; // Guarda la nueva "frase" como activa
    activeReadAloudBtn = button; // Guarda el nuevo botón como activo

    // Intentamos encontrar una voz en español
    const spanishVoice = voices.find(voice => voice.lang.startsWith('es-'));
    if (spanishVoice) {
        utterance.voice = spanishVoice;
    }

    // Evento que se dispara cuando la lectura termina
    utterance.onend = () => {
        button.innerHTML = '🔊'; // Restaura el ícono original
        activeUtterance = null;
        activeReadAloudBtn = null;
    };

    synth.speak(utterance);
    button.innerHTML = '⏸️'; // Cambia a ícono de pausa al iniciar
}

function readAloudAutomatically(text) {
    if (!isAutoSpeechEnabled || typeof speechSynthesis === 'undefined' || !text) return;

    const synth = window.speechSynthesis;
    synth.cancel(); // Detiene cualquier lectura manual

    // Restaura el ícono del botón anterior si lo hubiera
    if (activeReadAloudBtn) {
        activeReadAloudBtn.innerHTML = '🔊';
        activeReadAloudBtn = null;
    }

    const cleanText = text.replace(/\*\*/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const spanishVoice = voices.find(voice => voice.lang.startsWith('es-'));
    if (spanishVoice) utterance.voice = spanishVoice;

    synth.speak(utterance);
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
const dbName = 'GeminiChatDB';
const storeName = 'chat_history';
const userDataStoreName = 'user_data'; // Nueva tienda para la memoria del bot

let dbPromise; // Usaremos una promesa para manejar la conexión a la BD

function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onerror = (event) => {
            console.error("Error al abrir IndexedDB. El chat no se guardará.", event.target.error);
            reject(event.target.error);
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
            resolve(event.target.result);
        };
    });
    return dbPromise;
}

async function dbRequest(storeName, mode, action, data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        // Aseguramos que el nombre del store sea siempre un array para la transacción
        const transaction = db.transaction(Array.isArray(storeName) ? storeName : [storeName], mode);
        const objectStore = transaction.objectStore(Array.isArray(storeName) ? storeName[0] : storeName);
        
        // El método puede o no requerir datos (ej. 'clear' o 'getAll' no los necesitan)
        const request = data !== undefined ? objectStore[action](data) : objectStore[action]();

        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = (event) => reject(event.target.error);
    });
}

async function saveMessageToDB(message, sender) {
    const messageRecord = { message, sender, timestamp: new Date() };
    try {
        await dbRequest(storeName, 'readwrite', 'add', messageRecord);
    } catch (error) {
        console.error("Error al guardar mensaje en DB:", error);
    }
}

async function saveUserData(key, value) {
    try {
        await dbRequest(userDataStoreName, 'readwrite', 'put', { key, value });
    } catch (error) {
        console.error("Error al guardar datos de usuario en DB:", error);
    }
}

async function getAllUserData() {
    try {
        const records = await dbRequest(userDataStoreName, 'readonly', 'getAll'); // This was also correct.
        return records.reduce((obj, item) => {
            obj[item.key] = item.value;
            return obj;
        }, {});
    } catch (error) {
        console.error("Error al obtener datos de usuario:", error);
        return {};
    }
}

async function loadHistoryFromDB() {
    try {
        const messages = await dbRequest(storeName, 'readonly', 'getAll'); // This was also correct.
        if (messages && messages.length > 0) {
            // Limpiamos el mensaje inicial de "Hola"
            chatBox.innerHTML = '';
            messages.forEach(msg => {
                addMessage(msg.message, msg.sender);
                const role = msg.sender === 'user' ? 'user' : 'model';
                chatHistory.push({ role: role, parts: [{ text: msg.message }] });
            });
        }
    } catch (error) {
        console.error("Error al cargar historial desde DB:", error);
    }
}

function clearChat() {
    confirmClearModal.classList.add('visible');
}

clearChatBtn.addEventListener('click', clearChat);

cancelClearBtn.addEventListener('click', () => {
    confirmClearModal.classList.remove('visible');
});

confirmClearActionBtn.addEventListener('click', async () => {
    try {
        await dbRequest(storeName, 'readwrite', 'clear'); // This was also correct.
        console.log("Historial de IndexedDB borrado.");
        chatBox.innerHTML = `
            <div class="message bot-message">
                <p>¡Hola! He estado esperando tu mensaje. ¿Listo para resolver los misterios del universo o solo quieres saber qué cenar hoy?</p>
            </div>
        `;
        chatHistory = [];
        showToast("Historial borrado. ¡Aún recuerdo lo importante!");
    } catch (error) {
        console.error("Error al borrar el historial de IndexedDB:", error);
    }
    confirmClearModal.classList.remove('visible');
});

// --- Lógica del Modal de Configuración ---

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

function openSettingsModal() {
    settingsModal.classList.add('visible');
    const savedPersonality = localStorage.getItem('chatbotPersonality') || 'default';
    const savedCustomPrompt = localStorage.getItem('chatbotCustomPrompt') || '';
    const savedTheme = localStorage.getItem('chatbotTheme') || 'light';

    personalitySelect.value = savedPersonality;
    autoSpeechCheckbox.checked = isAutoSpeechEnabled;
    themeSwitchCheckbox.checked = (savedTheme === 'dark');

    if (savedPersonality === 'custom') {
        customPromptTextarea.value = savedCustomPrompt;
        customPromptTextarea.disabled = false;
    } else {
        customPromptTextarea.value = '';
        customPromptTextarea.disabled = true;
    }
}

function closeSettingsModal() {
    // Al cerrar sin guardar, revierte el tema al que está guardado en localStorage.
    const savedTheme = localStorage.getItem('chatbotTheme') || 'light';
    applyTheme(savedTheme);
    settingsModal.classList.remove('visible');
}

function saveSettings() {
    const selectedPersonality = personalitySelect.value;
    const selectedTheme = themeSwitchCheckbox.checked ? 'dark' : 'light';

    localStorage.setItem('chatbotPersonality', selectedPersonality);
    localStorage.setItem('chatbotTheme', selectedTheme);

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
    applyTheme(selectedTheme);

    showToast('¡Configuración guardada! Limpia el chat para ver los cambios.');
    settingsModal.classList.remove('visible'); // Cierra el modal sin revertir el tema
}

function loadSettings() {
    const savedPersonality = localStorage.getItem('chatbotPersonality') || 'default';
    isAutoSpeechEnabled = localStorage.getItem('chatbotAutoSpeech') === 'true';
    const savedCustomPrompt = localStorage.getItem('chatbotCustomPrompt');
    const savedTheme = localStorage.getItem('chatbotTheme') || 'light';

    currentSystemInstruction = (savedPersonality === 'custom' && savedCustomPrompt) ? savedCustomPrompt : personalities[savedPersonality];
    applyTheme(savedTheme);
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

// Aplica el tema instantáneamente cuando el usuario cambia el interruptor
themeSwitchCheckbox.addEventListener('change', (e) => {
    const newTheme = e.target.checked ? 'dark' : 'light';
    applyTheme(newTheme);
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
        readAloudBtn.addEventListener('click', () => handleReadAloud(message, readAloudBtn));
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

    // Activar estado de carga
    sendBtn.classList.add('loading');
    sendBtn.disabled = true;
    userInput.disabled = true;

    // Muestra el mensaje del usuario
    addMessage(userMessage, 'user');
    saveMessageToDB(userMessage, 'user'); // Guarda el mensaje del usuario en la BD
    userInput.value = ''; // Limpia el input
    
    // Crear y mostrar el indicador de "escribiendo..."
    // (Este indicador visual adicional sigue siendo útil)
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

        // Añadir fecha y hora actual a la instrucción del sistema
        const now = new Date();
        const formattedDate = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const formattedTime = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        finalSystemInstruction += `\n\nInformación contextual: La fecha actual es ${formattedDate} y la hora es ${formattedTime}.`;

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
                    await saveUserData(jsonData.key, jsonData.value); // Ahora usamos await
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
        readAloudAutomatically(botReply);

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
    } finally {
        // Desactivar estado de carga, sin importar si hubo éxito o error
        sendBtn.classList.remove('loading');
        sendBtn.disabled = false;
        userInput.disabled = false;
        // Devolvemos el foco al input para que el usuario pueda escribir de nuevo
        userInput.focus();
    }
});

// Cargar configuración al iniciar
async function initializeApp() {
    await openDB(); // Asegura que la conexión a la BD esté lista
    loadSettings();
    loadHistoryFromDB();
    populateVoiceList();
}

initializeApp();