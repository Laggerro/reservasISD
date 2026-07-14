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




// 2. GUARDIÁN DE SESIÓN ESTRICTO DINÁMICO
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const email = user.email;
        
        // Verificamos si es tu cuenta administradora principal o del colegio
        if (email === 'laggerro2@gmail.com' || email.endsWith('@colegio.edu')) {
            nombreDocenteHtml.textContent = `Hola, ${user.displayName || 'Profesor'}`;
            appBody.classList.remove('invisible');
            
            // EXCEPCIÓN DIRECTA: Si sos vos, te muestra el botón de inmediato
            if (email === 'laggerro2@gmail.com') {
                botonAjustes.classList.remove('hidden');
            } else {
                // Si es un correo institucional (@colegio.edu), verificamos en la RTDB si es admin
                try {
                    const emailLimpio = email.replace(/\./g, '_');
                    const dbRef = ref(db);
                    const snapshotAdmin = await get(child(dbRef, `administradores/${emailLimpio}`));
                    
                    if (snapshotAdmin.exists()) {
                        botonAjustes.classList.remove('hidden');
                    }
                } catch (error) {
                    console.error("Error comprobando rol de administrador:", error);
                }
            }
            
            escucharInventario();
        } else {
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
                const badgeTexto = tieneStock ? `Disponibles: ${stock}` : 'AGOTADO HOY';
                const filtroImagen = tieneStock ? 'opacity-100' : 'opacity-40 grayscale';
                
                // --- CAMBIO CLAVE: LEER DIRECTO DE FIREBASE O COLOCAR UN MOCK UP POR SI ESTÁ VACÍO ---
                const rutaImagen = item.imagen || "img/default-recurso.jpg"; 
                const textoDescripcion = item.descripcion || "Sin descripción disponible momentáneamente.";

                // Construcción dinámica de la Ficha Individual con tus datos reales
                const fichaHTML = `
                <div class="bg-white rounded-2xl shadow-md border-2 ${colorBorde} overflow-hidden flex flex-col justify-between transition-all transform active:scale-98">
                    <div>
                        <!-- La imagen ahora apunta a la ruta dinámica del servidor o Firebase -->
                        <img src="${rutaImagen}" alt="${item.nombre}" class="w-full h-40 object-cover ${filtroImagen}">
                        
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
                            ${tieneStock ? 'Reservar este recurso' : 'No disponible'}
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