

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;  

//  FastAPI Ngrok URL (Your Google Colab API)
const MEDICAL_API_URL = 'https://predeterminate-falsely-annabel.ngrok-free.dev/';
// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));

// Axios instance for FastAPI communication
const apiClient = axios.create({
    baseURL: MEDICAL_API_URL,
    headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'MedicalAssistantBackend/1.0'
    },
    timeout: 30000 // 30 seconds timeout
});


app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🏥 Medical Assistant Backend is Running',
        port: PORT,
        fastApiUrl: MEDICAL_API_URL,
        endpoints: {
            health: '/api/health',
            symptoms: '/api/symptoms',
            predict: '/api/predict',
            predictFromList: '/api/predict-list',
            chat: '/api/chat',
            testDirect: '/api/test-direct'
        }
    });
});


app.get('/api/health', async (req, res) => {
    try {
        console.log('Checking FastAPI health...');
        const response = await apiClient.get('/health');

        res.json({
            success: true,
            message: 'FastAPI is healthy',
            data: response.data
        });
    } catch (error) {
        console.error('Health check failed:', error.message);
        res.status(500).json({
            success: false,
            message: 'FastAPI health check failed',
            error: error.message,
            details: error.response?.data || null
        });
    }
});


app.get('/api/symptoms', async (req, res) => {
    try {
        console.log('Fetching symptoms from FastAPI...');
        const response = await apiClient.get('/symptoms');
        
        res.json({
            success: true,
            total: response.data.length,
            symptoms: response.data
        });
    } catch (error) {
        console.error('Failed to fetch symptoms:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching symptoms',
            error: error.message
        });
    }
});


app.post('/api/predict', async (req, res) => {
    try {
        const symptomsInput = req.body.symptoms || req.body.symptomsText || req.body.message;
        
        if (!symptomsInput || symptomsInput.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Please provide symptoms'
            });
        }

        console.log(' Predicting disease for:', symptomsInput);

        const response = await apiClient.post('/predict', {
            symptoms: symptomsInput  //  Correct field name
        });

        console.log(' Prediction successful:', response.data.disease);

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error(' Prediction error:', error.response?.data || error.message);
        
        res.status(error.response?.status || 500).json({
            success: false,
            message: 'Prediction failed',
            error: error.response?.data?.detail || error.message
        });
    }
});


app.post('/api/predict-list', async (req, res) => {
    try {
        const symptomsList = req.body.symptoms || req.body.symptomsList;
        
        if (!symptomsList || !Array.isArray(symptomsList) || symptomsList.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide symptoms as an array'
            });
        }

        console.log('🔍 Predicting from list:', symptomsList);

        const response = await apiClient.post('/predict-from-list', {
            symptoms: symptomsList  
        });

        console.log('✅ Prediction successful:', response.data.disease);

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('Prediction error:', error.response?.data || error.message);
        
        res.status(error.response?.status || 500).json({
            success: false,
            message: 'Prediction failed',
            error: error.response?.data?.detail || error.message
        });
    }
});


app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message || message.trim() === '') {
            return res.status(400).json({
                success: false,
                reply: 'Please tell me about your symptoms.'
            });
        }

        console.log('💬 Chat message received:', message);

        // Check for greetings
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage === 'hey') {
            return res.json({
                success: true,
                reply: '👋 Hello! I\'m your Medical Assistant. Please describe your symptoms, and I\'ll help identify possible conditions.',
                isGreeting: true
            });
        }

        const response = await apiClient.post('/predict', {
            symptoms: message  
        });

        const data = response.data;

        // Create conversational response
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
        console.error(' Chat error:', error.response?.data || error.message);

        let errorReply = 'I\'m sorry, I couldn\'t understand your symptoms. Could you please describe them more clearly?';

        if (error.response?.data?.detail) {
            errorReply = error.response.data.detail;
        }

        res.status(error.response?.status || 500).json({
            success: false,
            reply: errorReply,
            error: error.message
        });
    }
});


app.get('/api/test-direct', async (req, res) => {
    try {
        console.log('🧪 Testing direct connection to:', MEDICAL_API_URL);
        
        const response = await apiClient.get('/');
        
        res.json({
            success: true,
            message: '✅ Direct connection successful!',
            fastApiResponse: response.data
        });
    } catch (error) {
        console.error('❌ Direct test failed:', error.message);
        
        res.status(500).json({
            success: false,
            message: '❌ Cannot connect to FastAPI',
            error: error.message,
            fastApiUrl: MEDICAL_API_URL,
            tip: 'Make sure your Google Colab FastAPI is running and the Ngrok URL is correct'
        });
    }
});


app.use((err, req, res, next) => {
    console.error(' Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: err.message
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        availableEndpoints: [
            'GET /',
            'GET /api/health',
            'GET /api/symptoms',
            'POST /api/predict',
            'POST /api/predict-list',
            'POST /api/chat',
            'GET /api/test-direct'
        ]
    });
});


app.listen(PORT, () => {
    console.log('\n' + '='.repeat(70));
    console.log('🏥 Medical Assistant Backend Server');
    console.log('='.repeat(70));
    console.log(`✅ Server running on:    http://localhost:${PORT}`);
    console.log(`🔗 FastAPI URL:          ${MEDICAL_API_URL}`);
    console.log('='.repeat(70));
    console.log('\n📍 Available Endpoints:');
    console.log(`   GET  /                 - Server info`);
    console.log(`   GET  /api/health       - Check FastAPI health`);
    console.log(`   GET  /api/symptoms     - Get all symptoms`);
    console.log(`   POST /api/predict      - Predict from text`);
    console.log(`   POST /api/predict-list - Predict from list`);
    console.log(`   POST /api/chat         - Chatbot endpoint`);
    console.log(`   GET  /api/test-direct  - Test connection`);
    console.log('='.repeat(70));
    console.log('\n🧪 Quick Test Commands:');
    console.log(`   curl http://localhost:${PORT}/api/test-direct`);
    console.log(`   curl -X POST http://localhost:${PORT}/api/chat \\`);
    console.log(`        -H "Content-Type: application/json" \\`);
    console.log(`        -d '{"message": "I have fever and headache"}'`);
    console.log('='.repeat(70) + '\n');
});

module.exports = app;