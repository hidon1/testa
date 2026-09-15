// Sends an abandoned-order follow-up through a Google Apps Script Web App.
// Setup: deploy the supplied Apps Script as a Web App and paste its /exec URL below.
(function () {
  const APPS_SCRIPT_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_EXEC_URL_HERE";

  function firstName(fullName) {
    return String(fullName || "").trim().split(/\s+/)[0] || "לקוח יקר";
  }

  async function sendFollowup(order, button) {
    const customer = order && order.customer ? order.customer : {};
    const email = String(customer.email || "").trim();
    if (!email) {
      alert("ללקוח הזה לא שמורה כתובת אימייל.");
      return;
    }

    if (!APPS_SCRIPT_URL.startsWith("https://script.google.com/macros/s/") || !APPS_SCRIPT_URL.endsWith("/exec")) {
      alert("עדיין לא הוגדרה כתובת Google Apps Script. אחרי הפריסה יש להדביק את כתובת ה-/exec בקובץ mail-actions.js.");
      return;
    }

    if (!confirm(`לשלוח עכשיו מייל השלמת הזמנה ל-${firstName(customer.name)} (${email})?`)) return;

    const oldHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח...';

    try {
      // application/x-www-form-urlencoded keeps this a simple browser request and avoids a CORS preflight.
      const body = new URLSearchParams({
        email,
        name: String(customer.name || "")
      });

      // no-cors is used because Apps Script Web Apps do not expose configurable CORS headers.
      // A successful fetch means the request reached the Web App; delivery is performed there.
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: body.toString()
      });

      button.innerHTML = '<i class="fa-solid fa-check"></i> נשלח';
      button.style.color = "#177245";
      alert(`בקשת השליחה נשלחה ל-Google Apps Script עבור ${email}.`);
    } catch (err) {
      console.error("Follow-up email error:", err);
      button.disabled = false;
      button.innerHTML = oldHtml;
      alert("לא הצלחנו לפנות ל-Google Apps Script. בדוק את כתובת ה-Web App ואת החיבור לאינטרנט.");
    }
  }

  function addButtons() {
    const body = document.getElementById("ordersBody");
    if (!body || typeof window.getFilteredOrders !== "function") return;
    const rows = Array.from(body.querySelectorAll("tr"));
    const orders = window.getFilteredOrders();

    rows.forEach((row, index) => {
      const order = orders[index];
      if (!order || row.querySelector(".gmail-followup-btn")) return;
      const actions = row.querySelector(".row-actions");
      if (!actions) return;

      const email = String(order.customer?.email || "").trim();
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-ghost gmail-followup-btn";
      button.style.cssText = "padding:6px 8px;font-size:.72rem;white-space:nowrap;color:#b42323";
      button.innerHTML = '<i class="fa-solid fa-paper-plane"></i> שלח מייל השלמת הזמנה';
      button.title = email ? `שליחת מייל ישירות אל ${email}` : "אין כתובת אימייל ללקוח";
      button.disabled = !email;
      if (!email) button.style.opacity = ".45";
      button.addEventListener("click", () => sendFollowup(order, button));
      actions.prepend(button);
    });
  }

  window.sendCustomerFollowupEmail = sendFollowup;

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
