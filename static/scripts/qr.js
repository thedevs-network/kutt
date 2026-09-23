(() => {
  const root = document.querySelector(".qr-page"), form = document.getElementById("qr-settings");
  const image = document.getElementById("qr-preview"), print = document.getElementById("qr-print");
  const error = document.getElementById("qr-error"), copy = document.getElementById("qr-copy"), status = document.getElementById("qr-copy-status");
  const file = document.getElementById("qr-logo"), remove = document.getElementById("qr-logo-remove"), thumbnail = document.getElementById("qr-logo-preview");
  const png = document.getElementById("qr-png"), svg = document.getElementById("qr-svg"), level = form.elements.level;
  const endpoint = "/api/links/" + root.dataset.qrId + "/qr", messages = error.dataset;
  const supported = window.isSecureContext && typeof window.ClipboardItem === "function" && typeof navigator.clipboard?.write === "function";
  let generation = 0, controller, ready = false, copying = false, unbrandedLevel = level.value, urls = [];
  document.getElementById("qr-branding").hidden = false;
  if (!supported) copy.title = messages.copyUnavailable;
  const failure = message => Object.assign(new Error(), { qrMessage: message });
  const update = () => {
    print.disabled = !ready;
    copy.disabled = !ready || !supported || copying;
    for (const link of [png, svg]) { link.setAttribute("aria-disabled", String(!ready)); link.tabIndex = ready ? 0 : -1; }
    remove.disabled = !file.files.length;
  };
  const release = () => { urls.forEach(url => URL.revokeObjectURL(url)); urls = []; };
  const invalidate = () => {
    generation++; controller?.abort(); ready = false;
    error.hidden = true; status.textContent = messages.pending;
    image.hidden = true; image.removeAttribute("src");
    png.removeAttribute("href"); svg.removeAttribute("href");
    release(); update(); return generation;
  };
  const failed = message => { error.textContent = message; error.hidden = false; status.textContent = ""; };
  for (const link of [png, svg]) link.addEventListener("click", event => { if (!ready) event.preventDefault(); });
  image.addEventListener("load", () => {
    if (generation) return;
    ready = image.naturalWidth > 0; error.hidden = ready; update();
  });
  image.addEventListener("error", () => { if (!generation) { ready = false; failed(messages.load); update(); } });
  if (image.complete) { ready = image.naturalWidth > 0; if (!ready) failed(messages.load); update(); }

  async function render() {
    const current = invalidate();
    if (!form.reportValidity()) return;
    controller = new AbortController();
    const signal = controller.signal, abort = setTimeout(() => controller?.signal === signal && controller.abort(), 15000);
    const generated = [], selected = file.files[0];
    status.textContent = messages.rendering;
    try {
      let logo;
      if (selected) {
        if (!selected.size || selected.size > 65536 || (selected.type && selected.type !== "image/png")) throw failure(messages.logo);
        const bytes = new Uint8Array(await selected.arrayBuffer());
        if (current !== generation) return;
        if (bytes.length < 33 || ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) throw failure(messages.logo);
        const header = new DataView(bytes.buffer), width = header.getUint32(16), height = header.getUint32(20);
        if (!width || !height || width > 512 || height > 512 || bytes[28]) throw failure(messages.logo);
        let encoded = "";
        for (let start = 0; start < bytes.length; start += 8192) encoded += String.fromCharCode(...bytes.subarray(start, start + 8192));
        logo = btoa(encoded);
      }
      const settings = { size: form.elements.size.value, level: level.value, ...(logo && { logo }) };
      const fetchImage = async format => {
        const response = await fetch(logo ? endpoint : endpoint + "?" + new URLSearchParams({ ...settings, format }), {
          method: logo ? "POST" : "GET", credentials: "same-origin", redirect: "error", signal,
          headers: { Accept: format === "png" ? "image/png" : "image/svg+xml", ...(logo && { "Content-Type": "application/json" }) },
          ...(logo && { body: JSON.stringify({ ...settings, format }) })
        });
        if (!response.ok) {
          const body = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
          throw failure(typeof body?.error === "string" && body.error.length < 400 ? body.error : messages.load);
        }
        const blob = await response.blob(), type = format === "png" ? "image/png" : "image/svg+xml";
        if (blob.type.split(";")[0] !== type || !blob.size || blob.size > 2 * 1024 * 1024) throw failure(messages.load);
        return blob;
      };
      const blobs = await Promise.all([fetchImage("png"), fetchImage("svg")]);
      if (current !== generation) return;
      const vector = new DOMParser().parseFromString(await blobs[1].text(), "image/svg+xml");
      if (vector.querySelector("parsererror") || vector.documentElement.localName !== "svg" ||
          vector.documentElement.namespaceURI !== "http://www.w3.org/2000/svg") throw failure(messages.load);
      const canonicalLogo = logo && vector.querySelector("image")?.getAttribute("href");
      if (logo && !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(canonicalLogo || "")) throw failure(messages.load);
      if (current !== generation) return;
      const fresh = blobs.map(blob => { const url = URL.createObjectURL(blob); generated.push(url); return url; });
      const decoded = new Image(); decoded.src = fresh[0]; await decoded.decode();
      if (current !== generation) return;
      urls = generated.splice(0); image.src = fresh[0]; image.hidden = false;
      png.href = fresh[0]; svg.href = fresh[1]; ready = true;
      if (logo) { thumbnail.src = canonicalLogo; thumbnail.hidden = false; }
      history.replaceState(null, "", form.action + "?" + new URLSearchParams({ size: settings.size, level: settings.level }));
      status.textContent = messages.ready;
    } catch (error) {
      if (current === generation) { controller.abort(); failed(error.qrMessage || messages.load); }
    } finally {
      clearTimeout(abort); generated.forEach(url => URL.revokeObjectURL(url));
      if (current === generation) update();
    }
  }
  form.addEventListener("submit", event => { event.preventDefault(); render(); });
  form.addEventListener("input", invalidate);
  file.addEventListener("change", () => {
    thumbnail.hidden = true; thumbnail.removeAttribute("src");
    if (file.files.length) {
      if (!level.disabled) unbrandedLevel = level.value;
      level.disabled = true; level.value = "H";
    } else { level.disabled = false; level.value = unbrandedLevel; }
    render();
  });
  remove.addEventListener("click", () => {
    file.value = ""; thumbnail.hidden = true; thumbnail.removeAttribute("src");
    level.disabled = false; level.value = unbrandedLevel; file.focus(); render();
  });
  print.addEventListener("click", () => { if (ready) window.print(); });
  copy.addEventListener("click", async () => {
    if (copy.disabled || copying) return;
    const current = generation;
    copying = true; copy.setAttribute("aria-busy", "true"); status.textContent = messages.copying; update();
    let timer;
    try {
      const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      const encoded = new Promise((resolve, reject) => canvas.toBlob(blob => blob?.type === "image/png" ? resolve(blob) : reject(Error()), "image/png"));
      encoded.catch(() => {});
      // Keep write() in the click gesture, including Safari's promise-valued PNG.
      await Promise.race([navigator.clipboard.write([new ClipboardItem({ "image/png": encoded })]),
        new Promise((_, reject) => { timer = setTimeout(reject, 10000); })]);
      if (current === generation) status.textContent = messages.copied;
    } catch { if (current === generation) status.textContent = messages.copyFailed; }
    finally { clearTimeout(timer); copying = false; copy.removeAttribute("aria-busy"); update(); }
  });
  window.addEventListener("pagehide", () => {
    if (!level.disabled) unbrandedLevel = level.value;
    invalidate(); file.value = ""; thumbnail.hidden = true; thumbnail.removeAttribute("src");
    level.disabled = false; level.value = unbrandedLevel;
  });
  window.addEventListener("pageshow", event => { if (event.persisted) render(); });
})();
