// log htmx on dev
// htmx.logAll();

// add text/html accept header to receive html instead of json for the requests
document.body.addEventListener('htmx:configRequest', function(evt) {
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
document.body.addEventListener('resetChangePasswordForm', resetForm("change-password"));
document.body.addEventListener('resetChangeEmailForm', resetForm("change-email"));

// an htmx extension to use the specifed params in the path instead of the query or body
htmx.defineExtension("path-params", {
  onEvent: function(name, evt) {
    if (name === "htmx:configRequest") {
      evt.detail.path = evt.detail.path.replace(/{([^}]+)}/g, function(_, param) {
        var val = evt.detail.parameters[param]
        delete evt.detail.parameters[param]
        return val === undefined ? '{' + param + '}' : encodeURIComponent(val)
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

// show QR code
function handleQRCode(element) {
  const dialog = document.querySelector("#link-dialog");
  const dialogContent = dialog.querySelector(".content-wrapper");
  if (!dialogContent) return;
  openDialog("link-dialog", "qrcode");
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

// TODO: make it an extension
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
  const buttons = Array.from(document.querySelectorAll('table .nav .limit button'));
  const limitInput = document.querySelector('#limit');
  if (!limitInput || !buttons || !buttons.length) return;
  limitInput.value = event.target.textContent;
  buttons.forEach(b => {
    b.disabled = b.textContent === event.target.textContent;
  });
}

function setLinksSkip(event, action) {
  const buttons = Array.from(document.querySelectorAll('table .nav .pagination button'));
  const limitElm = document.querySelector('#limit');
  const totalElm = document.querySelector('#total');
  const skipElm = document.querySelector('#skip');
  if (!buttons || !limitElm || !totalElm || !skipElm) return;
  const skip = parseInt(skipElm.value);
  const limit = parseInt(limitElm.value);
  const total = parseInt(totalElm.value);
  skipElm.value = action === "next" ? skip + limit : Math.max(skip - limit, 0);
  document.querySelectorAll('.pagination .next').forEach(elm => {
    elm.disabled = total <= parseInt(skipElm.value) + limit;
  });
  document.querySelectorAll('.pagination .prev').forEach(elm => {
    elm.disabled = parseInt(skipElm.value) <= 0;
  });
}

function updateLinksNav() {
  const totalElm = document.querySelector('#total');
  const skipElm = document.querySelector('#skip');
  const limitElm = document.querySelector('#limit');
  if (!totalElm || !skipElm || !limitElm) return;
  const total = parseInt(totalElm.value);
  const skip = parseInt(skipElm.value);
  const limit = parseInt(limitElm.value);
  document.querySelectorAll('.pagination .next').forEach(elm => {
    elm.disabled = total <= skip + limit;
  });
  document.querySelectorAll('.pagination .prev').forEach(elm => {
    elm.disabled = skip <= 0;
  });
}

function resetLinkNav() {
  const totalElm = document.querySelector('#total');
  const skipElm = document.querySelector('#skip');
  const limitElm = document.querySelector('#limit');
  if (!totalElm || !skipElm || !limitElm) return;
  skipElm.value = 0;
  limitElm.value = 10;
  const skip = parseInt(skipElm.value);
  const limit = parseInt(limitElm.value);
  document.querySelectorAll('.pagination .next').forEach(elm => {
    elm.disabled = total <= skip + limit;
  });
  document.querySelectorAll('.pagination .prev').forEach(elm => {
    elm.disabled = skip <= 0;
  });
  document.querySelectorAll('table .nav .limit button').forEach(b => {
    b.disabled = b.textContent === limit.toString();
  });
}