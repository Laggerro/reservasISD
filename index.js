import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  child 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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
const db = getDatabase(app);

const btnLogin = document.getElementById('btn-login');
const contenedorError = document.getElementById('mensaje-error');

function mostrarError(mensaje) {
  contenedorError.textContent = mensaje;
  contenedorError.classList.remove('hidden');
}

btnLogin.addEventListener('click', async (e) => {
  e.preventDefault();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const email = user.email || "";

    const esAdminSuper = email === "laggerro2@gmail.com";
    const esColegio = email.endsWith("@institutosandiego.edu.ar");

    if (!esColegio && !esAdminSuper) {
      mostrarError("Acceso denegado. Debes utilizar una cuenta de @institutosandiego.edu.ar");
      await signOut(auth);
      return;
    }

    const emailLimpio = email.replace(/\./g, '_');
    const dbRef = ref(db);

    // Consultamos simultáneamente en administradores y usuarios_autorizados
    const [adminSnap, usuarioSnap] = await Promise.all([
      get(child(dbRef, `administradores/${emailLimpio}`)),
      get(child(dbRef, `usuarios_autorizados/${emailLimpio}`))
    ]);

    const estaAutorizado = adminSnap.exists() || usuarioSnap.exists() || esAdminSuper;

    if (estaAutorizado) {
      window.location.replace("equipos.html");
    } else {
      // Si tiene mail del colegio pero no está autorizado, se registra el intento
      await set(ref(db, `intentos_acceso/${emailLimpio}`), {
        email: email,
        nombre: user.displayName || email.split('@')[0],
        fecha: new Date().toISOString()
      });

      mostrarError("Acceso pendiente. Se registró tu solicitud para habilitar el ingreso.");
      await signOut(auth);
    }
  } catch (error) {
    console.error("Error durante el inicio de sesión:", error);
    mostrarError("Ocurrió un error al intentar iniciar sesión.");
  }
});