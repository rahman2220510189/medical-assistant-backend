# MediCare Plus — Backend API

> RESTful API powering the MediCare Plus healthcare platform. Handles authentication, appointments, payments, real-time video signaling, prescriptions, and AI-powered symptom analysis.

![Node.js](https://img.shields.io/badge/Node.js-18-green) ![Express](https://img.shields.io/badge/Express-4-lightgrey) ![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green) ![Socket.io](https://img.shields.io/badge/Socket.io-4-black) ![Deployed](https://img.shields.io/badge/Deployed-Render-blue)

---

## 🚀 Live API

```
https://medical-assistant-backend-1.onrender.com
```

Health check: `GET /api/health`

---

## 🛠 Tech Stack

| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| MongoDB Atlas | Database |
| Socket.io | WebRTC signaling + real-time chat |
| Firebase Admin | JWT token verification |
| Cloudinary | Doctor photo uploads |
| Stripe | Payment processing |
| PDFKit | Prescription PDF generation |
| bcryptjs | Password hashing |
| JWT | Doctor authentication |

---

## 📡 API Endpoints

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/jwt` | Issue JWT token |
| POST | `/api/users` | Create new user |
| GET | `/api/users/me` | Get current user |

### Doctor Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/doctor/login` | Doctor login |
| GET | `/api/doctor/me` | Get doctor profile |
| PATCH | `/api/doctor/status` | Toggle online/offline |
| GET | `/api/doctor/appointments` | Doctor's appointments |
| GET | `/api/doctor/stats` | Doctor statistics |

### Doctors
| Method | Route | Description |
|---|---|---|
| GET | `/api/doctors` | List all doctors |
| GET | `/api/doctors/specialists` | Get all specialties |
| GET | `/api/doctors/:id` | Get doctor by ID |
| GET | `/api/doctors/:id/availability` | Get available slots |
| POST | `/api/doctors` | Add new doctor (Admin) |
| PUT | `/api/doctors/:id` | Update doctor (Admin) |
| DELETE | `/api/doctors/:id` | Delete doctor (Admin) |
| PATCH | `/api/doctors/:id/photo` | Update doctor photo |

### Appointments
| Method | Route | Description |
|---|---|---|
| POST | `/api/appointments` | Book appointment |
| GET | `/api/appointments/my` | Patient's appointments |
| GET | `/api/appointments/:id` | Get appointment details |
| PATCH | `/api/appointments/:id/cancel` | Cancel appointment |
| GET | `/api/appointments/:id/prescription` | Get prescription |
| PATCH | `/api/appointments/:id/prescription` | Save prescription |

### Payments
| Method | Route | Description |
|---|---|---|
| POST | `/api/payment/create-intent` | Create Stripe payment intent |
| POST | `/api/payment/confirm` | Confirm payment |

### Admin
| Method | Route | Description |
|---|---|---|
| GET | `/api/admin/stats` | Platform statistics |
| GET | `/api/admin/appointments` | All appointments (paginated) |
| PATCH | `/api/admin/appointments/:id/status` | Update appointment status |
| GET | `/api/admin/patients` | All patients (paginated) |
| PATCH | `/api/admin/users/:email/role` | Change user role |
| GET | `/api/admin/check/:email` | Check admin status |

### AI & Misc
| Method | Route | Description |
|---|---|---|
| POST | `/api/chat` | AI symptom chat |
| POST | `/api/predict` | ML disease prediction |
| POST | `/api/predict-list` | Predict from symptom list |
| POST | `/api/contact` | Save contact form |
| POST | `/api/upload/doctor-photo` | Upload doctor photo |

---

## 🔌 Socket.io Events

```js
// Client emits
join-room       { roomId, role, userName }
offer           { roomId, offer }
answer          { roomId, answer }
ice-candidate   { roomId, candidate }
chat-message    { roomId, message, sender, time, image }
end-call        { roomId }
call-started    { roomId, doctorName }

// Server emits
user-joined     { role, userName }
offer           { offer }
answer          { answer }
ice-candidate   { candidate }
chat-message    { message, sender, time, image }
call-ended
incoming-call   { doctorName }
```

---

## ⚙️ Installation

```bash
# Clone the repository
git clone https://github.com/rahman2220510189/medical-assistant-backend
cd medical-assistant-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

Add these to your `.env` file:

```env
PORT=5000
DB_USER=your_mongodb_user
DB_PASSWORD=your_mongodb_password
ACCESS_TOKEN_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLIENT_URL=https://your-frontend.vercel.app
MEDICAL_API_URL=https://your-ml-api.hf.space
STRIPE_SECRET_KEY=sk_test_your_key
GROQ_API_KEY=your_groq_key
```

```bash
# Run development server
npm run dev

# Run production
npm start
```

---

## 📁 Project Structure

```
src/
├── routes/
│   ├── auth.js              # JWT + user routes
│   ├── doctors_route.js     # Doctor CRUD + auth
│   ├── appointment.js       # Appointment management
│   ├── payment_routes.js    # Stripe integration
│   ├── stats_route.js       # Admin statistics
│   └── contact.js           # Contact form
├── models/
│   ├── doctor.model.js      # Doctor schema
│   └── appointment.model.js # Appointment schema
├── middleware/
│   └── verifyToken.js       # JWT verification
└── server.js                # Main entry point + Socket.io
```

---

## 🗄️ Database Collections

```
medical_system.users          # Patient accounts
medical_system.doctors        # Doctor profiles
medical_system.appointments   # All appointments
medical_system.contacts       # Contact form submissions
```

---

## 🔗 Related Repositories

- 💻 **Frontend:** [medical-assistant-chat-fontend](https://github.com/rahman2220510189/medical-assistant-chat-fontend)
- 🤖 **ML Model:** [medical-assistand-ml](https://github.com/rahman2220510189/medical-assistand-ml)

---

## 👨‍💻 Author

**Riyad Rahman**
- GitHub: [@rahman2220510189](https://github.com/rahman2220510189)
