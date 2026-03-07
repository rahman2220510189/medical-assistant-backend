const createAppointment = (data, patientId, callRoomId) => ({
  patientId: patientId,
  doctorId: data.doctorId,
  patientName: data.patientName,
  patientPhone: data.patientPhone,
  patientEmail: data.patientEmail,
  patientAge: data.patientAge,
  patientGender: data.patientGender,
  symptoms: data.symptoms,
  appointmentType: data.appointmentType, // 'Video Call' | 'Audio Call' | 'In-Person'
  appointmentDate: new Date(data.appointmentDate),
  appointmentTime: data.appointmentTime,
  status: 'Pending', // Pending | Confirmed | Cancelled | Completed
  callRoomId: callRoomId,
  bookedAt: new Date(),
  notes: data.notes || ''
});

module.exports = { createAppointment };