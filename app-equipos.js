import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// 1. Configuración de Firebase (Reemplazá con tus credenciales reales)
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_AUTH_DOMAIN",
    databaseURL: "TU_DATABASE_URL",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_STORAGE_BUCKET",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Referencias del DOM
const appBody = document.getElementById('app-body');
const nombreDocenteHtml = document.getElementById('nombre-docente');
const botonAjustes = document.getElementById('boton-ajustes');
const btnLogout = document.getElementById('btn-logout');
const tarjeteroRecursos = document.getElementById('tarjetero-recursos');

// Diccionario "Anti-Frustración" de fotos y descripciones basado en las categorías de tu JSON
const infoVisualPorCategoria = {
    "mapas": {
        foto: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=500&auto=format&fit=crop&q=60",
        descripcion: "Mapas físicos y políticos en soporte enrollable para colgar en el aula."
    },
    "proyectores": {
        foto: "https://images.unsplash.com/photo-1535016120720-40c646be5580?w=500&auto=format&fit=crop&q=60",
        descripcion: "Proyectores multimedia portátiles con cables listos para conectar a la notebook."
    },
    "default": {
        foto: "https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=500&auto=format&fit=crop&q=60",
        descripcion: "Material didáctico y equipamiento escolar para uso en clase."
    }
};

// 2. GUARDIÁN DE SESIÓN ESTRICTO
onAuthStateChanged(auth, (user) => {
    if (user) {
        const email = user.email;
        // Excepción explícita del administrador o dominios del colegio
        if (email === 'admin_ejemplo@gmail.com' || email.endsWith('@colegio.edu')) {
            
            // Mostrar nombre en barra de navegación
            nombreDocenteHtml.textContent = `Hola, ${user.displayName || 'Profesor'}`;
            
            // Mostrar botón de ajustes si es el administrador principal
            if (email === 'admin_ejemplo@gmail.com') {
                botonAjustes.classList.remove('hidden');
            }

            // Quitar invisible del body (evita el parpadeo visual)
            appBody.classList.remove('invisible');
            
            // Cargar los datos desde la rama 'inventario'
            escucharInventario();
        } else {
            // Si está logueado pero con una cuenta de Gmail común externa
            desconectarSesion();
        }
    } else {
        // Redirigir si no está logueado
        window.location.href = "login.html";
    }
});

// 3. LECTURA EN TIEMPO REAL DEL INVENTARIO (Estructura jerárquica)
function escucharInventario() {
    const inventarioRef = ref(db, 'inventario');

    onValue(inventarioRef, (snapshot) => {
        // Limpiamos el contenedor antes de inyectar
        tarjeteroRecursos.innerHTML = '';
        const categorias = snapshot.val();

        if (!categorias) {
            tarjeteroRecursos.innerHTML = `<p class="text-center text-gray-500 col-span-full py-8">No hay equipos registrados en el inventario.</p>`;
            return;
        }

        // Bucle 1: Recorrer las categorías ("mapas", "proyectores")
        Object.keys(categorias).forEach(idCategoria => {
            const recursosDeCategoria = categorias[idCategoria];

            // Bucle 2: Recorrer los recursos específicos dentro de esa categoría
            Object.keys(recursosDeCategoria).forEach(idRecurso => {
                const item = recursosDeCategoria[idRecurso];
                const stock = item.stock_total;
                const tieneStock = stock > 0;

                // Configuración de Colores y Estados Visuales "Anti-Frustración"
                // Si no hay stock, la ficha no desaparece: se tiñe de un marco rojo suave
                const colorBorde = tieneStock ? 'border-green-400' : 'border-red-400 bg-red-50';
                const badgeColor = tieneStock ? 'bg-green-100 text-green-800' : 'bg-red-200 text-red-900 font-bold';
                const badgeTexto = tieneStock ? `Disponibles: ${stock}` : 'AGOTADO HOY';
                const filtroImagen = tieneStock ? 'opacity-100' : 'opacity-40 grayscale';

                // Obtener foto estática y descripción amigable según la categoría
                const infoVisual = infoVisualPorCategoria[idCategoria] || infoVisualPorCategoria['default'];

                // Construcción dinámica de la Ficha Individual (Grande y legible para celulares)
                const fichaHTML = `
                    <div class="bg-white rounded-2xl shadow-md border-2 ${colorBorde} overflow-hidden flex flex-col justify-between transition-all transform active:scale-98">
                        <div>
                            <img src="${infoVisual.foto}" alt="${item.nombre}" class="w-full h-40 object-cover ${filtroImagen}">
                            
                            <div class="p-4">
                                <div class="flex justify-between items-start gap-2 mb-2">
                                    <h3 class="text-xl font-bold text-gray-800 leading-tight">${item.nombre}</h3>
                                    <span class="whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${badgeColor}">
                                        ${badgeTexto}
                                    </span>
                                </div>
                                <p class="text-sm text-gray-600">${infoVisual.descripcion}</p>
                            </div>
                        </div>

                        <div class="p-4 pt-0">
                            <button 
                                onclick="irAlCalendario('${idCategoria}', '${idRecurso}')"
                                ${!tieneStock ? 'disabled' : ''} 
                                class="w-full py-3 px-4 rounded-xl font-bold text-center transition-all text-base shadow-sm
                                ${tieneStock 
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white active:bg-blue-800' 
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'}"
                            >
                                ${tieneStock ? '📅 Reservar este recurso' : '❌ No disponible'}
                            </button>
                        </div>
                    </div>
                `;

                // Inyectar en la grilla visual de la página
                tarjeteroRecursos.insertAdjacentHTML('beforeend', fichaHTML);
            });
        });
    });
}

// 4. DIRECCIONAMIENTO AL PASO DEL CALENDARIO
window.irAlCalendario = function(categoria, recursoId) {
    // Redirige pasando los identificadores por la URL para que calendario.html sepa qué se quiere reservar
    window.location.href = `calendario.html?cat=${categoria}&id=${recursoId}`;
};

// 5. FUNCIÓN DE SALIDA
function desconectarSesion() {
    signOut(auth).then(() => {
        window.location.href = "login.html";
    }).catch((error) => {
        console.error("Error al salir: ", error);
    });
}

// Vincular botón de logout del NAV
btnLogout.addEventListener('click', desconectarSesion);

// Vincular botón de ajustes del NAV (si lo necesitás)
botonAjustes.addEventListener('click', () => {
    window.location.href = "ajustes.html"; 
});