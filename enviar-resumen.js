const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const nodemailer = require('nodemailer');

// Inicialización de Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://reservasisd-default-rtdb.firebaseio.com/"
});

const db = getDatabase();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

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

// Obtiene la hora y fecha formateadas en la zona horaria de Argentina
function obtenerDatosArgentina() {
  const ahora = new Date();

  // Formateador para hora y minutos
  const fmtHora = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  // Formateador para fecha (AAAA-MM-DD)
  const fmtFecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const partesHora = fmtHora.formatToParts(ahora);
  const hora = parseInt(partesHora.find(p => p.type === 'hour').value, 10);
  const minutos = parseInt(partesHora.find(p => p.type === 'minute').value, 10);

  const fechaHoy = fmtFecha.format(ahora); // Devuelve YYYY-MM-DD
  const [year, month, day] = fechaHoy.split('-');
  const fechaAmigable = `${day}-${month}-${year}`;

  return { hora, minutos, fechaHoy, fechaAmigable };
}

async function verificarHoraDeEnvio(esManual) {
  try {
    // Si la ejecución es manual (workflow_dispatch), forzamos el envío omitiendo el rango
    if (esManual) {
      console.log("⚡ Ejecución manual detectada. Omitiendo la validación de ventana horaria.");
      return true;
    }

    const configRef = db.ref('configuracion/hora_reporte');
    const snapshot = await configRef.once('value');

    const valorFirebase = snapshot.exists() ? snapshot.val() : "08:00";
    const horasConfiguradas = valorFirebase
      .split(',')
      .map(hora => hora.trim())
      .filter(hora => hora.match(/^\d{2}:\d{2}$/));

    const { hora: horaActual, minutos: minutosActuales } = obtenerDatosArgentina();

    console.log(`⏰ Hora real actual en Argentina: ${String(horaActual).padStart(2, '0')}:${String(minutosActuales).padStart(2, '0')}`);
    console.log(`📋 Horarios de envío configurados en la DB: [${horasConfiguradas.join(', ')}]`);

    const minutosActualesTotales = horaActual * 60 + minutosActuales;

    for (const horaStr of horasConfiguradas) {
      const [hConfig, mConfig] = horaStr.split(':').map(Number);
      const minutosConfigTotales = hConfig * 60 + mConfig;

      // Margen de 30 minutos desde la hora programada
     // Reemplaza esta sección en verificarHoraDeEnvio:

// Margen de 45 minutos desde la hora programada para tolerar demoras de GitHub Actions
if (minutosActualesTotales >= minutosConfigTotales && minutosActualesTotales < minutosConfigTotales + 45) {
  console.log(`🎯 ¡Coincidencia! La hora actual está en el rango de envío de las ${horaStr}.`);
  return true;
}
    }
    console.log("⏸️ Ningún horario programado coincide con el rango de tiempo actual.");
    return false;
  } catch (error) {
    console.error("❌ Error al verificar las horas en Firebase:", error);
    return false;
  }
}

async function generarYEnviarReporte() {
  // Detecta si se ejecutó manualmente desde GitHub Actions mediante la variable de entorno
  const esManual = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';

  const esHoraDeEnvio = await verificarHoraDeEnvio(esManual);
  if (!esHoraDeEnvio) {
    console.log("⏸️ El script finaliza pacíficamente.");
    process.exit(0);
  }

  console.log("🚀 ¡Iniciando generación de reporte diario!");
  const { fechaHoy, fechaAmigable } = obtenerDatosArgentina();
  const reservasRef = db.ref('reservas');

  try {
    const destinatarios = await obtenerDestinatariosReporte();
    if (destinatarios.length === 0) {
      console.log("⚠️ No hay destinatarios configurados. Proceso cancelado.");
      process.exit(0);
    }

    const snapshot = await reservasRef.once('value');
    const reservas = snapshot.val();
    let tablaFilas = '';
    let hayReservas = false;

    console.log(`📅 Buscando reservas para hoy: "${fechaHoy}"`);

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
        <p style="font-family: sans-serif; color: #374151;">Buen día, este es el reporte diario de las reservas para el día de hoy:</p> 
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
        </table>`;
    } else {
      contenidoHtml = ` 
        <h2 style="font-family: sans-serif; color: #1e3a8a;">☀️ Reporte Diario de Reservas - ${fechaAmigable}</h2> 
        <p style="font-family: sans-serif; color: #374151;">Buen día. No se registran reservas de recursos para el día de hoy. ¡Que tengan una excelente jornada!</p>`;
    }

    console.log(`📧 Intentando enviar reporte diario a: [${destinatarios.join(', ')}]`);

    const info = await transporter.sendMail({
      from: `"Reservas ISD" <${process.env.SMTP_USER}>`,
      to: destinatarios.join(', '),
      subject: `☀️ Reservas del Día - ${fechaAmigable}`,
      html: contenidoHtml
    });

    console.log("✅ Reporte enviado con éxito. ID del mensaje:", info.messageId);
  } catch (error) {
    console.error("❌ Error al procesar o enviar el reporte diario:", error);
  }
  process.exit(0);
}

generarYEnviarReporte();
