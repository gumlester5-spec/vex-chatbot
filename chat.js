const { GoogleGenerativeAI } = require('@google/generative-ai');

// Inicializa el cliente de Google Generative AI usando las variables de entorno de Netlify
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Esta es la función principal que Netlify ejecutará
exports.handler = async function(event) {
    // Solo permitimos peticiones POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { history, message, systemInstruction } = JSON.parse(event.body);

        if (!message) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'El mensaje es requerido.' })
            };
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest",
            systemInstruction: systemInstruction,
        });

        const chat = model.startChat({ history: history });
        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();

        return {
            statusCode: 200,
            body: JSON.stringify({ reply: text }),
        };
    } catch (error) {
        console.error('Error en la función de Netlify:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error interno del servidor.' }),
        };
    }
};