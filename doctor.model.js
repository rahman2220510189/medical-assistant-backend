const { ObjectId } = require('mongodb');

const createDoctor = (data) => ({
  name: data.name,
  email: data.email,
  phone: data.phone || '',
  photo: data.photo || 'https://i.ibb.co/default-doctor.png',
  specialist: data.specialist,
  experience: Number(data.experience) || 0,
  rating: Number(data.rating) || 4.5,
  totalReviews: data.totalReviews || 0,
  qualifications: data.qualifications || [],
  about: data.about || '',
  consultationFee: Number(data.consultationFee) || 500,  
  availability: data.availability || [],
  password: data.password || null,
  isOnline: false,
  isBusy: false,
  currentCallRoom: null,
  createdAt: new Date()
});

module.exports = { createDoctor };