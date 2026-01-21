
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');
const e = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

//fast api endpoint
const MEDICAL_API_URL = 'https://api.example.com/medical-records';

// MIDDLE
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));

//heath check endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: ' Medical Assistant Backend is Running',
        endpoints: {
            health: '/api/health',
            symptoms: '/api/symptoms',
            predict: '/api/predict',
            predictFromList: '/api/predict-list',
            chat: '/api/chat'
        }
    });
});

//get api health
app.get('/api/health', async (req, res) => {
    try {
        const response = await axios.get(`${MEDICAL_API_URL}/health`);

        res.json({
            success: true,
            message: 'API is healthy',
            data: response.data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching health status',
            error: error.message
        });
    }
});

app.get('/api/symptoms', async (req, res) => {
    try {
        const response = await axios.get(`${MEDICAL_API_URL}/symptoms`);
        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching symptoms',
            error: error.message
        });
    }
});

//predict from text
app.post('/api/predict', async (req, res) => {
    try {
        const { symptomsText } = req.body;
        if (!symptomsText || symptomsText.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Symptoms text is required'
            });
        }
        console.log('Received symptoms text:', symptomsText);
        const response = await axios.post(`${MEDICAL_API_URL}/predict`, { symptomsText: symptomsText });
        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Error in /api/predict:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Error making prediction',
            error: error.message
        });
    }
});

//predict from symptoms list
app.post('/api/predict-list', async (req, res) => {
    try {
        const { symptomsList } = req.body;
        if (!symptomsList || !Array.isArray(symptomsList) || symptomsList.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Symptoms list is required and must be a non-empty array'
            });
        }
        console.log('Received symptoms list:', symptomsList);
        const response = await axios.post(`${MEDICAL_API_URL}/predict-from-list`, { symptomsList });
        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Error in /api/predict-list:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Error making prediction',
            error: error.message
        });
    }
});
//chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || message.trim() === '') {
            return res.status(400).json({
                success: false,
                reply: 'please tell me about your symptoms so I can assist you better.'
            });
        }
        console.log('Received chat message:', message);
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage === 'hey') {
            return res.json({
                success: true,
                reply: 'Hello! How can I assist you with your medical symptoms today?',
                isGreeting: true
            });
        }
        const response = await axios.post(`${MEDICAL_API_URL}/predict`, { symptoms: message });

        const data = response.data;
        const reply = `
🏥 Based on your symptoms: "${message}"

🔍 I detected these symptoms: ${data.matched_symptoms.join(', ')}

💊 This might indicate: **${data.disease}**
📊 Confidence: ${data.confidence}%

📖 About this condition:
${data.description}

💉 Suggested medicines:
${data.suggested_medicines.map((m, i) => `${i + 1}. ${m}`).join('\n')}

⚠️ Important precautions:
${data.precautions.map((p, i) => `${i + 1}. ${p}`).join('\n')}

👨‍⚕️ Recommended specialist: ${data.doctor_specialty}

${data.disclaimer}
    `.trim();

        res.json({
            success: true,
            reply: reply,
            data: data
        });

    } catch (error) {
        console.error('Chat error:', error.response?.data || error.message);

        let errorReply = 'I\'m sorry, I couldn\'t understand your symptoms. Could you please describe them more clearly?';

        if (error.response?.data?.detail) {
            errorReply = error.response.data.detail;
        }

        res.status(error.response?.status || 500).json({
            success: false,
            reply: errorReply
        });
    }
});
//handling Middleware errors    
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: err.message
    });
});

//error handling Middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: err.message
    });
});

app.listen(PORT, () => {
    console.log(`Medical Assistant Backend is running on port ${PORT}`);
});