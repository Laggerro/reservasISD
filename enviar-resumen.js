// enviar-resumen.js
const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const nodemailer = require('nodemailer');

// Inicializamos Firebase con las credenciales seguras de GitHub
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://reservasisd-default-rtdb.firebaseio.com/"
});

const db = getDatabase();

// Configuración del transporte SMTP con tu cuenta de Google
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Obtener destinatarios autorizados
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

// Devuelve un objeto Date ajustado a la zona horaria de Argentina
function obtenerFechaYHoraArgentina() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * -3));
}

// Nueva función para verificar si coincide la hora actual con la de Firebase
// Nueva función para verificar si coincide la hora actual con alguna de las configuradas en Firebase
async function verificarHoraDeEnvio() {
  try {
    const configRef = db.ref('configuraciones/hora_reporte');
    const snapshot = await configRef.once('value');
    
    // Si no existe configuración, por defecto dejamos las "08:00"
    const valorFirebase = snapshot.exists() ? snapshot.val() : "08:00"; 
    
    // Convertimos el string en un Array. Ej: "08:00, 13:00" -> ["08:00", "13:00"]
    const horasConfiguradas = valorFirebase
      .split(',')
      .map(hora => hora.trim()); // Limpia espacios en blanco accidentales

    const fechaArg = obtenerFechaYHoraArgentina();
    const horaActual = String(fechaArg.getHours()).padStart(2, '0');
    
    // Redondeamos los minutos a bloques de 30 para acoplarnos al Cron de GitHub Actions
    const minutos = fechaArg.getMinutes();
    let minutosAlineados = "00";
    if (minutos >= 15 && minutos < 45) {
      minutosAlineados = "30";
    } else if (minutos >= 45) {
      // Si son más de las XX:45, redondeamos a la siguiente hora en punto
      const siguienteHora = String((fechaArg.getHours() + 1) % 24).padStart(2, '0');
      const horaFormateadaSiguiente = `${siguienteHora}:00`;
      
      console.log(`⏰ Hora real: ${horaActual}:${String(minutos).padStart(2, '0')} | Horarios permitidos en DB: [${horasConfiguradas.join(', ')}]`);
      return horasConfiguradas.includes(horaFormateadaSiguiente);
    }

    const horaActualString = `${horaActual}:${minutosAlineados}`;

    console.log(`⏰ Hora redondeada: ${horaActualString} | Horarios permitidos en DB: [${horasConfiguradas.join(', ')}]`);
    
    // Retorna true si la hora actual calculada está presente en la lista de la base de datos
    return horasConfiguradas.includes(horaActualString);

  } catch (error) {
    console.error("❌ Error al verificar las horas en Firebase:", error);
    return false; // Por seguridad ante fallos, no enviamos
  }
}

async function generarYEnviarReporte() {
  // 1. VERIFICAR SI ES EL MOMENTO CORRECTO DE ENVIAR
  const esHoraDeEnvio = await verificarHoraDeEnvio();
  if (!esHoraDeEnvio) {
    console.log("⏸️ No es la hora configurada para el envío. El script finaliza pacíficamente.");
    process.exit(0);
  }

  console.log("🚀 ¡Hora coincidente! Iniciando generación de reporte diario...");

  const fechaArg = obtenerFechaYHoraArgentina();
  const offsetYear = fechaArg.getFullYear();
  const offsetMonth = String(fechaArg.getMonth() + 1).padStart(2, '0');
  const offsetDay = String(fechaArg.getDate()).padStart(2, '0');
  const fechaHoy = `${offsetYear}-${offsetMonth}-${offsetDay}`;

  const fechaAmigable = `${offsetDay}-${offsetMonth}-${offsetYear}`; // Formato DD-MM-YYYY para el contenido
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
        <h2 style="font-family: sans-serif; color: #1e3a8a;">☀️ Reporte Diario de Reservas - ${fechaAmigable}</h2>
        <p style="font-family: sans-serif; color: #374151;"> 👋 Hola, les dejamos el resumen de los recursos reservados para el día de hoy:</p>
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
        <h2 style="font-family: sans-serif; color: #1e3a8a;">☀️ Reporte Diario de Reservas - ${fechaAmigable}</h2>
        <p style="font-family: sans-serif; color: #374151;">👋 Hola. No se registran reservas de recursos para el día de hoy. ¡Que tengan una excelente jornada!</p>
      `;
    }

    console.log(`📧 Intentando enviar reporte diario a: [${destinatarios.join(', ')}]`);

    const info = await transporter.sendMail({
      from: `"Reservas ISD" <${process.env.SMTP_USER}>`, 
      to: destinatarios.join(', '), 
      subject: `☀️ Reservas del Día - ${fechaAmigable}`, // <-- CAMBIADO A FECHA AMIGABLE (DD-MM-YYYY)
      html: contenidoHtml
    });

    console.log("✅ Reporte enviado con éxito. ID del mensaje:", info.messageId);
  } catch (error) {
    console.error("❌ Error al procesar o enviar el reporte diario:", error);
  }
  process.exit(0);
}

generarYEnviarReporte();