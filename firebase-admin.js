import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBG8ZiYOdVdI45AsKnMcbX6QaVlkU4dXhM",
  authDomain: "etrog-d0bcb.firebaseapp.com",
  projectId: "etrog-d0bcb",
  storageBucket: "etrog-d0bcb.firebasestorage.app",
  messagingSenderId: "215951557108",
  appId: "1:215951557108:web:8531faf1b1e512822d79a1"
};

const db = getFirestore(initializeApp(firebaseConfig));
const ordersCollection = collection(db, "orders");

window.orders = [];

onSnapshot(ordersCollection, snapshot => {
  window.orders = snapshot.docs
    .map(orderDoc => ({ _docId: orderDoc.id, ...orderDoc.data() }))
    .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
  window.render?.();
}, error => {
  console.error("שגיאה בטעינת ההזמנות:", error);
  const tableBody = document.getElementById("ordersBody");
  if (tableBody) tableBody.innerHTML = '<tr><td class="empty" colspan="11">שגיאה בטעינת הנתונים.</td></tr>';
});

window.dbCreateOrder = payload => addDoc(ordersCollection, payload);
window.dbUpdateOrder = (id, payload) => updateDoc(doc(db, "orders", id), payload);
window.dbDeleteOrder = id => deleteDoc(doc(db, "orders", id));

window.dbDeleteAllOrders = async ids => {
  for (let start = 0; start < ids.length; start += 400) {
    const batch = writeBatch(db);
    ids.slice(start, start + 400).forEach(id => batch.delete(doc(db, "orders", id)));
    await batch.commit();
  }
};

window.setPaid = (id, paid) => updateDoc(doc(db, "orders", id), {
  paid,
  paymentStatus: paid ? "paid" : "waiting_for_payment",
  orderStatus: paid ? "completed" : "waiting_for_payment",
  paidUpdatedAt: new Date().toISOString()
});
