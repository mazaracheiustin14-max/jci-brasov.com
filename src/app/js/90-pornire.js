/* Pornirea aplicației */
async function start() {
  var th = lsGet("jcib-theme");
  if (th) document.documentElement.setAttribute("data-theme", th);
  if (/(^|[?&])ui(=|&|$)/.test(location.search.slice(1))) {
    S.mode = "ui";
    renderCatalog();
    return;
  }
  S.mode = "loading";
  render();
  if (S.server) {
    try {
      var rs = await fetch("/api/app/me", { credentials: "same-origin" });
      var js = await rs.json().catch(function () {
        return {};
      });
      if (rs.status === 200 && js.needCred) {
        S.mode = "needcred";
        document.getElementById("app").innerHTML = renderNeedCred();
        bindNeedCred();
        return;
      }
      if (rs.status === 200) {
        S.me = {
          id: String(js.id),
          isOwner: js.isOwner === true,
          name: String(js.name || ""),
          branch: String(js.branch || ""),
          role: String(js.role || ""),
          title: String(js.title || ""),
          email: String(js.email || ""),
        };
        S.store = makeHttpStore();
        S.mode = "ready";
        var hs = location.hash.replace("#", "");
        if (hs) S.tab = hs;
        subscribeAll();
        render();
        return;
      }
      if (rs.status === 403 && js.excluded) {
        S.mode = "excluded";
        document.getElementById("app").innerHTML = renderExcluded(js);
        return;
      }
      if (rs.status === 401) {
        S.mode = "login";
        showServerLogin();
        return;
      }
    } catch (e) {}
    S.mode = "error";
    render();
    return;
  }
  var live = false;
  try {
    if (window.claude && typeof window.claude.use === "function") {
      var timeout = new Promise(function (r) {
        setTimeout(function () {
          r(null);
        }, 6000);
      });
      var got = await Promise.race([Promise.all([window.claude.use("db"), window.claude.use("user")]), timeout]);
      if (got && got[0] && got[1]) {
        var db = got[0],
          user = got[1];
        var id = await user.id();
        var ow = await Promise.resolve(user.isOwner && user.isOwner());
        S.me = { id: String(id), isOwner: ow === true };
        S.store = makeLiveStore(db);
        live = true;
      }
    }
  } catch (e) {
    live = false;
  }
  if (!live) {
    if (window.claude && typeof window.claude.use === "function") {
      S.mode = "error";
      render();
      return;
    }
    S.store = makeMemStore(demoSeed);
    S.me = { id: "u-nat", isOwner: false };
    S.note = "";
  }
  S.mode = "ready";
  var h = location.hash.replace("#", "");
  if (h) S.tab = h;
  subscribeAll();
  render();
}
start();
