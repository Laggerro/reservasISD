// enviar-resumen.js
const admin = require('firebase-admin');
const { Resend } = require('resend');

// Inicializamos Resend con la clave que guardaremos segura en GitHub
const resend = new Resend(process.env.RESEND_API_KEY);

// Inicializamos Firebase con las credenciales que guardaremos seguras en GitHub
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://reservasisd-default-rtdb.firebaseio.com/" // Reemplaza por la URL de tu Firebase
});

const db = admin.database();

// Función para obtener la lista de correos que tienen "recibe_reporte: true" en Firebase
async function obtenerDestinatariosReporte() {
  const ref = db.ref('usuarios_autorizados');
  const snapshot = await ref.once('value');
  
  const correos = [];

  // Agregamos el correo de respaldo que configuraste en tus Secrets de GitHub por si acaso
  if (process.env.EMAIL_DESTINATARIO) {
    correos.push(process.env.EMAIL_DESTINATARIO.trim().toLowerCase());
  }

  // Recorremos los usuarios en Firebase buscando los que tengan "recibe_reporte: true"
  if (snapshot.exists()) {
    snapshot.forEach((childSnapshot) => {
      const usuario = childSnapshot.val();
      if (usuario.recibe_reporte === true && usuario.email) {
        correos.push(usuario.email.trim().toLowerCase());
      }
    });
  }

  // Quitamos correos duplicados por seguridad
  return [...new Set(correos)];
}

async function generarYEnviarReporte() {
  // Obtenemos la fecha de hoy en formato local de Argentina (Buenos Aires) - CORREGIDO CON "_"
  const fechaHoy = new Date().toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).split('/').reverse().join('-'); // Convierte DD/MM/AAAA a AAAA-MM-DD

  const reservasRef = db.ref('reservas');
  
  try {
    // 1. Buscamos los destinatarios dinámicos
    const destinatarios = await obtenerDestinatariosReporte();

    if (destinatarios.length === 0) {
      console.log("⚠️ No hay destinatarios configurados para recibir el reporte. Proceso cancelado.");
      process.exit();
    }

    // 2. Buscamos las reservas
    const snapshot = await reservasRef.once('value');
    const reservas = snapshot.val();
    
    let tablaFilas = '';
    let hayReservas = false;

    if (reservas) {
      Object.keys(reservas).forEach(id => {
        const r = reservas[id];
        if (r.fecha === fechaHoy) {
          tablaFilas += `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${r.docenteNombre || 'Sin nombre'}</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${r.recursoNombre || 'Sin recurso'}</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${r.modulo || 'No especificado'}</td>
            </tr>`;
          hayReservas = true;
        }
      });
    }

    let contenidoHtml = '';
    if (hayReservas) {
      contenidoHtml = `
        <h2>☀️ Reporte Diario de Reservas - ${fechaHoy}</h2>
        <p>Hola, les dejamos el resumen de los recursos reservados para el día de hoy:</p>
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="padding: 8px; border-bottom: 2px solid #ddd;">Docente</th>
              <th style="padding: 8px; border-bottom: 2px solid #ddd;">Recurso</th>
              <th style="padding: 8px; border-bottom: 2px solid #ddd;">Módulo</th>
            </tr>
          </thead>
          <tbody>
            ${tablaFilas}
          </tbody>
        </table>
      `;
    } else {
      contenidoHtml = `
        <h2>☀️ Reporte Diario de Reservas - ${fechaHoy}</h2>
        <p>Hola. No se registran reservas de recursos para el día de hoy. ¡Que tengan una excelente jornada!</p>
      `;
    }

    console.log(`📧 Enviando reporte diario a: ${destinatarios.join(', ')}`);

    // 3. Enviar el correo usando Resend (acepta un Array de correos)
    await resend.emails.send({
      from: 'Sistema ISD <onboarding@resend.dev>', // Remitente gratuito por defecto de Resend
      to: destinatarios, 
      subject: `☀️ Reservas del Día - ${fechaHoy}`,
      html: contenidoHtml
    });

    console.log("✅ Reporte diario enviado con éxito.");
  } catch (error) {
    console.error("❌ Error al procesar el reporte diario:", error);
  }
  process.exit();
}

generarYEnviarReporte();