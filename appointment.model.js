const createAppointment = (data, patientEmail, callRoomId) => ({
  patientId: patientEmail,
  doctorId: data.doctorId,
  patientName: data.patientName,
  patientPhone: data.patientPhone,
  patientEmail: patientEmail,
  patientAge: data.patientAge || null,
  patientGender: data.patientGender || null,
  symptoms: data.symptoms || null,
  appointmentType: data.appointmentType || 'In-Person',
  appointmentDate: new Date(data.appointmentDate),
  appointmentTime: data.appointmentTime,
  problem: data.problem || '',
  status: 'Pending',
  paymentStatus: data.paymentStatus || 'unpaid',     
  paymentIntentId: data.paymentIntentId || null,       
  callRoomId: callRoomId,
  bookedAt: new Date(),
  notes: data.notes || ''
});

module.exports = { createAppointment };