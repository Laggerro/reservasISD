
        // Configuración de Firebase (Completar con tus datos reales)
       
             const firebaseConfig = {
  apiKey: "AIzaSyBOgShBOu05UszCBLS-bpTl2f3AI7_I-pY",
  authDomain: "reservasisd.firebaseapp.com",
  databaseURL: "https://reservasisd-default-rtdb.firebaseio.com",
  projectId: "reservasisd",
  storageBucket: "reservasisd.firebasestorage.app",
  messagingSenderId: "637702189208",
  appId: "1:637702189208:web:49ff477b35e299564ca0ed"
};

 firebase.initializeApp(firebaseConfig);

        // Persistencia Local de la sesión
        firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

        // Si ya hay sesión activa, salta directo a la pantalla de selección de equipos
        firebase.auth().onAuthStateChanged((usuario) => {
            if (usuario && usuario.email.endsWith("@colegio.edu")) {
                window.location.href = "equipos.html";
            }
        });

        function identificarConGoogle() {
            const proveedor = new firebase.auth.GoogleAuthProvider();
            proveedor.setCustomParameters({ prompt: 'select_account' });

            firebase.auth().signInWithPopup(proveedor)
            .then((resultado) => {
                if (resultado.user.email.endsWith("@colegio.edu")) {
                    window.location.href = "equipos.html";
                } else {
                    alert("Acceso denegado. Solo se permiten correos @colegio.edu");
                    firebase.auth().signOut();
                }
            })
            .catch(error => alert("Error en autenticación: " + error.message));
        }