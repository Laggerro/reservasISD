

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
// CAMBIO CLAVE: Importamos las funciones para Realtime Database (RTDB)
import { getDatabase, ref, push, get, child, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// 1. CONFIGURACIÓN DE FIREBASE (Reemplazá con tus credenciales)
const firebaseConfig = {
  apiKey: "AIzaSyBOgShBOu05UszCBLS-bpTl2f3AI7_I-pY",
  authDomain: "reservasisd.firebaseapp.com",
  databaseURL: "https://reservasisd-default-rtdb.firebaseio.com",
  projectId: "reservasisd",
  storageBucket: "reservasisd.firebasestorage.app",
  messagingSenderId: "637702189208",
  appId: "1:637702189208:web:49ff477b35e299564ca0ed",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app); // Inicializamos RTDB



// 2. CAPTURAR EL ELEMENTO DESDE LA URL Y ADAPTAR EL TÍTULO
const urlParams = new URLSearchParams(window.location.search);
const equipoSeleccionado = urlParams.get('equipo') || "Equipo General"; 

const tituloCalendario = document.querySelector('main h2');
if (tituloCalendario) {
    tituloCalendario.textContent = `Calendario de Reservas: ${equipoSeleccionado}`;
}

// 3. VARIABLES GLOBALES Y ELEMENTOS DEL DOM
let calendar; 
let fechaSeleccionada = ""; 

const modal = document.getElementById('modal-reserva');
const modalFechaTexto = document.getElementById('modal-fecha-texto');
const btnCerrarModal = document.getElementById('btn-cerrar-modal');
const formReserva = document.getElementById('form-reserva');
const btnLogout = document.getElementById('btn-logout');

const btnVolver = document.getElementById('btn-volver');

// 4. CONTROL DE ACCESO (PROTECCIÓN DE RUTA)
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        inicializarCalendario();
    }
});

// 5. INICIALIZACIÓN DE FULLCALENDAR
function inicializarCalendario() {
    const calendarEl = document.getElementById('calendar');
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana' },

 // LEER RESERVAS DE ESTE EQUIPO DESDE RTDB
        events: async function(fetchInfo, successCallback, failureCallback) {
            try {
                const dbRef = ref(db);
                const snapshot = await get(child(dbRef, 'reservas'));
                const eventos = [];
                
                if (snapshot.exists()) {
                    snapshot.forEach((childSnapshot) => {
                        const data = childSnapshot.val();
                        if (data.equipo === equipoSeleccionado) {
                            eventos.push({
                                id: childSnapshot.key,
                                title: data.title || "Reservado",
                                start: data.start, 
                                end: data.end,
                                color: data.color || '#3182ce',
                                extendedProps: {
                                    usuarioEmail: data.usuarioEmail,
                                    // --- GUARDAMOS EL TIMESTAMP EN EL EVENTO ---
                                    timestampCreacion: data.timestampCreacion || null 
                                }
                            });
                        }
                    });
                }
                successCallback(eventos); 
            } catch (error) {
                console.error("Error al obtener las reservas de RTDB:", error);
                failureCallback(error);
            }
        },
        // CONTROLAR EL CLIC EN UN DÍA
    dateClick: function(info) {
            // OBTENER FECHAS EN FORMATO SOLO DÍA (Sin horas)
            const hoyLocal = new Date();
            hoyLocal.setHours(0,0,0,0); // Seteamos a la medianoche de hoy

            const fechaClickeada = new Date(info.dateStr + "T00:00:00");

            // VALIDACIÓN: Si la fecha seleccionada es menor a hoy, bloqueamos
            if (fechaClickeada < hoyLocal) {
                alert("❌ No podés agendar reservas en fechas anteriores al día de hoy.");
                return; // Frena la apertura del modal
            }

            fechaSeleccionada = info.dateStr; 
            
            const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const fechaFormateada = fechaClickeada.toLocaleDateString('es-ES', opciones);
            
            modalFechaTexto.textContent = `Día: ${fechaFormateada}`;
            formReserva.reset(); 
            modal.classList.remove('hidden'); 
        },

     
eventClick: async function(info) {
            const usuarioActual = auth.currentUser;
            const creadorReserva = info.event.extendedProps.usuarioEmail;
            const timestamp = info.event.extendedProps.timestampCreacion;

            // Formatear el Timestamp para mostrarlo de forma legible
            let fechaCreacionTexto = "No registrada";
            if (timestamp) {
                const fechaCrea = new Date(timestamp);
                fechaCreacionTexto = fechaCrea.toLocaleString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                }) + " hs";
            }

            // Mensaje de información detallado
            const horarioFormateado = info.event.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            alert(`📌 Detalle de la Reserva:\n\n` +
                  `• Recurso: ${info.event.title}\n` +
                  `• Horario: ${horarioFormateado} hs\n` +
                  `• Reservado por: ${creadorReserva}\n` +
                  `• Registrado el: ${fechaCreacionTexto}`);

            // 1. CONTROL DE IDENTIDAD: ¿Es el dueño de la reserva?
            if (!usuarioActual || usuarioActual.email !== creadorReserva) {
                return; // Corta acá para que profesores ajenos solo puedan LEER la info sin borrarla
            }

            // 2. CONTROL DE TIEMPO: "Hasta un día antes"
            const hoy = new Date();
            hoy.setHours(0,0,0,0);

            const fechaReserva = new Date(info.event.start);
            fechaReserva.setHours(0,0,0,0);

            if (fechaReserva <= hoy) {
                alert("❌ Solo podés cancelar reservas hasta un día antes de la fecha pactada. Por favor, comunicate con el auxiliar.");
                return;
            }

            // 3. CONFIRMACIÓN Y ELIMINACIÓN REAL
            const confirmar = confirm(`¿Estás seguro de que querés cancelar tu reserva de "${info.event.title}"?`);
            if (confirmar) {
                try {
                    const idReserva = info.event.id;
                    const reservaRef = ref(db, `reservas/${idReserva}`);
                    
                    await remove(reservaRef);
                    
                    info.event.remove(); 
                    alert("✅ Reserva cancelada y eliminada con éxito.");
                } catch (error) {
                    console.error("Error al eliminar:", error);
                    alert("Ocurrió un error al intentar eliminar la reserva.");
                }
            }
        }


    });

    calendar.render();
}

// 6. EVENTOS DE INTERFAZ (MODAL Y LOGOUT)

btnCerrarModal.addEventListener('click', () => {
    modal.classList.add('hidden');
});

// BOTÓN PARA REGRESAR AL PANEL DE SELECCIÓN DE RECURSOS
btnVolver.addEventListener('click', () => {
    window.location.href = "equipos.html";
});

// REGISTRAR LA NUEVA RESERVA CON VALIDACIÓN DE DUPLICADOS
formReserva.addEventListener('submit', async (e) => {
  e.preventDefault();  
    const periodoSelect = document.getElementById('periodo');
    const [horaInicio, horaFin] = periodoSelect.value.split('-'); 
    const usuarioActual = auth.currentUser;
    const inicioIso = `${fechaSeleccionada}T${horaInicio}:00`;
    const finIso = `${fechaSeleccionada}T${horaFin}:00`;

    // =======================================================
    // NUEVA VALIDACIÓN: BLOQUEAR HORARIOS QUE YA PASARON HOY
    // =======================================================
    const ahora = new Date();
    const inicioReservaDateTime = new Date(inicioIso);

    if (inicioReservaDateTime < ahora) {
        alert("❌ No podés reservar un módulo horario que ya comenzó o que ya pasó.");
        return; // Frena la creación
    }

    try {
        const dbRef = ref(db);
        
  // ==========================================
        // PASO 1: OBTENER EL STOCK REAL DEL INVENTARIO (OPTIMIZADO)
        // ==========================================
        const catUrl = urlParams.get('cat');
        const idUrl = urlParams.get('id');
        
        let stockDisponible = 0;

        if (catUrl && idUrl) {
            // Apuntamos directo a: inventario / categoria / id_recurso
            const rutaEquipoRef = ref(db, `inventario/${catUrl}/${idUrl}`);
            const snapshotEquipo = await get(rutaEquipoRef);

            if (snapshotEquipo.exists()) {
                const item = snapshotEquipo.val();
                // Buscamos el campo de stock total que definiste en app-equipos (item.stock_total)
                stockDisponible = parseInt(item.stock_total) || 0;
            } else {
                alert("⚠️ Error: El equipo seleccionado no existe en el inventario.");
                return;
            }
        } else {
            alert("⚠️ Error: Parámetros de URL inválidos.");
            return;
        }

      

        // ==========================================
        // PASO 2: CONTAR LAS RESERVAS YA EXISTENTES
        // ==========================================
        const snapshotReservas = await get(child(dbRef, 'reservas'));
        let reservasEnEseHorario = 0;

        if (snapshotReservas.exists()) {
            snapshotReservas.forEach((childSnapshot) => {
                const res = childSnapshot.val();
                // Contamos cuántos ya lo reservaron el mismo día a la misma hora exacta
                if (res.equipo === equipoSeleccionado && res.start === inicioIso) {
                    reservasEnEseHorario++;
                }
            });
        }

        // ==========================================
        // PASO 3: COMPARAR STOCK VS RESERVAS
        // ==========================================
        if (reservasEnEseHorario >= stockDisponible) {
            alert(`❌ Todo el stock de "${equipoSeleccionado}" ya está ocupado en este horario (${reservasEnEseHorario}/${stockDisponible} reservados).`);
            return; // Bloquea la reserva
        }

// ==========================================
        // PASO 4: GUARDAR LA RESERVA SI PASÓ EL CONTROL
        // ==========================================
const nuevaReserva = {
            equipo: equipoSeleccionado,
            usuarioEmail: usuarioActual ? usuarioActual.email : "anonimo@colegio.edu",
            usuarioNombre: usuarioActual ? usuarioActual.displayName : "Profesor",
            title: `${equipoSeleccionado} (Unidad ${reservasEnEseHorario + 1}) - ${usuarioActual ? usuarioActual.displayName.split(' ')[0] : 'Prof'}`,
            start: inicioIso,
            end: finIso,
            color: '#10b981',
            // Agregamos el Timestamp del servidor de Firebase (o local con Date.now())
            timestampCreacion: Date.now() 
        };

        // Guardamos en la RTDB
        await push(ref(db, 'reservas'), nuevaReserva);
        
        modal.classList.add('hidden');
        calendar.refetchEvents(); // Redibuja el calendario al instante
        alert("¡Reserva confirmada con éxito!");

    } catch (error) {
        console.error("Error general en la validación por stock:", error);
        alert("Ocurrió un problema al verificar la disponibilidad de la base de datos.");
    }
});


btnLogout.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
});