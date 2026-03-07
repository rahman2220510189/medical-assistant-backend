const { ObjectId } = require('mongodb');

// Doctor schema structure (MongoDB native)
const createDoctor = (data) => ({
  name: data.name,
  email: data.email,
  phone: data.phone || '',
  photo: data.photo || 'https://i.ibb.co/default-doctor.png',
  specialist: data.specialist,
  experience: data.experience || 0,
  rating: data.rating || 4.5,
  totalReviews: data.totalReviews || 0,
  qualifications: data.qualifications || [],
  about: data.about || '',
  consultationFee: data.consultationFee || 500,
  availability: data.availability || [],
  isOnline: false,
  isBusy: false,
  currentCallRoom: null,
  createdAt: new Date()
});

module.exports = { createDoctor };