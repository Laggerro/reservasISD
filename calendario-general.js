import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, onValue, get, child } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBOgShBOu05UszCBLS-bpTl2f3AI7_I-pY",
    authDomain: "reservasisd.firebaseapp.com",
    databaseURL: "https://reservasisd-default-rtdb.firebaseio.com",
    projectId: "reservasisd",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ELEMENTOS DEL DOM
const listaEquiposFiltro = document.getElementById('lista-equipos-filtro');
const btnVerTodos = document.getElementById('btn-ver-todos');
const panelAuditoria = document.getElementById('panel-auditoria');
const auditoriaProfesor = document.getElementById('auditoria-profesor');
const auditoriaFecha = document.getElementById('auditoria-fecha');
const btnVolver = document.getElementById('btn-volver');

// ELEMENTOS DEL DOM PARA EL MODAL
const modalDetalle = document.getElementById('modal-detalle');
const modalContenido = document.getElementById('modal-contenido');
const modalHeader = document.getElementById('modal-header');
const modalRecurso = document.getElementById('modal-recurso');
const modalDocente = document.getElementById('modal-docente');
const modalDocenteEmail = document.getElementById('modal-docente-email');
const modalHoraInicio = document.getElementById('modal-hora-inicio');
const modalHoraFin = document.getElementById('modal-hora-fin');
const modalFechaRegistro = document.getElementById('modal-fecha-registro');
const btnCerrarModal = document.getElementById('btn-cerrar-modal');
const btnEntendido = document.getElementById('btn-entendido');



// VARIABLES DE ESTADO
let calendar;
let todasLasReservas = []; 
let todosLosEquipos = [];    
let equipoSeleccionadoId = null;

const coloresCategorias = {
    proyectores: '#3b82f6', 
    mapas: '#10b981',       
    audio: '#f59e0b',       
    netbooks: '#8b5cf6',    
    default: '#6b7280'      
};

// ======================================================
// 🛡️ GUARDIÁN DE SEGURIDAD (Solo administradores)
// ======================================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    
    const email = user.email;
    
    // Excepción directa: Si sos vos, entrás de una
    if (email === "laggerro2@gmail.com") {
        inicializarPaginaCalendario();
        return;
    }
    
    // Para cualquier otro correo, verificamos en la RTDB si es Admin
    try {
        const emailLimpio = email.replace(/\./g, '_');
        const dbRef = ref(db);
        const snapshotAdmin = await get(child(dbRef, `administradores/${emailLimpio}`));
        
        if (snapshotAdmin.exists()) {
            inicializarPaginaCalendario();
        } else {
            alert("Acceso denegado. Esta sección es solo para administradores.");
            window.location.href = "equipos.html";
        }
    } catch (error) {
        console.error("Error al verificar permisos de administrador:", error);
        window.location.href = "equipos.html";
    }
});

// Función que arranca todo una vez que sabemos que es Admin
function inicializarPaginaCalendario() {
    // Inicializar el Calendario (FullCalendar v6)
    document.getElementById('contenedor-admin').classList.remove('hidden');
    const calendarEl = document.getElementById('calendario');
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek'
        },
        buttonText: {
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            list: 'Agenda'
        },
        editable: false,
        selectable: false,
        eventDisplay: 'block',
        height: 'auto',
        events: [],

        eventClick: function(info) {
            abrirModalDetalle(info.event);
        }
    });

    calendar.render();
    
    // Cargar datos de la base de datos
    escucharInventarioYReservas();
}

// 2. LEER DATOS DESDE FIREBASE RTDB (Sigue igual que antes...)
// ... [Mantené el resto del código que te pasé antes para escucharInventarioYReservas, filtros y eventos] ...


// 1. INICIALIZAR EL CALENDARIO (FullCalendar v6)
document.addEventListener('DOMContentLoaded', () => {
    const calendarEl = document.getElementById('calendario');
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es', // Idioma español
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek' // Vistas: Mes, Semana y Agenda semanal
        },
        buttonText: {
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            list: 'Agenda'
        },
        editable: false,
        selectable: false,
        eventDisplay: 'block',
        height: 'auto',
        events: [] // Se cargan de manera dinámica
    });

    calendar.render();
    
    // Cargar datos una vez renderizado el calendario
    escucharInventarioYReservas();
});

// 2. LEER DATOS DESDE FIREBASE RTDB
// ... (Toda la primera parte de tu calendario-general.js con el guardián de seguridad queda igual) ...

// 2. LEER DATOS DESDE FIREBASE RTDB ADAPTADO A TU JSON
function escucharInventarioYReservas() {
    // A) Traer Inventario para armar el panel izquierdo
    const inventarioRef = ref(db, 'inventario');
    onValue(inventarioRef, (snapshot) => {
        const categorias = snapshot.val();
        todosLosEquipos = [];
        listaEquiposFiltro.innerHTML = '';

        if (!categorias) {
            listaEquiposFiltro.innerHTML = '<p class="text-center text-gray-400 py-4 text-xs">Sin equipos en inventario.</p>';
            return;
        }

        // Recorremos categorías (ej: "tecnologia") y equipos (ej: "impresora_3d", "notebook")
        Object.keys(categorias).forEach(idCategoria => {
            const recursos = categorias[idCategoria];
            Object.keys(recursos).forEach(idRecurso => {
                const item = recursos[idRecurso];
                todosLosEquipos.push({
                    id: idRecurso,
                    categoria: idCategoria,
                    ...item
                });

                // Renderizar botón de filtro para este equipo usando tus campos reales
                const itemHTML = `
                <button data-id="${idRecurso}" data-nombre="${item.nombre}" class="btn-filtro-equipo w-full p-2 bg-gray-50 hover:bg-gray-100 border rounded-xl flex items-center gap-2.5 transition text-left">
                    <img src="${item.imagen || 'https://i.ibb.co/JFjNWhjV/impresora3d.webp'}" class="w-8 h-8 object-cover rounded border">
                    <div class="overflow-hidden">
                        <p class="font-bold text-gray-700 text-xs truncate">${item.nombre}</p>
                        <p class="text-[10px] text-gray-400 uppercase font-semibold">${idCategoria}</p>
                    </div>
                </button>
                `;
                listaEquiposFiltro.insertAdjacentHTML('beforeend', itemHTML);
            });
        });

        // Añadir listeners a los botones de filtro de equipos creados
        document.querySelectorAll('.btn-filtro-equipo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const btnClickeado = e.currentTarget;
                const idRecurso = btnClickeado.getAttribute('data-id');
                const nombreRecurso = btnClickeado.getAttribute('data-nombre');
                
                // Resaltar visualmente el botón seleccionado
                document.querySelectorAll('.btn-filtro-equipo').forEach(b => b.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50'));
                btnVerTodos.classList.remove('bg-blue-100', 'ring-2', 'ring-blue-500');
                btnClickeado.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');

                // Filtramos usando el nombre del equipo, ya que en tu JSON de reservas 
                // identificás el recurso por su nombre (ej: "Kit de Robótica Lego EV3")
                filtrarReservasPorEquipo(idRecurso, nombreRecurso);
            });
        });
    });

    // B) Traer las reservas usando tus nombres de campos reales
    const reservasRef = ref(db, 'reservas');
    onValue(reservasRef, (snapshot) => {
        const datosReservas = snapshot.val();
        todasLasReservas = [];

        if (datosReservas) {
            Object.keys(datosReservas).forEach(idReserva => {
                const res = datosReservas[idReserva];
                
                todasLasReservas.push({
                    id: idReserva,
                    equipoNombre: res.equipo,      // Guardamos el nombre del equipo para filtrar
                    title: res.title,              // Usamos tu título formateado de reserva
                    start: res.start,              // Tu fecha/hora de inicio
                    end: res.end,                  // Tu fecha/hora de fin
                    backgroundColor: res.color || '#3b82f6', // Usamos el color de tu reserva
                    borderColor: res.color || '#3b82f6',
                    extendedProps: {
                        usuarioNombre: res.usuarioNombre,       // Tu campo para el nombre del docente
                        usuarioEmail: res.usuarioEmail,
                        timestampCreacion: res.timestampCreacion || 0 // Tu timestamp real
                    }
                });
            });
        }

        // Por defecto mostramos todas al iniciar
        mostrarTodasLasReservas();
    });
}

// 3. LOGICA DE FILTRADO EN EL CALENDARIO
function mostrarTodasLasReservas() {
    equipoSeleccionadoId = null;
    panelAuditoria.classList.add('hidden'); // Ocultar auditoría al ver todo
    
    if (calendar) {
        calendar.removeAllEvents();
        calendar.addEventSource(todasLasReservas);
    }
}



// 4. AUDITORÍA ADAPTADA A TU ESTRUCTURA
function auditarUltimaReserva(reservasDelEquipo) {
    if (reservasDelEquipo.length === 0) {
        auditoriaProfesor.innerText = "Sin reservas registradas";
        auditoriaFecha.innerText = "El equipo no tiene historial de uso.";
        panelAuditoria.classList.remove('hidden');
        return;
    }

    // Ordenamos por tu timestamp de creación ("timestampCreacion") descendente para tener la más nueva primero
    reservasDelEquipo.sort((a, b) => {
        const timeA = a.extendedProps.timestampCreacion;
        const timeB = b.extendedProps.timestampCreacion;
        return timeB - timeA;
    });

    const ultima = reservasDelEquipo[0];

    // Formatear la fecha de inicio de forma legible
    const fechaLegible = new Date(ultima.start).toLocaleDateString('es-AR', {
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Muestra: "Roberto Lagger" y la fecha de la reserva
    auditoriaProfesor.innerText = ultima.extendedProps.usuarioNombre || "Docente Desconocido";
    auditoriaFecha.innerText = `Reservado para el ${fechaLegible}`;
    panelAuditoria.classList.remove('hidden');
}
function filtrarReservasPorEquipo(idRecurso, nombreRecurso) {
    equipoSeleccionadoId = idRecurso;
    
    // Filtramos las reservas buscando coincidencias con el nombre del equipo (ej: "Notebook", "Impresora 3D")
    // Usamos 'includes' o una comparación limpia para que coincida aunque tenga agregada la unidad (ej: "Kit de Robótica Lego EV3 (Unidad 1)")
    const reservasFiltradas = todasLasReservas.filter(res => {
        if (!res.equipoNombre) return false;
        return res.equipoNombre.toLowerCase().includes(nombreRecurso.toLowerCase()) || 
               nombreRecurso.toLowerCase().includes(res.equipoNombre.toLowerCase());
    });
    
    if (calendar) {
        calendar.removeAllEvents();
        calendar.addEventSource(reservasFiltradas);
    }

    // Calcular la última persona que lo reservó
    auditarUltimaReserva(reservasFiltradas);
}
// 4. AUDITORÍA: SABER QUIÉN FUE EL ÚLTIMO EN RESERVAR ESTE EQUIPO

// 5. EVENTOS ADICIONALES
btnVerTodos.addEventListener('click', () => {
    document.querySelectorAll('.btn-filtro-equipo').forEach(b => b.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50'));
    btnVerTodos.classList.add('bg-blue-100', 'ring-2', 'ring-blue-500');
    mostrarTodasLasReservas();
});

btnVolver.addEventListener('click', () => {
    window.location.href = "equipos.html";
});

// 3. FUNCIONES PARA EL MODAL DE DETALLE
function abrirModalDetalle(event) {
    // Obtener los datos almacenados en el evento
    const props = event.extendedProps;
    
    // Cambiar dinámicamente el color de la cabecera según el color del evento
    modalHeader.style.backgroundColor = event.backgroundColor || '#3b82f6';
    
    // Rellenar la información en el modal
    modalRecurso.innerText = event.title.split(' - ')[0] || "Equipo Desconocido"; // Saca la parte del equipo
    modalDocente.innerText = props.usuarioNombre || "Docente Desconocido";
    modalDocenteEmail.innerText = props.usuarioEmail || "-";
    
    // Formatear las fechas/horas legibles
    const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const opcionesHora = { hour: '2-digit', minute: '2-digit' };
    
    const fechaInicio = new Date(event.start);
    const fechaFin = new Date(event.end);

    modalHoraInicio.innerHTML = `
        <span class="block text-gray-800 font-bold">${fechaInicio.toLocaleDateString('es-AR', opcionesFecha)}</span>
        <span class="block text-xs text-gray-500 mt-0.5">${fechaInicio.toLocaleTimeString('es-AR', opcionesHora)} hs</span>
    `;

    modalHoraFin.innerHTML = `
        <span class="block text-gray-800 font-bold">${fechaFin.toLocaleDateString('es-AR', opcionesFecha)}</span>
        <span class="block text-xs text-gray-500 mt-0.5">${fechaFin.toLocaleTimeString('es-AR', opcionesHora)} hs</span>
    `;

    // Fecha de creación del registro
    if (props.timestampCreacion) {
        const fechaCreacion = new Date(props.timestampCreacion).toLocaleString('es-AR');
        modalFechaRegistro.innerText = `Creado el: ${fechaCreacion}`;
    } else {
        modalFechaRegistro.innerText = "";
    }

    // Mostrar el modal con animación suave
    modalDetalle.classList.remove('hidden');
    setTimeout(() => {
        modalDetalle.classList.remove('opacity-0');
        modalContenido.classList.remove('scale-95');
    }, 10);
}

function cerrarModalDetalle() {
    // Animación de salida
    modalDetalle.classList.add('opacity-0');
    modalContenido.classList.add('scale-95');
    
    // Ocultar una vez termina la animación (300ms)
    setTimeout(() => {
        modalDetalle.classList.add('hidden');
    }, 300);
}

// LISTENERS PARA CERRAR EL MODAL
btnCerrarModal.addEventListener('click', cerrarModalDetalle);
btnEntendido.addEventListener('click', cerrarModalDetalle);

// Cerrar también si hacen clic fuera de la tarjetita blanca (en el fondo oscuro)
modalDetalle.addEventListener('click', (e) => {
    if (e.target === modalDetalle) {
        cerrarModalDetalle();
    }
});