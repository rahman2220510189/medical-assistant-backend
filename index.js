const express = require('express');
const axios = require('axios');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();


const { createDoctor } = require('./doctor.model');
const { createAppointment } = require('./appointment.model');
const { cloudinary, upload } = require('./cloudinary');
const { generatePrescription } = require('./prescription');



const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ─── FastAPI URL ───
const MEDICAL_API_URL = process.env.MEDICAL_API_URL || "https://naymour1894-medical-assistant-ml.hf.space"

// ─── Socket.io ───
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000', process.env.CLIENT_URL].filter(Boolean),
    methods: ['GET', 'POST']
  }
});

// ─── Middleware ───
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', process.env.CLIENT_URL].filter(Boolean),
  credentials: true
}))
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── MongoDB ───
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.cjuyyb2.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  }
});

let userCollection;
let doctorCollection;
let appointmentCollection;

async function connectDB() {
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    console.log(' MongoDB Connected!');

    userCollection        = client.db('medical_system').collection('user');
    doctorCollection      = client.db('medical_system').collection('doctors');
    appointmentCollection = client.db('medical_system').collection('appointments');

    // Text index for doctor search
   
  } catch (error) {
    console.error(' MongoDB connection error:', error);
  }
}
connectDB();

// ─── Axios for FastAPI ───
const apiClient = axios.create({
  baseURL: MEDICAL_API_URL,
  headers: {
    'ngrok-skip-browser-warning': 'true',
    'User-Agent': 'MedicalAssistantBackend/1.0'
  },
  timeout: 30000
});

// ─── JWT Middleware ───
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
  const token = req.headers.authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: 'Forbidden access' });
    req.decoded = decoded;
    next();
  });
};

const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.decoded.email;
    const user = await userCollection.findOne({ email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//   verifyDoctor middleware
const verifyDoctor = async (req, res, next) => {
  try {
    const email = req.decoded.email;
    const doctor = await doctorCollection.findOne({ email });
    if (!doctor) {
      return res.status(403).json({ success: false, message: 'Doctor access required' });
    }
    req.doctor = doctor;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// AUTH ROUTES

app.post('/jwt', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email required' });
    }
    const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
    res.json({ token });
});


app.post('/api/users', async (req, res) => {
  try {
    const user = req.body;
    const existing = await userCollection.findOne({ email: user.email });
    if (existing) {
      return res.status(400).send({ message: 'User already exists', insertId: null });
    }
    const newUser = { ...user, role: 'user', createdAt: new Date() };
    const result = await userCollection.insertOne(newUser);
    res.send({ message: 'User registered successfully', insertId: result.insertedId });
  } catch (error) {
    res.status(500).send({ message: 'Error registering user', error: error.message });
  }
});

app.get('/api/users/me', verifyToken, async (req, res) => {
  try {
    const user = await userCollection.findOne({ email: req.decoded.email });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

//  DOCTOR AUTH ROUTES
app.post('/api/doctor/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    const doctor = await doctorCollection.findOne({ email });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }
    if (!doctor.password) {
      return res.status(400).json({ success: false, message: 'Password not set. Contact admin.' });
    }
    const isMatch = await bcrypt.compare(password, doctor.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }
    const token = jwt.sign(
      { email: doctor.email, role: 'doctor', doctorId: doctor._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({
      success: true,
      token,
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialist: doctor.specialist,
        photo: doctor.photo,
        isOnline: doctor.isOnline,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/doctor/me', verifyToken, verifyDoctor, async (req, res) => {
  try {
    const doctor = await doctorCollection.findOne(
      { email: req.decoded.email },
      { projection: { password: 0 } }
    );
    res.json({ success: true, doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch('/api/doctor/status', verifyToken, verifyDoctor, async (req, res) => {
  try {
    const { isOnline } = req.body;
    await doctorCollection.updateOne(
      { email: req.decoded.email },
      { $set: { isOnline, updatedAt: new Date() } }
    );
    res.json({ success: true, message: `Status updated to ${isOnline ? 'Online' : 'Offline'}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/doctor/appointments', verifyToken, verifyDoctor, async (req, res) => {
  try {
    const { status, date } = req.query;
    const doctor = req.doctor;
    const query = { doctorId: doctor._id.toString() };
    if (status) query.status = status;
    if (date) {
      const start = new Date(date); start.setHours(0,0,0,0);
      const end   = new Date(date); end.setHours(23,59,59,999);
      query.appointmentDate = { $gte: start, $lte: end };
    }
    const appointments = await appointmentCollection
      .find(query)
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .toArray();
    res.json({ success: true, appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/doctor/stats', verifyToken, verifyDoctor, async (req, res) => {
  try {
    const doctor = req.doctor;
    const doctorId = doctor._id.toString();
    const today = new Date(); today.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
    const [total, todayCount, completed, pending, paidCount] = await Promise.all([
      appointmentCollection.countDocuments({ doctorId }),
      appointmentCollection.countDocuments({ doctorId, appointmentDate: { $gte: today, $lte: todayEnd } }),
      appointmentCollection.countDocuments({ doctorId, status: 'Completed' }),
      appointmentCollection.countDocuments({ doctorId, status: { $in: ['Pending','Confirmed'] } }),
      appointmentCollection.countDocuments({ doctorId, paymentStatus: 'paid' }),
    ]);
    res.json({
      success: true,
      stats: {
        totalAppointments: total,
        todayAppointments: todayCount,
        completedAppointments: completed,
        pendingAppointments: pending,
        totalEarnings: paidCount * (Number(doctor.consultationFee) || 0),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DOCTOR ROUTES
// ─── Photo upload ───
app.post('/api/upload/doctor-photo', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    res.json({
      success: true,
      message: ' Photo uploaded successfully!',
      photoUrl: req.file.path,
      publicId: req.file.filename
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// doctor / search / filter
app.get('/api/doctors', async (req, res) => {
  try {
    const { search, specialist, limit = 20, page = 1 } = req.query;

    const query = {};

    // Search by name (case-insensitive, strip Dr. prefix)
    if (search && search.trim().length >= 2) {
      const cleanSearch = search.trim().replace(/^Dr\.?\s*/i, '').trim();
      const searchTerm = cleanSearch || search.trim();
      query.name = { $regex: searchTerm, $options: 'i' };
    }

    // Filter by specialist
    if (specialist && specialist !== 'All') {
      query.specialist = { $regex: specialist.trim(), $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [doctors, total] = await Promise.all([
      doctorCollection
        .find(query)
        .skip(skip)
        .limit(parseInt(limit))
        .toArray(),
      doctorCollection.countDocuments(query),
    ]);

    res.json({
      success: true,
      doctors,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

//  specialist list
app.get('/api/doctors/specialists', async (req, res) => {
  try {
    const specialists = await doctorCollection.distinct('specialist');
    res.json({ success: true, specialists });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Single doctor
app.get('/api/doctors/:id', async (req, res) => {
  try {
    const doctor = await doctorCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    res.json({ success: true, doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Doctor availability
app.get('/api/doctors/:id/availability', async (req, res) => {
  try {
    const doctor = await doctorCollection.findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { availability: 1, isOnline: 1, isBusy: 1, name: 1 } }
    );
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    res.json({ success: true, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

//  Doctor add — password hash 
app.post('/api/doctors', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    const photoUrl = req.file 
      ? (req.file.path || req.file.secure_url || `http://localhost:5000/uploads/${req.file.filename}`)
      : null;

    let hashedPassword = null;
    if (req.body.password) {
      hashedPassword = await bcrypt.hash(req.body.password, 10);
    }

    const doctor = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone || '',
      photo: photoUrl || 'https://i.ibb.co/default-doctor.png',
      specialist: req.body.specialist,
      experience: Number(req.body.experience) || 0,
      rating: Number(req.body.rating) || 4.5,
      totalReviews: 0,
      qualifications: req.body.qualifications ? JSON.parse(req.body.qualifications) : [],
      about: req.body.about || '',
      consultationFee: Number(req.body.consultationFee) || 500,
      availability: req.body.availability ? JSON.parse(req.body.availability) : [],
      password: hashedPassword,  
      isOnline: false,
      isBusy: false,
      currentCallRoom: null,
      createdAt: new Date()
    };

    const result = await doctorCollection.insertOne(doctor);
    res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch('/api/doctors/:id/photo', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    
    const oldDoctor = await doctorCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (oldDoctor?.photoPublicId) {
      await cloudinary.uploader.destroy(oldDoctor.photoPublicId);
    }

    await doctorCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { photo: req.file.path, photoPublicId: req.file.filename } }
    );

    res.json({
      success: true,
      message: ' Photo updated!',
      photoUrl: req.file.path
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/appointments/:appointmentId/prescription', verifyToken, (req, res) => {
  generatePrescription(req, res, appointmentCollection, doctorCollection);
});

// Doctor prescription notes update
app.patch('/api/appointments/:id/prescription', verifyToken, async (req, res) => {
  try {
    const { prescriptionNotes, medicines } = req.body;

    await appointmentCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          prescriptionNotes,
          medicines,
          status: 'Completed',
          updatedAt: new Date()
        }
      }
    );

    res.json({ success: true, message: 'Prescription saved!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATED: Doctor update — password update support
app.put('/api/doctors/:id', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (req.file) updateData.photo = req.file.path;
    if (updateData.qualifications) updateData.qualifications = JSON.parse(updateData.qualifications);
    if (updateData.availability)   updateData.availability   = JSON.parse(updateData.availability);

    //  Password update
    if (updateData.password && updateData.password.length >= 6) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      delete updateData.password;
    }

    await doctorCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...updateData, updatedAt: new Date() } }
    );
    res.json({ success: true, message: 'Doctor updated!' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Doctor delete
app.delete('/api/doctors/:id', verifyToken, async (req, res) => {
  try {
    await doctorCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true, message: 'Doctor removed!' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

//admin stats from Dashboard
app.get('/api/admin/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [
      totalDoctors,
      totalPatients,
      totalAppointments,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      onlineDoctors,
    ] = await Promise.all([
      doctorCollection.countDocuments(),
      userCollection.countDocuments({ role: 'user' }),
      appointmentCollection.countDocuments(),
      appointmentCollection.countDocuments({ status: 'Pending' }),
      appointmentCollection.countDocuments({ status: 'Confirmed' }),
      appointmentCollection.countDocuments({ status: 'Completed' }),
      appointmentCollection.countDocuments({ status: 'Cancelled' }),
      doctorCollection.countDocuments({ isOnline: true }),
    ]);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const thisMonthAppointments = await appointmentCollection.countDocuments({
      bookedAt: { $gte: startOfMonth }
    });

    // ✅ UPDATED: Revenue — paymentStatus: 'paid' + $toDouble fix
    const revenueData = await appointmentCollection.aggregate([
      { $match: { paymentStatus: 'paid' } },
      {
        $lookup: {
          from: 'doctors',
          let: { doctorId: { $toObjectId: '$doctorId' } },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$doctorId'] } } }],
          as: 'doctorInfo'
        }
      },
      { $unwind: { path: '$doctorInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $toDouble: '$doctorInfo.consultationFee' } }
        }
      }
    ]).toArray();

    const totalRevenue = revenueData[0]?.totalRevenue || 0;

    // Recent 5 appointments
    const recentAppointments = await appointmentCollection
      .find()
      .sort({ bookedAt: -1 })
      .limit(5)
      .toArray();

    // ── Top 5 doctors WITH name ──
    const topDoctorsRaw = await appointmentCollection.aggregate([
      { $group: { _id: '$doctorId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]).toArray();

    const topDoctors = await Promise.all(
      topDoctorsRaw.map(async (d) => {
        try {
          const doctor = await doctorCollection.findOne(
            { _id: new ObjectId(d._id) },
            { projection: { name: 1, specialist: 1, photo: 1 } }
          );
          return {
            _id: d._id,
            count: d.count,
            name: doctor?.name || 'Unknown',
            specialist: doctor?.specialist || '—',
            photo: doctor?.photo || null,
          };
        } catch {
          return { _id: d._id, count: d.count, name: 'Unknown', specialist: '—', photo: null };
        }
      })
    );

    // ── Monthly appointments (last 6 months) ──
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end   = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      const count = await appointmentCollection.countDocuments({
        bookedAt: { $gte: start, $lte: end }
      });

      monthlyData.push({
        month: start.toLocaleString('en-US', { month: 'short' }),
        appointments: count,
      });
    }

    res.json({
      success: true,
      stats: {
        totalDoctors,
        totalPatients,
        totalAppointments,
        thisMonthAppointments,
        totalRevenue,
        onlineDoctors,
        appointmentsByStatus: {
          pending: pendingAppointments,
          confirmed: confirmedAppointments,
          completed: completedAppointments,
          cancelled: cancelledAppointments,
        },
      },
      recentAppointments,
      topDoctors,
      monthlyData,  
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/appointments', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;

    let query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { patientName:  { $regex: search, $options: 'i' } },
        { patientEmail: { $regex: search, $options: 'i' } },
        { patientPhone: { $regex: search, $options: 'i' } },
      ];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await appointmentCollection.countDocuments(query);

    const appointments = await appointmentCollection
      .find(query)
      .sort({ bookedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    // Doctor info 
    const withDoctor = await Promise.all(
      appointments.map(async (apt) => {
        try {
          const doctor = await doctorCollection.findOne(
            { _id: new ObjectId(apt.doctorId) },
            { projection: { name: 1, specialist: 1, photo: 1 } }
          );
          return { ...apt, doctor };
        } catch {
          return { ...apt, doctor: null };
        }
      })
    );

    res.json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      appointments: withDoctor,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch('/api/admin/appointments/:id/status', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    await appointmentCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status, updatedAt: new Date() } }
    );

    res.json({ success: true, message: `Appointment ${status}!` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/patients', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    let query = { role: 'user' };
    if (search) {
      query.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await userCollection.countDocuments(query);

    const patients = await userCollection
      .find(query)
      .project({ password: 0 })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    const withCount = await Promise.all(
      patients.map(async (p) => {
        const appointmentCount = await appointmentCollection.countDocuments({
          patientEmail: p.email
        });
        return { ...p, appointmentCount };
      })
    );

    res.json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      patients: withCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch('/api/admin/users/:email/role', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    await userCollection.updateOne(
      { email: req.params.email },
      { $set: { role } }
    );
    res.json({ success: true, message: `User role updated to ${role}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Check if user is admin
app.get('/api/admin/check/:email', verifyToken, async (req, res) => {
  try {
    const user = await userCollection.findOne({ email: req.params.email });
    res.json({ success: true, isAdmin: user?.role === 'admin' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/make-admin/:email', async (req, res) => {
  try {
    await userCollection.updateOne(
      { email: req.params.email },
      { $set: { role: 'admin' } }
    );
    res.json({ success: true, message: `${req.params.email} is now admin!` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

//  NEW: Admin doctor password set/reset
app.patch('/api/admin/doctors/:id/password', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const hashed = await bcrypt.hash(password, 10);
    await doctorCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { password: hashed, updatedAt: new Date() } }
    );
    res.json({ success: true, message: 'Doctor password set successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// APPOINTMENT ROUTES

// Appointment book (only for authenticated users)
app.post('/api/appointments', verifyToken, async (req, res) => {
  try {
    const { doctorId, appointmentDate, appointmentTime } = req.body;

    // Doctor exist 
    const doctor = await doctorCollection.findOne({ _id: new ObjectId(doctorId) });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    // slot already booked
    const existing = await appointmentCollection.findOne({
      doctorId,
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      status: { $in: ['Pending', 'Confirmed'] }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'This time slot is already booked. Please choose another time.'
      });
    }

    const callRoomId = `room-${uuidv4()}`;
    const appointment = createAppointment(req.body, req.decoded.email, callRoomId);
    const result = await appointmentCollection.insertOne(appointment);

    // Doctor info 
    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully!',
      appointment: {
        ...appointment,
        _id: result.insertedId,
        doctor: {
          name: doctor.name,
          specialist: doctor.specialist,
          photo: doctor.photo,
          experience: doctor.experience,
          rating: doctor.rating
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// appointments
app.get('/api/appointments/my', verifyToken, async (req, res) => {
  try {
    const appointments = await appointmentCollection
      .find({ patientEmail: req.decoded.email })
      .sort({ bookedAt: -1 })
      .toArray();

    // Doctor info
    const appointmentsWithDoctor = await Promise.all(
      appointments.map(async (apt) => {
        const doctor = await doctorCollection.findOne(
          { _id: new ObjectId(apt.doctorId) },
          { projection: { name: 1, specialist: 1, photo: 1, isOnline: 1, isBusy: 1 } }
        );
        return { ...apt, doctor };
      })
    );

    res.json({ success: true, appointments: appointmentsWithDoctor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// Single appointment GET
app.get('/api/appointments/:id', verifyToken, async (req, res) => {
  try {
    const apt = await appointmentCollection.findOne({ 
      _id: new ObjectId(req.params.id) 
    });
    if (!apt) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, appointment: apt });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Appointment cancel
app.patch('/api/appointments/:id/cancel', verifyToken, async (req, res) => {
  try {
    const appointment = await appointmentCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (appointment.patientEmail !== req.decoded.email) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await appointmentCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: 'Cancelled' } }
    );
    res.json({ success: true, message: 'Appointment cancelled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create Payment Intent
app.post('/api/payment/create-intent', verifyToken, async (req, res) => {
  try {
    const { doctorId, amount } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // cents
      currency: 'usd',
      metadata: {
        doctorId,
        patientEmail: req.decoded.email,
      },
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Confirm payment + save appointment
app.post('/api/payment/confirm', verifyToken, async (req, res) => {
  try {
    const { paymentIntentId, appointmentData } = req.body;

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ success: false, message: 'Payment not completed' });
    }

    // Check slot not already booked
    const existing = await appointmentCollection.findOne({
      doctorId: appointmentData.doctorId,
      appointmentDate: new Date(appointmentData.appointmentDate),
      appointmentTime: appointmentData.appointmentTime,
      status: { $in: ['Pending', 'Confirmed'] }
    });

    if (existing) {
      // Refund if slot taken
      await stripe.refunds.create({ payment_intent: paymentIntentId });
      return res.status(400).json({
        success: false,
        message: 'Slot already booked. Payment refunded.'
      });
    }

    const { v4: uuidv4 } = require('uuid');
    const callRoomId = `room-${uuidv4()}`;

    const { createAppointment } = require('./appointment.model');
    const appointment = createAppointment(
      { ...appointmentData, paymentIntentId, paymentStatus: 'paid' },
      req.decoded.email,
      callRoomId
    );

    const result = await appointmentCollection.insertOne(appointment);

    const doctor = await doctorCollection.findOne(
      { _id: new ObjectId(appointmentData.doctorId) },
      { projection: { name: 1, specialist: 1, photo: 1 } }
    );

    res.status(201).json({
      success: true,
      message: 'Payment successful! Appointment booked.',
      appointment: {
        ...appointment,
        _id: result.insertedId,
        doctor,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// MEDICAL AI ROUTES


app.get('/api/health', async (req, res) => {
  try {
    const response = await apiClient.get('/health');
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'FastAPI health check failed', error: error.message });
  }
});

app.get('/api/symptoms', async (req, res) => {
  try {
    const response = await apiClient.get('/symptoms');
    res.json({ success: true, total: response.data.length, symptoms: response.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching symptoms', error: error.message });
  }
});

app.post('/api/predict', async (req, res) => {
  try {
    const symptomsInput = req.body.symptoms || req.body.symptomsText || req.body.message;
    if (!symptomsInput?.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide symptoms' });
    }
    const response = await apiClient.post('/predict', { symptoms: symptomsInput });
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false, message: 'Prediction failed', error: error.response?.data?.detail || error.message
    });
  }
});

app.post('/api/predict-list', async (req, res) => {
  try {
    const symptomsList = req.body.symptoms || req.body.symptomsList;
    if (!symptomsList || !Array.isArray(symptomsList) || symptomsList.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide symptoms as an array' });
    }
    const response = await apiClient.post('/predict-from-list', { symptoms: symptomsList });
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false, message: 'Prediction failed', error: error.response?.data?.detail || error.message
    });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ success: false, reply: 'Please tell me about your symptoms.' });
    }

    const lower = message.toLowerCase();
    if (['hello', 'hi', 'hey'].some(g => lower.includes(g))) {
      return res.json({
        success: true,
        reply: "👋 Hello! I'm your Medical Assistant. Please describe your symptoms.",
        isGreeting: true
      });
    }

    const response = await apiClient.post('/predict', { symptoms: message });
    const data = response.data;

    const reply = `🏥 Based on your symptoms: "${message}"

🔍 Detected symptoms: ${data.matched_symptoms.join(', ')}

💊 This might indicate: **${data.disease}**
📊 Confidence: ${data.confidence}%

📖 About: ${data.description}

💉 Suggested medicines:
${data.suggested_medicines.map((m, i) => `${i + 1}. ${m}`).join('\n')}

⚠️ Precautions:
${data.precautions.map((p, i) => `${i + 1}. ${p}`).join('\n')}

👨‍⚕️ See a: ${data.doctor_specialty}

${data.disclaimer}`.trim();

    res.json({ success: true, reply, data });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      reply: "I couldn't understand your symptoms. Please describe them more clearly.",
      error: error.message
    });
  }
});


// WEBRTC SOCKET


io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  socket.on('join-room', ({ roomId, userId, userType }) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', { userId, userType });
  });

  socket.on('offer',         ({ roomId, offer })     => socket.to(roomId).emit('offer', { offer }));
  socket.on('answer',        ({ roomId, answer })    => socket.to(roomId).emit('answer', { answer }));
  socket.on('ice-candidate', ({ roomId, candidate }) => socket.to(roomId).emit('ice-candidate', { candidate }));

  socket.on('doctor-busy', async ({ doctorId, roomId }) => {
    await doctorCollection?.updateOne(
      { _id: new ObjectId(doctorId) },
      { $set: { isBusy: true, currentCallRoom: roomId } }
    );
    io.emit('doctor-status-updated', { doctorId, isBusy: true });
  });

  socket.on('doctor-free', async ({ doctorId }) => {
    await doctorCollection?.updateOne(
      { _id: new ObjectId(doctorId) },
      { $set: { isBusy: false, currentCallRoom: null } }
    );
    io.emit('doctor-status-updated', { doctorId, isBusy: false });
  });

  socket.on('end-call', ({ roomId }) => {
    socket.to(roomId).emit('call-ended');
    socket.leave(roomId);
  });
 socket.on('chat-message', ({ roomId, message, sender, time, image }) => {
  socket.to(roomId).emit('chat-message', { message, sender, time, image });
});

  socket.on('disconnect', () => console.log(`❌ Disconnected: ${socket.id}`));
});
// Contact form
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: "Required fields missing" });
    }
    const db = client.db("medical_system");
    await db.collection("contacts").insertOne({
      name, email, subject, message,
      createdAt: new Date()
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


const https = require('https');

setInterval(() => {
  https.get('https://medical-assistant-backend-og0t.onrender.com', (res) => {
    console.log(`Self ping: ${res.statusCode}`);
  }).on('error', (err) => {
    console.log(`Ping error: ${err.message}`);
  });
}, 840000);
// ERROR HANDLERS


app.use((err, req, res, next) => {
  res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});


// START SERVER


server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🏥 Medical Assistant Backend');
  console.log('='.repeat(60));
  console.log(`✅ Server:    http://localhost:${PORT}`);
  console.log(`🔗 FastAPI:   ${MEDICAL_API_URL}`);
  console.log('='.repeat(60));
  console.log('📍 Endpoints:');
  console.log('   AUTH:         POST /jwt | POST /api/users | GET /api/users/me');
  console.log('   DOCTORS:      GET /api/doctors | GET /api/doctors/:id');
  console.log('   APPOINTMENTS: POST /api/appointments | GET /api/appointments/my');
  console.log('   AI:           POST /api/chat | POST /api/predict');
  console.log('   SOCKET:       WebRTC signaling enabled');
  console.log('='.repeat(60) + '\n');
});

module.exports = app;