// add text/html accept header to receive html instead of json for the requests
document.body.addEventListener('htmx:configRequest', function(evt) {
  evt.detail.headers["Accept"] = "text/html,*/*";
  console.log(evt.detail.headers);
});

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