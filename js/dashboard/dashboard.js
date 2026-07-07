// dashboard entry point — polling + init

// polling approval setiap 30 detik
setInterval(async function () {
  try {
    var res = await dashboardSb
      .from("rsvps")
      .select("id", { count: "exact", head: true })
      .eq("is_approved", false);
    var count = res.count || 0;
    var badge = document.getElementById("badge-approval");
    badge.textContent = count;
    badge.classList.toggle("show", count > 0);
    if (count > _prevPending && _prevPending > 0) {
      showToast(count + " RSVP baru perlu persetujuan.");
    }
    _prevPending = count;
  } catch (e) {}
}, 30000);

init();
