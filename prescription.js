const PDFDocument = require('pdfkit');
const { ObjectId } = require('mongodb');

const generatePrescription = async (req, res, appointmentCollection, doctorCollection) => {
  try {
    const { appointmentId } = req.params;

    // Appointment data 
    const appointment = await appointmentCollection.findOne({
      _id: new ObjectId(appointmentId)
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Doctor data
    const doctor = await doctorCollection.findOne({
      _id: new ObjectId(appointment.doctorId)
    });

    // PDF 
    const doc = new PDFDocument({ margin: 50 });

    // Response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=prescription-${appointmentId}.pdf`
    );

    doc.pipe(res);

    // ─── HEADER ───
    doc
      .rect(0, 0, doc.page.width, 120)
      .fill('#0ea5e9');

    doc
      .fillColor('white')
      .fontSize(26)
      .font('Helvetica-Bold')
      .text('🏥 Medical Assistant', 50, 30);

    doc
      .fontSize(12)
      .font('Helvetica')
      .text('Professional Healthcare Service', 50, 65);

    doc
      .fontSize(10)
      .text(`Date: ${new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      })}`, 50, 85);

    doc.moveDown(4);

    // ─── PRESCRIPTION TITLE ───
    doc
      .fillColor('#0ea5e9')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('PRESCRIPTION', { align: 'center' });

    doc
      .moveTo(50, doc.y + 5)
      .lineTo(550, doc.y + 5)
      .strokeColor('#0ea5e9')
      .lineWidth(2)
      .stroke();

    doc.moveDown(1.5);

    // ─── DOCTOR INFO ───
    doc
      .fillColor('#1e293b')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Doctor Information');

    doc.moveDown(0.5);

    const doctorInfo = [
      ['Name',       `Dr. ${doctor?.name || 'N/A'}`],
      ['Specialist', doctor?.specialist || 'N/A'],
      ['Experience', `${doctor?.experience || 0} years`],
    ];

    doctorInfo.forEach(([label, value]) => {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#475569')
        .text(`${label}: `, { continued: true })
        .font('Helvetica')
        .fillColor('#1e293b')
        .text(value);
    });

    doc.moveDown(1);

    // ─── DIVIDER ───
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .stroke();

    doc.moveDown(1);

    // ─── PATIENT INFO ───
    doc
      .fillColor('#1e293b')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Patient Information');

    doc.moveDown(0.5);

    const patientInfo = [
      ['Name',            appointment.patientName || 'N/A'],
      ['Age',             `${appointment.patientAge || 'N/A'} years`],
      ['Gender',          appointment.patientGender || 'N/A'],
      ['Phone',           appointment.patientPhone || 'N/A'],
      ['Email',           appointment.patientEmail || 'N/A'],
      ['Appointment Type', appointment.appointmentType || 'N/A'],
      ['Date',            new Date(appointment.appointmentDate).toLocaleDateString()],
      ['Time',            appointment.appointmentTime || 'N/A'],
    ];

    patientInfo.forEach(([label, value]) => {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#475569')
        .text(`${label}: `, { continued: true })
        .font('Helvetica')
        .fillColor('#1e293b')
        .text(value);
    });

    doc.moveDown(1);

    // ─── DIVIDER ───
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .stroke();

    doc.moveDown(1);

    // ─── SYMPTOMS ───
    doc
      .fillColor('#1e293b')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Symptoms / Chief Complaint');

    doc.moveDown(0.5);

    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#334155')
      .text(appointment.symptoms || 'Not specified', {
        width: 500,
        align: 'left'
      });

    doc.moveDown(1);

    // ─── PRESCRIPTION NOTEPAD ───
    doc
      .fillColor('#1e293b')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Rx — Prescription Notes');

    doc.moveDown(0.5);

    // Notepad background
    const notepadY = doc.y;
    doc
      .rect(50, notepadY, 500, 180)
      .fill('#f8fafc')
      .stroke('#e2e8f0');

    // Notepad lines
    for (let i = 1; i <= 7; i++) {
      doc
        .moveTo(60, notepadY + (i * 23))
        .lineTo(540, notepadY + (i * 23))
        .strokeColor('#e2e8f0')
        .lineWidth(0.5)
        .stroke();
    }

    // Prescription text 
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#334155')
      .text(
        appointment.prescriptionNotes || 'Doctor\'s prescription will appear here.',
        60,
        notepadY + 10,
        { width: 480, height: 160 }
      );

    doc.moveDown(9);

    // ─── MEDICINES ───
    if (appointment.medicines && appointment.medicines.length > 0) {
      doc
        .fillColor('#1e293b')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Prescribed Medicines');

      doc.moveDown(0.5);

      appointment.medicines.forEach((med, i) => {
        doc
          .fontSize(11)
          .font('Helvetica')
          .fillColor('#334155')
          .text(`${i + 1}. ${med}`);
      });

      doc.moveDown(1);
    }

    // ─── DOCTOR SIGNATURE ───
    doc.moveDown(2);

    doc
      .moveTo(350, doc.y)
      .lineTo(550, doc.y)
      .strokeColor('#1e293b')
      .lineWidth(1)
      .stroke();

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1e293b')
      .text(`Dr. ${doctor?.name || 'Doctor'}`, 350, doc.y + 5)
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#64748b')
      .text(doctor?.specialist || '', 350);

    // ─── FOOTER ───
    doc
      .rect(0, doc.page.height - 50, doc.page.width, 50)
      .fill('#0ea5e9');

    doc
      .fillColor('white')
      .fontSize(9)
      .text(
        '⚠️ This prescription is AI-generated. Please consult a qualified doctor for proper medical advice.',
        50,
        doc.page.height - 35,
        { align: 'center', width: 500 }
      );

    doc.end();

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { generatePrescription };