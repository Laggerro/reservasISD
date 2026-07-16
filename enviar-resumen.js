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

// Devuelve la fecha y hora de Argentina garantizada usando el estándar internacional
function obtenerFechaYHoraArgentina() {
  const d = new Date();
  
  const opciones = {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  };
  
  const formateador = new Intl.DateTimeFormat('es-AR', opciones);
  const partes = formateador.formatToParts(d);
  
  const dic = {};
  partes.forEach(({type, value}) => { dic[type] = value; });
  
  return new Date(
    Number(dic.year),
    Number(dic.month) - 1,
    Number(dic.day),
    Number(dic.hour),
    Number(dic.minute),
    Number(dic.second)
  );
}

// Verifica si la hora actual está dentro de la ventana de 30 minutos de algún horario programado
async function verificarHoraDeEnvio() {
  try {
    const configRef = db.ref('configuracion/hora_reporte');
    const snapshot = await configRef.once('value');
    
    // Si no hay configuración guardada en la base de datos, usamos las "08:00" por defecto
    const valorFirebase = snapshot.exists() ? snapshot.val() : "08:00"; 
    
    // Dividimos por comas, limpiamos espacios y filtramos formatos inválidos (tipo HH:MM)
    const horasConfiguradas = valorFirebase
      .split(',')
      .map(hora => hora.trim())
      .filter(hora => hora.match(/^\d{2}:\d{2}$/));

    const fechaArg = obtenerFechaYHoraArgentina();
    const horaActual = fechaArg.getHours();
    const minutosActuales = fechaArg.getMinutes();

    console.log(`⏰ Hora real actual en Argentina: ${String(horaActual).padStart(2, '0')}:${String(minutosActuales).padStart(2, '0')}`);
    console.log(`📋 Horarios de envío configurados en la DB: [${horasConfiguradas.join(', ')}]`);

    for (const horaStr of horasConfiguradas) {
      const [hConfig, mConfig] = horaStr.split(':').map(Number);

      // Creamos un objeto de fecha para el día de hoy con la hora configurada
      const limiteInicio = new Date(fechaArg);
      limiteInicio.setHours(hConfig, mConfig, 0, 0);

      // Margen de gracia: 30 minutos después de la hora seleccionada
      const limiteFin = new Date(limiteInicio.getTime() + 30 * 60000);

      // Si estamos en ese rango de tiempo, el script aprueba el envío
      if (fechaArg >= limiteInicio && fechaArg < limiteFin) {
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
  // 1. Validar ventana de tiempo
  const esHoraDeEnvio = await verificarHoraDeEnvio();
  if (!esHoraDeEnvio) {
    console.log("⏸️ El script finaliza pacíficamente.");
    process.exit(0);
  }

  console.log("🚀 ¡Iniciando generación de reporte diario!");

  const fechaArg = obtenerFechaYHoraArgentina();
  const offsetYear = fechaArg.getFullYear();
  const offsetMonth = String(fechaArg.getMonth() + 1).padStart(2, '0');
  const offsetDay = String(fechaArg.getDate()).padStart(2, '0');
  const fechaHoy = `${offsetYear}-${offsetMonth}-${offsetDay}`;

  const fechaAmigable = `${offsetDay}-${offsetMonth}-${offsetYear}`; 
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