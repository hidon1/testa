// Sends customer emails through the Google Apps Script Web App.
(function () {
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwIxSZe91CJl7c-u0ndDJlFThxR3kSKtABnF6KFh2lqPIiNvaFufJonI6egPtsplbd-/exec";

  function firstName(fullName) {
    return String(fullName || "").trim().split(/\s+/)[0] || "לקוח יקר";
  }

  function isPaid(order) {
    const s = String(order?.paymentStatus || "").toLowerCase();
    return order?.paid === true || ["paid", "paid_client_return", "approved", "success"].includes(s) || ["paid", "delivered"].includes(String(order?.adminStatus || "").toLowerCase());
  }

  async function sendMail(order, button, type) {
    const customer = order?.customer || {};
    const email = String(customer.email || "").trim();
    if (!email) return alert("ללקוח הזה לא שמורה כתובת אימייל.");

    const isThanks = type === "thanks";
    const label = isThanks ? "מייל תודה ואישור הזמנה" : "מייל השלמת הזמנה";
    if (!confirm(`לשלוח עכשיו ${label} ל-${firstName(customer.name)} (${email})?`)) return;

    const oldHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח...';

    try {
      const body = new URLSearchParams({
        email,
        name: String(customer.name || ""),
        type,
        shippingMethod: String(order.shippingMethod || "איסוף עצמי"),
        orderId: String(order.orderId || "")
      });
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: body.toString()
      });
      button.innerHTML = '<i class="fa-solid fa-check"></i> נשלח';
      button.style.opacity = ".75";
      alert(`${label} נשלח עבור ${email}.`);
    } catch (err) {
      console.error("Customer email error:", err);
      button.disabled = false;
      button.innerHTML = oldHtml;
      alert("לא הצלחנו לפנות ל-Google Apps Script. בדוק את החיבור לאינטרנט.");
    }
  }

  function makeButton(order, type) {
    const email = String(order.customer?.email || "").trim();
    const thanks = type === "thanks";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn customer-mail-btn ${thanks ? "thanks-mail-btn" : "followup-mail-btn"}`;
    button.style.cssText = thanks
      ? "padding:7px 10px;font-size:.72rem;white-space:nowrap;background:#177245;color:#fff;border:1px solid #116039;border-radius:7px"
      : "padding:7px 10px;font-size:.72rem;white-space:nowrap;background:#fff3f2;color:#b42323;border:1px solid #efc6c2;border-radius:7px";
    button.innerHTML = thanks
      ? '<i class="fa-solid fa-heart"></i> מייל תודה / אושר'
      : '<i class="fa-solid fa-envelope"></i> מייל השלמת הזמנה';
    button.disabled = !email;
    if (!email) button.style.opacity = ".45";
    button.addEventListener("click", () => sendMail(order, button, type));
    return button;
  }

  function addButtons() {
    const body = document.getElementById("ordersBody");
    if (!body || typeof window.getFilteredOrders !== "function") return;
    const rows = Array.from(body.querySelectorAll("tr"));
    const orders = window.getFilteredOrders();

    rows.forEach((row, index) => {
      const order = orders[index];
      if (!order) return;
      const actions = row.querySelector(".row-actions");
      if (!actions) return;

      if (!actions.querySelector(".followup-mail-btn")) actions.prepend(makeButton(order, "followup"));
      if (isPaid(order) && !actions.querySelector(".thanks-mail-btn")) actions.prepend(makeButton(order, "thanks"));
    });
  }

  window.sendCustomerFollowupEmail = (order, button) => sendMail(order, button, "followup");
  window.sendCustomerThanksEmail = (order, button) => sendMail(order, button, "thanks");

  const observer = new MutationObserver(addButtons);
  function start() {
    const body = document.getElementById("ordersBody");
    if (!body) return setTimeout(start, 100);
    observer.observe(body, { childList: true, subtree: true });
    addButtons();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
