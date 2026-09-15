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

function enhanceDeliveryAddresses() {
  const rows = document.querySelectorAll("#ordersBody tr");
  rows.forEach(row => {
    if (row.dataset.addressEnhanced === "1") return;
    const cells = row.querySelectorAll("td");
    if (cells.length < 7) return;

    const orderId = cells[0].querySelector(".receipt-order-id")?.textContent?.trim();
    const order = (window.orders || []).find(item => String(item.orderId || "-") === orderId);
    if (!order) return;

    row.dataset.addressEnhanced = "1";
    const customer = order.customer || {};
    const customerCell = cells[2];
    const existingMini = customerCell.querySelector(".mini");
    if (existingMini) existingMini.remove();

    const addressBox = document.createElement("div");
    addressBox.className = "mini delivery-address-lines";
    addressBox.style.marginTop = "4px";
    addressBox.style.display = "grid";
    addressBox.style.gap = "2px";

    if ((order.shippingMethod || "איסוף עצמי") === "משלוח") {
      const lines = [
        ["עיר", customer.city],
        ["רחוב", customer.street],
        ["מספר בית", customer.houseNumber || customer.house],
        ["כניסה", customer.entrance],
        ["דירה", customer.apartmentNumber || customer.apartment]
      ];
      lines.forEach(([label, value]) => {
        if (!value) return;
        const line = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = `${label}: `;
        line.append(strong, document.createTextNode(String(value)));
        addressBox.appendChild(line);
      });
      if (!addressBox.children.length && customer.address) {
        const line = document.createElement("div");
        line.textContent = customer.address;
        addressBox.appendChild(line);
      }
    } else if (customer.city) {
      const line = document.createElement("div");
      line.textContent = customer.city;
      addressBox.appendChild(line);
    }

    customerCell.appendChild(addressBox);
  });
}

const addressObserver = new MutationObserver(() => enhanceDeliveryAddresses());
const startAddressObserver = () => {
  const body = document.getElementById("ordersBody");
  if (!body) return;
  addressObserver.observe(body, { childList: true });
  enhanceDeliveryAddresses();
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startAddressObserver);
else startAddressObserver();

onSnapshot(ordersCollection, snapshot => {
  window.orders = snapshot.docs
    .map(orderDoc => ({ _docId: orderDoc.id, ...orderDoc.data() }))
    .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
  window.render?.();
  queueMicrotask(enhanceDeliveryAddresses);
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
