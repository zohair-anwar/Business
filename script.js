/* =========================================================
   Off Watch Wellness — client behaviour
   Waitlist form handling: validation, submit, success state.
   ========================================================= */
(function () {
  "use strict";

  // Footer year
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  var form = document.getElementById("waitlist-form");
  if (!form) return;

  var emailEl   = document.getElementById("email");
  var consentEl = document.getElementById("consent");
  var hpEl      = document.getElementById("company"); // honeypot
  var statusEl  = document.getElementById("form-status");
  var submitBtn = document.getElementById("submit-btn");

  // Build the success panel once, placed right after the form (CSS targets the sibling).
  var success = document.createElement("div");
  success.className = "success-panel";
  success.setAttribute("role", "status");
  success.innerHTML =
    '<div class="check" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" ' +
      'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M20 6L9 17l-5-5"/></svg>' +
    '</div>' +
    "<h3>You're on the list.</h3>" +
    "<p>Thank you for trusting us with this. We'll reach out privately as we open spots — " +
    "and nothing else lands in your inbox in the meantime.</p>";
  form.insertAdjacentElement("afterend", success);

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setStatus(msg, kind) {
    statusEl.textContent = msg || "";
    statusEl.className = "form-status" + (kind ? " is-" + kind : "");
  }

  emailEl.addEventListener("input", function () {
    emailEl.removeAttribute("aria-invalid");
    if (statusEl.classList.contains("is-error")) setStatus("");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // Bot caught by honeypot — pretend success, do nothing.
    if (hpEl && hpEl.value.trim() !== "") {
      form.classList.add("is-done");
      return;
    }

    var email = emailEl.value.trim();
    if (!EMAIL_RE.test(email)) {
      emailEl.setAttribute("aria-invalid", "true");
      emailEl.focus();
      setStatus("Please enter a valid email address.", "error");
      return;
    }
    if (!consentEl.checked) {
      setStatus("Please check the box so we know it's okay to contact you.", "error");
      consentEl.focus();
      return;
    }

    var payload = {
      name: (document.getElementById("name").value || "").trim(),
      email: email,
      role: document.getElementById("role").value,
      province: document.getElementById("province").value,
      consent: true,
      submittedAt: new Date().toISOString(),
      source: "landing"
    };

    submitBtn.disabled = true;
    var originalLabel = submitBtn.textContent;
    submitBtn.textContent = "Joining…";
    setStatus("");

    fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (r) {
        if (r.ok || r.status === 200 || r.status === 201) {
          form.classList.add("is-done");
          try { success.focus(); } catch (_) {}
        } else if (r.status === 409) {
          // Already on the list — still a friendly outcome.
          form.classList.add("is-done");
        } else {
          throw new Error((r.data && r.data.error) || "Request failed");
        }
      })
      .catch(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
        setStatus(
          "Something went wrong on our end. Please try again, or email hello@offwatchwellness.ca.",
          "error"
        );
      });
  });
})();
