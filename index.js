

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, // Cambiamos a Popup
    GoogleAuthProvider, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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

const btnLogin = document.getElementById('btn-login');
const contenedorError = document.getElementById('mensaje-error');

function mostrarError(mensaje) {
    contenedorError.textContent = mensaje;
    contenedorError.classList.remove('hidden');
}

// EVENTO DE INICIO DE SESIÓN
btnLogin.addEventListener('click', (e) => {
    e.preventDefault(); // Evita que la página intente recargarse sola al hacer clic
    
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    signInWithPopup(auth, provider)
        .then((result) => {
            const email = result.user.email;
            const esAdmin = email === "laggerro2@gmail.com";
            const esColegio = email.endsWith("@colegio.edu");

            if (esAdmin || esColegio) {
                // Forzamos el reemplazo de locación para romper hilos colgados
                window.location.replace("equipos.html"); 
            } else {
                alert("Acceso denegado.");
                signOut(auth);
            }
        })
        .catch((error) => {
            console.error("Error detallado:", error);
        });
});