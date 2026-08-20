import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBOgShBOu05UszCBLS-bpTl2f3AI7_I-pY",
    authDomain: "reservasisd.firebaseapp.com",
    databaseURL: "https://reservasisd-default-rtdb.firebaseio.com",
    projectId: "reservasisd",
    storageBucket: "reservasisd.firebasestorage.app",
    messagingSenderId: "637702189208",
    appId: "1:637702189208:web:49ff477b35e299564ca0ed"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app); // Inicialización de la BD

const btnLogin = document.getElementById('btn-login');
const contenedorError = document.getElementById('mensaje-error');

function mostrarError(mensaje) {
    contenedorError.textContent = mensaje;
    contenedorError.classList.remove('hidden');
}

// EVENTO DE INICIO DE SESIÓN
btnLogin.addEventListener('click', (e) => {
    e.preventDefault();

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    signInWithPopup(auth, provider)
        .then(async (result) => { // Agregamos 'async' para poder usar await adentro
            const user = result.user;
            const email = user.email;
            const esAdmin = email === "laggerro2@gmail.com";
            const esColegio = email.endsWith("@institutosandiego.edu.ar");

            if (esAdmin || esColegio) {
                window.location.replace("equipos.html");
            } else {
                // Registro del intento en Firebase RTDB
                try {
                    const emailLimpio = email.replace(/\./g, '_');
                    const intentoRef = ref(db, `intentos_acceso/${emailLimpio}`);

                    await set(intentoRef, {
                        email: email,
                        nombre: user.displayName || email.split('@')[0],
                        fecha: new Date().toISOString()
                    });
                } catch (err) {
                    console.error("Error al registrar el intento:", err);
                }

                mostrarError("Acceso denegado. No tenés permisos autorizados para ingresar.");
                alert("Acceso denegado.");
                await signOut(auth);
            }
        })
        .catch((error) => {
            console.error("Error detallado:", error);
        });
});