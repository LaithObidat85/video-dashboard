// login-guard.js

// ⏱️ المدة المسموح بها قبل إعادة طلب كلمة المرور (بالثواني)
const LOGIN_TIMEOUT = 600; // 600 ثانية = 10 دقائق

async function setupLoginGuard() {
  // ✅ تحقق إذا كان فيه جلسة دخول سارية
  const loggedInAt = sessionStorage.getItem("loggedInAt");
  if (loggedInAt) {
    const now = Date.now();
    const diff = (now - parseInt(loggedInAt, 10)) / 1000; // بالثواني
    if (diff < LOGIN_TIMEOUT) { 
      return; // لا تطلب كلمة المرور
    }
  }

  // 🛑 إذا لا توجد جلسة → أظهر المودال
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
      // ✅ حفظ وقت الدخول
      sessionStorage.setItem("loggedInAt", Date.now().toString());
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

// ✅ عند تحميل الصفحة نفذ الحماية
document.addEventListener("DOMContentLoaded", setupLoginGuard);
