// Replaces the old status action buttons with one persistent status dropdown.
(function () {
  function currentStatus(order) {
    if (order.adminStatus) return order.adminStatus;
    if (String(order.orderStatus || "").toLowerCase() === "cancelled") return "cancelled";
    if (order.delivered === true || order.deliveryStatus === "delivered") return "delivered";
    const ps = String(order.paymentStatus || "").toLowerCase();
    if (order.paid === true || ["paid", "paid_client_return", "approved", "success"].includes(ps)) return "paid";
    return "pending";
  }

  function decorate() {
    const body = document.getElementById("ordersBody");
    if (!body || typeof window.getFilteredOrders !== "function") return;
    const orders = window.getFilteredOrders();
    const rows = Array.from(body.querySelectorAll("tr"));

    rows.forEach((row, index) => {
      const order = orders[index];
      if (!order) return;
      const holder = row.querySelector(".status-buttons");
      if (!holder || holder.dataset.dropdownReady === "1") return;
      holder.dataset.dropdownReady = "1";

      const select = document.createElement("select");
      select.className = "order-status-select";
      select.style.cssText = "width:100%;min-width:135px;margin-top:7px;padding:8px 10px;border:1px solid #d6ddd7;border-radius:8px;background:#fff;font:inherit;cursor:pointer";
      select.innerHTML = [
        ["pending", "ממתין לתשלום"],
        ["paid", "שולם"],
        ["delivered", "נמסר"],
        ["cancelled", "בוטל"]
      ].map(([value,label]) => `<option value="${value}">${label}</option>`).join("");
      select.value = currentStatus(order);

      select.addEventListener("change", async () => {
        const previous = currentStatus(order);
        select.disabled = true;
        try {
          await window.setOrderStatus(order._docId, select.value);
          if (typeof window.showToast === "function") window.showToast("הסטטוס עודכן");
        } catch (err) {
          console.error(err);
          select.value = previous;
          alert("לא ניתן היה לעדכן את הסטטוס.");
        } finally {
          select.disabled = false;
        }
      });

      holder.replaceChildren(select);
    });
  }

  const observer = new MutationObserver(decorate);
  function start() {
    const body = document.getElementById("ordersBody");
    if (!body) return setTimeout(start, 100);
    observer.observe(body, { childList: true, subtree: true });
    decorate();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
