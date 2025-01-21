// log htmx on dev
// htmx.logAll();

// add text/html accept header to receive html instead of json for the requests
document.body.addEventListener("htmx:configRequest", function(evt) {
  evt.detail.headers["Accept"] = "text/html,*/*";
});

// redirect to homepage
document.body.addEventListener("redirectToHomepage", function() {
  setTimeout(() => {
    window.location.replace("/");
  }, 1500);
});

// reset form if event is sent from the backend
function resetForm(id) {
  return function() {
    const form = document.getElementById(id);
    if (!form) return;
    form.reset();
  }
}
document.body.addEventListener("resetChangePasswordForm", resetForm("change-password"));
document.body.addEventListener("resetChangeEmailForm", resetForm("change-email"));

// an htmx extension to use the specifed params in the path instead of the query or body
htmx.defineExtension("path-params", {
  onEvent: function(name, evt) {
    if (name === "htmx:configRequest") {
      evt.detail.path = evt.detail.path.replace(/{([^}]+)}/g, function(_, param) {
        var val = evt.detail.parameters[param]
        delete evt.detail.parameters[param]
        return val === undefined ? "{" + param + "}" : encodeURIComponent(val)
      })
    }
  }
})

// find closest element
function closest(selector, elm) {
  let element = elm || this;

  while (element && element.nodeType === 1) {
    if (element.matches(selector)) {
      return element;
    }

    element = element.parentNode;
  }

  return null;
};

// get url query param
function getQueryParams() {
  const search = window.location.search.replace("?", "");
  const query = {};
  search.split("&").map(q => {
    const keyvalue = q.split("=");
    query[keyvalue[0]] = keyvalue[1];
  });
  return query;
}

// trim text
function trimText(selector, length) {
  const element = document.querySelector(selector);
  if (!element) return;
  let text = element.textContent;
  if (typeof text !== "string") return;
  text = text.trim();
  if (text.length > length) {
    element.textContent = text.split("").slice(0, length).join("") + "...";
  }
}

function formatDateHour(selector) {
  const element = document.querySelector(selector);
  if (!element) return;
  const dateString = element.dataset.date;
  if (!dateString) return;
  const date = new Date(dateString);
  element.textContent = date.getHours() + ":" + date.getMinutes();
}

// show QR code
function handleQRCode(element, id) {
  const dialog = document.getElementById(id);
  const dialogContent = dialog.querySelector(".content-wrapper");
  if (!dialogContent) return;
  openDialog(id, "qrcode");
  dialogContent.textContent = "";
  const qrcode = new QRCode(dialogContent, {
    text: element.dataset.url,
    width: 200,
    height: 200,
    colorDark : "#000000",
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.H
  });   
}

// copy the link to clipboard
function handleCopyLink(element) {
  navigator.clipboard.writeText(element.dataset.url);
}

// copy the link and toggle copy button style
function handleShortURLCopyLink(element) {
  handleCopyLink(element);
  const clipboard = element.parentNode.querySelector(".clipboard") || closest(".clipboard", element);
  if (!clipboard || clipboard.classList.contains("copied")) return;
  clipboard.classList.add("copied");
  setTimeout(function() {
    clipboard.classList.remove("copied");
  }, 1000);
}

// open and close dialog
function openDialog(id, name) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  dialog.classList.add("open");
  if (name) {
    dialog.classList.add(name);
  }
}

function closeDialog() {
  const dialog = document.querySelector(".dialog");
  if (!dialog) return;
  while (dialog.classList.length > 0) {
    dialog.classList.remove(dialog.classList[0]);
  }
  dialog.classList.add("dialog");
}

window.addEventListener("click", function(event) {
  const dialog = document.querySelector(".dialog");
  if (dialog && event.target === dialog) {
    closeDialog();
  }
});

// handle navigation in the table of links
function setLinksLimit(event) {
  const buttons = Array.from(document.querySelectorAll("table .nav .limit button"));
  const limitInput = document.querySelector("#limit");
  if (!limitInput || !buttons || !buttons.length) return;
  limitInput.value = event.target.textContent;
  buttons.forEach(b => {
    b.disabled = b.textContent === event.target.textContent;
  });
}

function setLinksSkip(event, action) {
  const buttons = Array.from(document.querySelectorAll("table .nav .pagination button"));
  const limitElm = document.querySelector("#limit");
  const totalElm = document.querySelector("#total");
  const skipElm = document.querySelector("#skip");
  if (!buttons || !limitElm || !totalElm || !skipElm) return;
  const skip = parseInt(skipElm.value);
  const limit = parseInt(limitElm.value);
  const total = parseInt(totalElm.value);
  skipElm.value = action === "next" ? skip + limit : Math.max(skip - limit, 0);
  document.querySelectorAll(".pagination .next").forEach(elm => {
    elm.disabled = total <= parseInt(skipElm.value) + limit;
  });
  document.querySelectorAll(".pagination .prev").forEach(elm => {
    elm.disabled = parseInt(skipElm.value) <= 0;
  });
}

function updateLinksNav() {
  const totalElm = document.querySelector("#total");
  const skipElm = document.querySelector("#skip");
  const limitElm = document.querySelector("#limit");
  if (!totalElm || !skipElm || !limitElm) return;
  const total = parseInt(totalElm.value);
  const skip = parseInt(skipElm.value);
  const limit = parseInt(limitElm.value);
  document.querySelectorAll(".pagination .next").forEach(elm => {
    elm.disabled = total <= skip + limit;
  });
  document.querySelectorAll(".pagination .prev").forEach(elm => {
    elm.disabled = skip <= 0;
  });
}

function resetTableNav() {
  const totalElm = document.querySelector("#total");
  const skipElm = document.querySelector("#skip");
  const limitElm = document.querySelector("#limit");
  if (!totalElm || !skipElm || !limitElm) return;
  skipElm.value = 0;
  limitElm.value = 10;
  const total = parseInt(totalElm.value);
  const skip = parseInt(skipElm.value);
  const limit = parseInt(limitElm.value);
  document.querySelectorAll(".pagination .next").forEach(elm => {
    elm.disabled = total <= skip + limit;
  });
  document.querySelectorAll(".pagination .prev").forEach(elm => {
    elm.disabled = skip <= 0;
  });
  document.querySelectorAll("table .nav .limit button").forEach(b => {
    b.disabled = b.textContent === limit.toString();
  });
}

// tab click
function setTab(event, targetId) {
  const tabs = Array.from(closest("nav", event.target).children);
  tabs.forEach(function (tab) {
    tab.classList.remove("active");
  });
  if (targetId) {
    document.getElementById(targetId).classList.add("active");
  } else {
    event.target.classList.add("active");
  }
}

// show clear search button
function onSearchChange(event) {
  const clearButton = event.target.parentElement.querySelector("button.clear");
  if (!clearButton) return;
  clearButton.style.display = event.target.value.length > 0 ? "block" : "none";
}

function clearSeachInput(event) {
  event.preventDefault();
  const button = closest("button", event.target);
  const input = button.parentElement.querySelector("input");
  if (!input) return;
  input.value = "";
  button.style.display = "none";
  htmx.trigger("body", "reloadMainTable");
}

// detect if search inputs have value on load to show clear button
function onSearchInputLoad() {
  const linkSearchInput = document.getElementById("search");
  if (!linkSearchInput) return;
  const linkClearButton = linkSearchInput.parentElement.querySelector("button.clear")
  linkClearButton.style.display = linkSearchInput.value.length > 0 ? "block" : "none";

  const userSearchInput = document.getElementById("search_user");
  if (!userSearchInput) return;
  const userClearButton = userSearchInput.parentElement.querySelector("button.clear")
  userClearButton.style.display = userSearchInput.value.length > 0 ? "block" : "none";

  const domainSearchInput = document.getElementById("search_domain");
  if (!domainSearchInput) return;
  const domainClearButton = domainSearchInput.parentElement.querySelector("button.clear")
  domainClearButton.style.display = domainSearchInput.value.length > 0 ? "block" : "none";
}

onSearchInputLoad();

// create user checkbox control
function canSendVerificationEmail() {
  const canSendVerificationEmail = !document.getElementById("create-user-verified").checked && !document.getElementById("create-user-banned").checked;
  const checkbox = document.getElementById("send-email-label");
  if (canSendVerificationEmail)
    checkbox.classList.remove("hidden");
  if (!canSendVerificationEmail && !checkbox.classList.contains("hidden"))
    checkbox.classList.add("hidden");
}

// htmx prefetch extension
// https://github.com/bigskysoftware/htmx-extensions/blob/main/src/preload/README.md
htmx.defineExtension("preload", {
  onEvent: function(name, event) {
    if (name !== "htmx:afterProcessNode") {
      return
    }
    var attr = function(node, property) {
      if (node == undefined) { return undefined }
      return node.getAttribute(property) || node.getAttribute("data-" + property) || attr(node.parentElement, property)
    }
    var load = function(node) {
      var done = function(html) {
        if (!node.preloadAlways) {
          node.preloadState = "DONE"
        }

        if (attr(node, "preload-images") == "true") {
          document.createElement("div").innerHTML = html
        }
      }

      return function() {
        if (node.preloadState !== "READY") {
          return
        }
        var hxGet = node.getAttribute("hx-get") || node.getAttribute("data-hx-get")
        if (hxGet) {
          htmx.ajax("GET", hxGet, {
            source: node,
            handler: function(elt, info) {
              done(info.xhr.responseText)
            }
          })
          return
        }
        if (node.getAttribute("href")) {
          var r = new XMLHttpRequest()
          r.open("GET", node.getAttribute("href"))
          r.onload = function() { done(r.responseText) }
          r.send()
        }
      }
    }
    var init = function(node) {
      if (node.getAttribute("href") + node.getAttribute("hx-get") + node.getAttribute("data-hx-get") == "") {
        return
      }
      if (node.preloadState !== undefined) {
        return
      }
      var on = attr(node, "preload") || "mousedown"
      const always = on.indexOf("always") !== -1
      if (always) {
        on = on.replace("always", "").trim()
      }
      node.addEventListener(on, function(evt) {
        if (node.preloadState === "PAUSE") {
          node.preloadState = "READY"
          if (on === "mouseover") {
            window.setTimeout(load(node), 100)
          } else {
            load(node)()
          }
        }
      })
      switch (on) {
        case "mouseover":
          node.addEventListener("touchstart", load(node))
          node.addEventListener("mouseout", function(evt) {
            if ((evt.target === node) && (node.preloadState === "READY")) {
              node.preloadState = "PAUSE"
            }
          })
          break

        case "mousedown":
          node.addEventListener("touchstart", load(node))
          break
      }
      node.preloadState = "PAUSE"
      node.preloadAlways = always
      htmx.trigger(node, "preload:init")
    }
    const parent = event.target || event.detail.elt;
    parent.querySelectorAll("[preload]").forEach(function(node) {
      init(node)
      node.querySelectorAll("a,[hx-get],[data-hx-get]").forEach(init)
    })
  }
})