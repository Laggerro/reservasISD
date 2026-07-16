import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, onValue, get, child } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// 1. Configuración de Firebase (Reemplazá con tus credenciales reales)
const firebaseConfig = {
    apiKey: "AIzaSyBOgShBOu05UszCBLS-bpTl2f3AI7_I-pY",
    authDomain: "reservasisd.firebaseapp.com",
    databaseURL: "https://reservasisd-default-rtdb.firebaseio.com",
    projectId: "reservasisd",
    storageBucket: "reservasisd.firebasestorage.app",
    messagingSenderId: "637702189208",
    appId: "1:637702189208:web:49ff477b35e299564ca0ed"
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
const botonCalendario = document.getElementById('boton-calendario'); 



// 2. GUARDIÁN DE SESIÓN CON LISTA BLANCA ESTRICTA

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const email = user.email;

        // 1. EXCEPCIÓN DIRECTA: Tu mail personal siempre entra de una (llave maestra)
        if (email === 'laggerro2@gmail.com') {
            nombreDocenteHtml.textContent = `👋 Hola, ${user.displayName || 'Administrador'}`;
            
            // Mostramos ambos botones de administración
            if (botonAjustes) botonAjustes.classList.remove('hidden'); 
            if (botonCalendario) botonCalendario.classList.remove('hidden'); // <-- NUEVO
            
            appBody.classList.remove('invisible');
            escucharInventario();
            return;
        }

        // 2. Para todos los demás (profesores y auxiliares), verificamos en la lista de AUTORIZADOS
        try {
            const emailLimpio = email.trim().toLowerCase().replace(/\./g, '_');
            console.log("🔍 Intentando ingresar con el nodo:", emailLimpio);
            const dbRef = ref(db);

            // Buscamos si existe en el nodo "usuarios_autorizados"
            const snapshotAutorizado = await get(child(dbRef, `usuarios_autorizados/${emailLimpio}`));

            if (snapshotAutorizado.exists()) {
                // Sí está autorizado. Ahora verificamos si además es ADMINISTRADOR
                nombreDocenteHtml.textContent = `👋 Hola, ${user.displayName || 'Profesor'}`;
                appBody.classList.remove('invisible');

                const snapshotAdmin = await get(child(dbRef, `administradores/${emailLimpio}`));
                if (snapshotAdmin.exists()) {
                    // Es admin (ej: auxiliar), le mostramos Ajustes y Calendario
                    if (botonAjustes) botonAjustes.classList.remove('hidden');
                    if (botonCalendario) botonCalendario.classList.remove('hidden'); // <-- NUEVO
                } else {
                    // Es docente común, NO ve Ajustes ni Calendario
                    if (botonAjustes) botonAjustes.classList.add('hidden');
                    if (botonCalendario) botonCalendario.classList.add('hidden'); // <-- NUEVO
                }

                escucharInventario();
            } else {
                // NO está autorizado (alumno o mail no registrado)
                alert("Acceso denegado. Tu cuenta no está autorizada para ingresar al sistema. Por favor, solicita acceso al Administrador.");
                desconectarSesion();
            }
        } catch (error) {
            console.error("Error comprobando permisos:", error);
            desconectarSesion();
        }
    } else {
        window.location.href = "index.html";
    }
});


// 3. LECTURA EN TIEMPO REAL DEL INVENTARIO (Estructura jerárquica)
function escucharInventario() {
    const inventarioRef = ref(db, 'inventario');

    onValue(inventarioRef, (snapshot) => {
        tarjeteroRecursos.innerHTML = ''; // Limpiamos el contenedor
        const categorias = snapshot.val();

        if (!categorias) {
            tarjeteroRecursos.innerHTML = `<p class="text-center text-gray-500 col-span-full py-8">No hay equipos registrados en el inventario.</p>`;
            return;
        }

        // Recorrer las categorías ("mapas", "proyectores")
        Object.keys(categorias).forEach(idCategoria => {
            const recursosDeCategoria = categorias[idCategoria];

            // Recorrer los recursos específicos dentro de esa categoría
            Object.keys(recursosDeCategoria).forEach(idRecurso => {
                const item = recursosDeCategoria[idRecurso];
                const stock = item.stock_total;
                const tieneStock = stock > 0;

                // Configuración de Estados Visuales
                const colorBorde = tieneStock ? 'border-green-400' : 'border-red-400 bg-red-50';
                const badgeColor = tieneStock ? 'bg-green-100 text-green-800' : 'bg-red-200 text-red-900 font-bold';
                
                // CAMBIO: Ahora dice "PAUSADO" en lugar de "AGOTADO HOY"
                const badgeTexto = tieneStock ? `Cantidad: ${stock}` : 'PAUSADO'; 
                const filtroImagen = tieneStock ? 'opacity-100' : 'opacity-30 grayscale';

                // --- CAMBIO CLAVE: LEER DIRECTO DE FIREBASE O COLOCAR UN MOCK UP POR SI ESTÁ VACÍO ---
                const rutaImagen = item.imagen || "https://i.ibb.co/5z0RJbk/default-recurso.png";
                const textoDescripcion = item.descripcion || "Sin descripción disponible momentáneamente.";

                // Construcción dinámica de la Ficha Individual con tus datos reales
                const fichaHTML = `
                <div class="bg-white rounded-2xl shadow-md border-2 ${colorBorde} overflow-hidden flex flex-col justify-between transition-all transform active:scale-98">
                    <div>
                        <!-- CAMBIO: Contenedor con clase "relative" para sostener la leyenda roja encima -->
                        <div class="relative w-full h-48 bg-gray-50 border-b flex items-center justify-center p-2 overflow-hidden">
                            <img src="${rutaImagen}" alt="${item.nombre}" class="max-w-full max-h-full object-contain ${filtroImagen}">
                            
                            <!-- NUEVO: Leyenda roja que se superpone solo si stock es 0 (Pausado/En reparación) -->
                            ${!tieneStock ? `
                            <div class="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex flex-col items-center justify-center p-4 text-center">
                                <span class="bg-red-600 text-white text-xs font-black uppercase px-3 py-1.5 rounded-lg tracking-wider shadow-md flex items-center gap-1.5 animate-pulse">
                                    🚫 No disponible - Consultar
                                </span>
                            </div>
                            ` : ''}
                        </div>
                        
                        <div class="p-4">
                            <div class="flex justify-between items-start gap-2 mb-2">
                                <h3 class="text-xl font-bold text-gray-800 leading-tight">${item.nombre}</h3>
                                <span class="whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${badgeColor}">
                                    ${badgeTexto}
                                </span>
                            </div>
                            <!-- La descripción ahora es dinámica -->
                            <p class="text-sm text-gray-600">${textoDescripcion}</p>
                        </div>
                    </div>
                    
                    <div class="p-4 pt-0">
                        <button
                            onclick="irAlCalendario('${idCategoria}', '${idRecurso}', '${item.nombre}')"
                            ${!tieneStock ? 'disabled' : ''}
                            class="w-full py-3 px-4 rounded-xl font-bold text-center transition-all text-base shadow-sm
                            ${tieneStock
                                ? 'bg-blue-600 hover:bg-blue-700 text-white active:bg-blue-800'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'}"
                        >
                            ${tieneStock ? 'Reservar este recurso' : 'En uso o en Reparación'}
                        </button>
                    </div>
                </div>
                `;

                // Inyectar en la grilla visual
                tarjeteroRecursos.insertAdjacentHTML('beforeend', fichaHTML);
            });
        });
    });
}


// 4. DIRECCIONAMIENTO AL PASO DEL CALENDARIO
window.irAlCalendario = function (categoria, recursoId, nombreReal) {
    // Le pasamos la categoría, el ID y el nombre limpio por URL
    window.location.href = `calendario.html?cat=${categoria}&id=${recursoId}&equipo=${encodeURIComponent(nombreReal)}`;
};
// 5. FUNCIÓN DE SALIDA
function desconectarSesion() {
    signOut(auth).then(() => {
        window.location.href = "index.html";
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