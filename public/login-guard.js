// login-guard.js
async function setupLoginGuard() {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const res = await fetch("login-modal.html");
  const html = await res.text();
  container.innerHTML = html;

  const passwordModalEl = document.getElementById("passwordModal");
  const passwordModal = new bootstrap.Modal(passwordModalEl, {
    backdrop: "static",
    keyboard: false
  });
  passwordModal.show();

  // إخفاء زر الإغلاق العلوي ✖
  document.querySelectorAll("#passwordModal .btn-close")
    .forEach(btn => btn.style.display = "none");

  // زر إلغاء → العودة للرئيسية
  const cancelBtn = document.querySelector("#passwordModal .btn-secondary");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  const passwordInput = document.getElementById("dashboardPassword");

  passwordModalEl.addEventListener("shown.bs.modal", () => {
    passwordInput.focus();
  });

  async function verifyPassword() {
    const password = passwordInput.value;
    const res = await fetch("/api/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    if (res.status === 200) {
      passwordModal.hide();
    } else {
      alert("❌ كلمة المرور غير صحيحة");
      passwordInput.value = "";
      passwordInput.focus();
    }
  }

  document.getElementById("confirmDashboardAccess")
    .addEventListener("click", verifyPassword);

  passwordInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      verifyPassword();
    }
  });
}

// ✅ عند تحميل الصفحة نفعل الحماية
document.addEventListener("DOMContentLoaded", setupLoginGuard);
