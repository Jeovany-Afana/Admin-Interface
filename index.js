import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js"; // Pour initialiser l'application Firebase
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    doc, // Importation ajoutée
    getDoc, // Importation ajoutée
    serverTimestamp, // Importation ajoutée
  } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
  
  import {
    getAuth,
    onAuthStateChanged,
  } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
  
  // Configuration de votre application Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDibbuBJ2p88T26P0BAB-o_exunK0GYFdA", // Clé API de votre projet
    authDomain: "inspecteur-de-classes.firebaseapp.com", // Domaine d'authentification
    projectId: "inspecteur-de-classes", // ID de votre projet
    storageBucket: "inspecteur-de-classes.appspot.com", // Bucket de stockage pour les fichiers
    messagingSenderId: "572661846292", // ID de l'expéditeur de messages
    appId: "1:572661846292:web:aeb0374db2d414fef9f201", // ID de votre application
    measurementId: "G-NVN5GERDV6" // ID de mesure pour les analyses
  };


  // Initialisation de Firestore et Auth
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);


  //Éléments HTML
  const video = document.getElementById("preview");
  const canvasElement = document.createElement("canvas");
  const canvas = canvasElement.getContext("2d");
  const startScanButton = document.getElementById("startScanButton");
  const videoOverlay = document.getElementById("videoOverlay");
  const closeButton = document.getElementById("closeButton");
  const qrCodeContentDiv = document.getElementById("qrCodeContent");
 

  async function startCamera() {
    try {
      // Liste tous les périphériques multimédia
      const devices = await navigator.mediaDevices.enumerateDevices();
  
      // Filtrer pour obtenir les caméras vidéo
      const videoDevices = devices.filter((device) => device.kind === "videoinput");
  
      // Trouver la caméra arrière
      const backCamera = videoDevices.find((device) =>
        device.label.toLowerCase().includes("back")
      );
  
      // Préparer les contraintes
      const constraints = backCamera
        ? { video: { deviceId: backCamera.deviceId } } // Utiliser le deviceId si trouvé
        : { video: { facingMode: "environment" } };   // Sinon utiliser le facingMode
  
      // Démarrer le flux vidéo
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
  
      video.srcObject = stream;
      video.setAttribute("playsinline", true); // Nécessaire pour iOS
      video.style.display = "block";
      videoOverlay.style.display = "flex";
      video.play();
  
      requestAnimationFrame(scanQRCode); // Lancer le scan QR
    } catch (error) {
      console.error("Erreur d'accès à la caméra :", error);
    }
  }


  // Fonction pour scanner le QR code dans le flux vidéo
  async function scanQRCode() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      // Configure la taille du canvas en fonction de la vidéo
      canvasElement.height = video.videoHeight;
      canvasElement.width = video.videoWidth;
      canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
  
      // Récupère les données de l'image capturée dans le canvas
      const imageData = canvas.getImageData(
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );
  
      // Analyse l'image pour détecter un QR Code
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert", // Essais d'inversion désactivés pour optimiser
      });
  
      // Si un QR Code est détecté
      if (code) {
        const qrContent = code.data.trim(); // Supprime les espaces inutiles du contenu du QR Code
        console.log(`QR Code détecté : ${qrContent}`);
  
        // Vérifie que le contenu du QR Code n'est pas vide
        if (!qrContent) {
          alert("Le QR code scanné est vide !");
          return;
        }
  
        try {
          // Récupère la date et l'heure actuelles
          const maintenant = new Date();
          const aujourdHui = maintenant.toISOString().split("T")[0]; // Formate la date au format "YYYY-MM-DD"
  
          // Étape 1 : Vérifie si l'utilisateur existe dans la collection "users"
          const usersCollection = collection(db, "users");
          const userQuery = query(usersCollection, where("uid", "==", qrContent)); // Requête pour trouver l'utilisateur
          const userSnapshot = await getDocs(userQuery); // Exécute la requête
  
          // Si aucun utilisateur n'est trouvé
          if (userSnapshot.empty) {
            alert("Aucun étudiant trouvé avec ce QR code !");
            return;
          }
  
          // Récupère les données du premier document trouvé
          const userDoc = userSnapshot.docs[0].data();
          console.log("Étudiant trouvé :", userDoc);
  
          // Étape 2 : Vérifie si l'étudiant a rejoint un club
          if (userDoc.appartientClub !== true) {
            alert("Cet étudiant n'a pas encore rejoint de club.");
            console.log("L'étudiant n'a pas rejoint de club.");
            return;
          }
  
          // Étape 3 : Vérifie si l'étudiant a déjà été scanné aujourd'hui
          const scansCollection = collection(db, "scans");
          const checkQuery = query(
            scansCollection,
            where("uid", "==", qrContent), // Filtre par UID de l'étudiant
            where("date", "==", aujourdHui) // Filtre par date actuelle
          );
  
          const scanSnapshot = await getDocs(checkQuery); // Exécute la requête
  
          // Si un scan existe déjà pour cet étudiant aujourd'hui
          if (!scanSnapshot.empty) {
            alert("Cet étudiant a déjà été scanné aujourd'hui.");
            console.log("Étudiant déjà scanné.");
            return; // Sortie anticipée
          }
  
          // Étape 4 : Ajoute un nouveau scan dans la collection "scans"
          await addDoc(scansCollection, {
            uid: userDoc.uid,
            pseudoOk: userDoc.pseudoOk || "Inconnu", // Définit des valeurs par défaut si certaines données manquent
            kairos: userDoc.kairos || "Non défini",
            classe: userDoc.classe || "Non spécifié",
            dureeSolvabilite: userDoc.dureeSolvabilite || 0,
            derogationDate: userDoc.derogationDate || null,
            derogation: userDoc.derogation || false,
            a_jour: userDoc.a_jour || false,
            date: new Date().toISOString().split("T")[0], // Date simplifiée (sans heure)
            timestamp: serverTimestamp(), // Horodatage du serveur Firestore
          });
  
          // Confirme que le scan a été effectué avec succès
          alert("Scan effectué avec succès !");
        } catch (error) {
          // Gère les erreurs qui peuvent survenir (connexion à Firestore, logique, etc.)
          alert("Erreur lors du traitement du QR code.");
          console.error("Erreur lors du scan :", error);
        }
      }
    }
  
    // Continue à scanner tant que la vidéo est active
    requestAnimationFrame(scanQRCode);
  }
  






   
  // Événement pour démarrer le scan lorsque le bouton est cliqué
  startScanButton.addEventListener("click", () => {
    startCamera(); // Démarre la caméra
    startScanButton.style.display = "none"; // Cache le bouton
  });
  
  // Événement pour fermer l'overlay et arrêter la vidéo
  closeButton.addEventListener("click", () => {
    const stream = video.srcObject;
    const tracks = stream.getTracks();
    tracks.forEach((track) => track.stop());
    videoOverlay.style.display = "none";
    startScanButton.style.display = "block";
    qrCodeContentDiv.style.display = "none";
    video.style.display = "block";
  });




