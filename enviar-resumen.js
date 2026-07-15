// enviar-resumen.js
const admin = require('firebase-admin');
const { Resend } = require('resend');

// Inicializamos Resend con la clave que guardaremos segura en GitHub
const resend = new Resend(process.env.RESEND_API_KEY);

// Inicializamos Firebase con las credenciales que guardaremos seguras en GitHub
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://reservasisd-default-rtdb.firebaseio.com/"
});

const db = admin.database();

// Función para obtener la lista de correos que tienen "recibe_reporte: true" en Firebase
async function obtenerDestinatariosReporte() {
  const ref = db.ref('usuarios_autorizados');
  const snapshot = await ref.once('value');
  
  const correos = [];

  // Agregamos el correo de respaldo configurado en tus Secrets de GitHub
  if (process.env.EMAIL_DESTINATARIO) {
    correos.push(process.env.EMAIL_DESTINATARIO.trim().toLowerCase());
  }

  // Recorremos los usuarios en Firebase buscando los que tengan "recibe_reporte: true"
  if (snapshot.exists()) {
    snapshot.forEach((childSnapshot) => {
      const usuario = childSnapshot.val();
      // Validamos explícitamente que sea true (booleano)
      if (usuario.recibe_reporte === true && usuario.email) {
        correos.push(usuario.email.trim().toLowerCase());
      }
    });
  }

  // Quitamos correos duplicados por seguridad
  const destinatariosUnicos = [...new Set(correos)];
  console.log(`📋 Destinatarios encontrados en Firebase: [${destinatariosUnicos.join(', ')}]`);
  return destinatariosUnicos;
}

// Función para formatear la fecha de hoy de forma 100% segura en huso horario de Argentina (GMT-3)
function obtenerFechaArgentina() {
  const d = new Date();
  // Forzamos el desvío horario manual a GMT-3 para evitar problemas de servidor
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
    // 1. Buscamos los destinatarios dinámicos
    const destinatarios = await obtenerDestinatariosReporte();

    if (destinatarios.length === 0) {
      console.log("⚠️ No hay destinatarios configurados para recibir el reporte. Proceso cancelado.");
      process.exit(0);
    }

    // 2. Buscamos las reservas
    const snapshot = await reservasRef.once('value');
    const reservas = snapshot.val();
    
    let tablaFilas = '';
    let hayReservas = false;

    console.log(`📅 Buscando reservas para la fecha de hoy: "${fechaHoy}"`);

    if (reservas) {
      Object.keys(reservas).forEach(id => {
        const r = reservas[id];
        
        // El campo "start" contiene la fecha y hora: "AAAA-MM-DDTHH:MM:SS"
        if (r.start) {
          // Extraemos solo la fecha (los primeros 10 caracteres: "AAAA-MM-DD")
          const fechaReserva = r.start.substring(0, 10);
          
          if (fechaReserva === fechaHoy) {
            const horaInicio = r.start.substring(11, 16); // "HH:MM"
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

    // 3. Enviar el correo usando Resend
    const response = await resend.emails.send({
      from: 'Sistema ISD <onboarding@resend.dev>',
      to: destinatarios, 
      subject: `☀️ Reservas del Día - ${fechaHoy}`,
      html: contenidoHtml
    });

    console.log("✅ Respuesta de Resend:", response);
    console.log("✅ Reporte diario procesado con éxito.");
  } catch (error) {
    console.error("❌ Error al procesar el reporte diario:", error);
  }
  process.exit(0);
}

generarYEnviarReporte();