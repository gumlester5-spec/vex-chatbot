const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Permite solicitudes desde el frontend
app.use(express.json()); // Permite al servidor entender JSON

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Ruta para el chat
app.post('/chat', async (req, res) => {
    try {
        // Ahora recibimos el historial, el mensaje y la instrucción del sistema
        const { history, message, systemInstruction } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'El mensaje es requerido.' });
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest",
            systemInstruction: systemInstruction, // Usamos la instrucción enviada por el cliente
        });

        const chat = model.startChat({
            history: history,
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();

        res.json({ reply: text });
    } catch (error) {
        console.error('Error al contactar la API de Gemini:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});