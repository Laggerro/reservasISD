// Verificar si hay una sesión activa de Firebase local
firebase.auth().onAuthStateChanged((user) => {
    if (!user || !user.email.endsWith("@colegio.edu")) {
        // Si no está logueado o el correo cambió, lo saca al login
        window.location.href = "login.html";
    } else {
        console.log("Profesor autenticado:", user.displayName);
        // Aquí ejecutas la carga de tus tarjetas o el calendario
    }
});
        // Configuración de Firebase (Reemplazá con tus datos reales)
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
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const database = firebase.database();

// OBTENER LA PÁGINA ACTUAL
const paginaActual = window.location.pathname.split("/").pop();

// GUARDIÁN DE SESIÓN AUTOMÁTICO
auth.onAuthStateChanged((user) => {
    const esPaginaLogin = (paginaActual === "login.html" || paginaActual === "");

    if (user && user.email.endsWith("@colegio.edu")) {
        // Sesión válida: Si está en el login, lo mandamos a elegir equipos
        if (esPaginaLogin) {
            window.location.href = "equipos.html";
        } else {
            // Si está en otra página, mostramos su nombre en el menú
            const elementoNombre = document.getElementById("nombre-profesor");
            if (elementoNombre) elementoNombre.innerText = user.displayName;
            
            // Si es Admin, mostrar botón de ajustes si existe en el HTML
            const btnAdmin = document.getElementById("menu-admin");
            if (btnAdmin && user.email === "tu_correo_real@colegio.edu") {
                btnAdmin.classList.remove("hidden");
            }
        }
    } else {
        // Sin sesión o correo inválido: Si no está en login, lo expulsamos ahí
        if (!esPaginaLogin) {
            window.location.href = "login.html";
        }
    }
});

// FUNCIÓN DE LOGIN (Para usar en login.html)
function iniciarSesionConGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    auth.signInWithPopup(provider)
        .then((result) => {
            if (!result.user.email.endsWith("@colegio.edu")) {
                alert("Acceso denegado. Debes usar tu correo institucional (@colegio.edu).");
                auth.signOut();
            }
        })
        .catch(err => console.error("Error en Login:", err));
}

// FUNCIÓN DE LOGOUT (Para el botón Salir)
function cerrarSesion() {
    auth.signOut().then(() => {
        window.location.href = "login.html";
    });
}
