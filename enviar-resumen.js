// enviar-resumen.js
const { initializeApp, cert } = require('firebase-admin/app'); // <-- Nueva sintaxis de Firebase Admin
const { getDatabase } = require('firebase-admin/database');    // <-- Nueva sintaxis de Firebase Admin
const nodemailer = require('nodemailer');

// Inicializamos Firebase con las credenciales seguras de GitHub
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://reservasisd-default-rtdb.firebaseio.com/"
});

const db = getDatabase(); // <-- Ahora obtenemos la base de datos de esta forma

// Configuración del transporte SMTP con tu cuenta de Google
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER, // Tu correo de origen (ej: tu-cuenta@institutosandiego.edu.ar)
    pass: process.env.SMTP_PASS  // La contraseña de aplicación de 16 letras que generaste en Google
  }
});

// Función para obtener la lista de correos que tienen "recibe_reporte: true" en Firebase
async function obtenerDestinatariosReporte() {
  const ref = db.ref('usuarios_autorizados');
  const snapshot = await ref.once('value');
  const correos = [];

  if (process.env.EMAIL_DESTINATARIO) {
    correos.push(process.env.EMAIL_DESTINATARIO.trim().toLowerCase());
  }

  if (snapshot.exists()) {
    snapshot.forEach((childSnapshot) => {
      const usuario = childSnapshot.val();
      if (usuario.recibe_reporte === true && usuario.email) {
        correos.push(usuario.email.trim().toLowerCase());
      }
    });
  }

  return [...new Set(correos)];
}

function obtenerFechaArgentina() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const argDate = new Date(utc + (3600000 * -3));

  const offsetYear = argDate.getFullYear();
  const offsetMonth = String(argDate.getMonth() + 1).padStart(2, '0');
  const offsetDay = String(argDate.getDate()).padStart(2, '0');

  return `${offsetYear}-${offsetMonth}-${offsetDay}`;
}

async function generarYEnviarReporte() {
  const fechaHoy = obtenerFechaArgentina();
  const reservasRef = db.ref('reservas');
  
  try {
    const destinatarios = await obtenerDestinatariosReporte();

    if (destinatarios.length === 0) {
      console.log("⚠️ No hay destinatarios configurados para recibir el reporte. Proceso cancelado.");
      process.exit(0);
    }

    const snapshot = await reservasRef.once('value');
    const reservas = snapshot.val();
    
    let tablaFilas = '';
    let hayReservas = false;

    console.log(`📅 Buscando reservas para la fecha de hoy: "${fechaHoy}"`);

    if (reservas) {
      Object.keys(reservas).forEach(id => {
        const r = reservas[id];
        if (r.start) {
          const fechaReserva = r.start.substring(0, 10);
          if (fechaReserva === fechaHoy) {
            const horaInicio = r.start.substring(11, 16);
            const horaFin = r.end ? r.end.substring(11, 16) : 'No especificada';
            const horario = `${horaInicio} a ${horaFin} hs`;

            tablaFilas += `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-family: sans-serif;">${r.usuarioNombre || 'Sin nombre'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-family: sans-serif;">${r.equipo || 'Sin recurso'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-family: sans-serif;">${horario}</td>
              </tr>`;
            hayReservas = true;
          }
        }
      });
    }

    let contenidoHtml = '';
    if (hayReservas) {
      contenidoHtml = `
        <h2 style="font-family: sans-serif; color: #1e3a8a;">☀️ Reporte Diario de Reservas - ${fechaHoy}</h2>
        <p style="font-family: sans-serif; color: #374151;">Hola, les dejamos el resumen de los recursos reservados para el día de hoy:</p>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 8px; border-bottom: 2px solid #e5e7eb; font-family: sans-serif; color: #1f2937;">Docente</th>
              <th style="padding: 8px; border-bottom: 2px solid #e5e7eb; font-family: sans-serif; color: #1f2937;">Recurso / Equipo</th>
              <th style="padding: 8px; border-bottom: 2px solid #e5e7eb; font-family: sans-serif; color: #1f2937;">Horario</th>
            </tr>
          </thead>
          <tbody>
            ${tablaFilas}
          </tbody>
        </table>
      `;
    } else {
      contenidoHtml = `
        <h2 style="font-family: sans-serif; color: #1e3a8a;">☀️ Reporte Diario de Reservas - ${fechaHoy}</h2>
        <p style="font-family: sans-serif; color: #374151;">Hola. No se registran reservas de recursos para el día de hoy. ¡Que tengan una excelente jornada!</p>
      `;
    }

    console.log(`📧 Intentando enviar reporte diario a: [${destinatarios.join(', ')}]`);

    // 3. Enviar el correo usando Nodemailer (SMTP directo de Google)
    const info = await transporter.sendMail({
      from: `"Reservas ISD" <${process.env.SMTP_USER}>`, 
      to: destinatarios.join(', '), // Nodemailer acepta los correos separados por comas en un solo string
      subject: `☀️ Reservas del Día - ${fechaHoy}`,
      html: contenidoHtml
    });

    console.log("✅ Reporte enviado con éxito. ID del mensaje:", info.messageId);
  } catch (error) {
    console.error("❌ Error al procesar o enviar el reporte diario:", error);
  }
  process.exit(0);
}

generarYEnviarReporte();