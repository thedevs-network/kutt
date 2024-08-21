// log htmx on dev
// htmx.logAll();

// add text/html accept header to receive html instead of json for the requests
document.body.addEventListener('htmx:configRequest', function(evt) {
  evt.detail.headers["Accept"] = "text/html,*/*";
});

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
function closest(selector) {
  let element = this;

  while (element && element.nodeType === 1) {
    if (element.matches(selector)) {
      return element;
    }

    element = element.parentNode;
  }

  return null;
};

// copy the link to clipboard
function handleCopyLink(element) {
  navigator.clipboard.writeText(element.dataset.url);
}

// copy the link and toggle copy button style
function handleShortURLCopyLink(element) {
  handleCopyLink(element);
  const parent = document.querySelector("#shorturl");
  if (!parent || parent.classList.contains("copied")) return;
  parent.classList.add("copied");
  setTimeout(function() {
    parent.classList.remove("copied");
  }, 1000);
}

// TODO: make it an extension
// open and close dialog
function openDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  dialog.classList.add("open");
}

function closeDialog() {
  const dialog = document.querySelector(".dialog");
  if (!dialog) return;
  dialog.classList.remove("open");
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