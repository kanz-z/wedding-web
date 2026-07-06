// src/dashboard/dashboard.js - entry point
import { state } from "./state";
import { showToast } from "./utils";
import { init } from "./auth";

// Polling approval every 30 detik
setInterval(async function () {
  try {
    var res = await state.dashboardSb
      .from("rsvps")
      .select("id", { count: "exact", head: true })
      .eq("is_approved", false);
    var count = res.count || 0;
    var badge = document.getElementById("badge-approval");
    badge.textContent = count;
    badge.classList.toggle("show", count > 0);
    if (count > state._prevPending && state._prevPending > 0) {
      showToast(count + " RSVP baru perlu persetujuan.");
    }
    state._prevPending = count;
  } catch (e) {
    console.warn("Approval polling gagal:", e);
  }
}, 30000);

init();
