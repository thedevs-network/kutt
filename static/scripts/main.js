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

// create views chart label
function createViewsChartLabel(ctx) {
  const period = ctx.dataset.period;
  let labels = [];

  if (period === "day") {
    const nowHour = new Date().getHours();
    for (let i = 23; i >= 0; --i) {
      let h = nowHour - i;
      if (h < 0) h = 24 + h;
      labels.push(`${Math.floor(h)}:00`);
    }
  }

  if (period === "week") {
    const nowDay = new Date().getDate();
    for (let i = 6; i >= 0; --i) {
      const date = new Date(new Date().setDate(nowDay - i));
      labels.push(`${date.getDate()} ${date.toLocaleString("default",{month:"short"})}`);
    }
  }

  if (period === "month") {
    const nowDay = new Date().getDate();  
    for (let i = 29; i >= 0; --i) {
      const date = new Date(new Date().setDate(nowDay - i));
      labels.push(`${date.getDate()} ${date.toLocaleString("default",{month:"short"})}`);
    }
  }

  if (period === "year") {
    const nowMonth = new Date().getMonth();  
    for (let i = 11; i >= 0; --i) {
      const date = new Date(new Date().setMonth(nowMonth - i));
      labels.push(`${date.toLocaleString("default",{month:"short"})} ${date.toLocaleString("default",{year:"numeric"})}`);
    }
  }

  return labels;
}

// create views chart
function createViewsChart() {
  const canvases = document.querySelectorAll("canvas.visits");
  if (!canvases || !canvases.length) return;

  canvases.forEach(ctx => {
    const data = JSON.parse(ctx.dataset.data);
    const period = ctx.dataset.period;
  
    const labels = createViewsChartLabel(ctx);
    const maxTicksLimitX = period === "year" ? 6 : period === "month" ? 15 : 12;
  
    const gradient = ctx.getContext("2d").createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(179, 157, 219, 0.95)");   
    gradient.addColorStop(1, "rgba(179, 157, 219, 0.05)");
    
    new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Views",
          data,
          tension: 0.3,
  
          elements: {
            point: {
              pointRadius: 0,
              pointHoverRadius: 4
            }
          },
          fill: {
            target: "start",
          },
          backgroundColor: gradient,
          borderColor: "rgb(179, 157, 219)",
          borderWidth: 1,
        }]
      },
      options: {
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            titleColor: "#333",
            titleFont: { weight: "normal", size: 15 },
            bodyFont: { weight: "normal", size: 16 },
            bodyColor: "rgb(179, 157, 219)",
            padding: 12,
            cornerRadius: 2,
            borderColor: "rgba(0, 0, 0, 0.1)",
            borderWidth: 1,
            displayColors: false,
          }
        },
        responsive: true,
        interaction: {
          intersect: false,
          usePointStyle: true,
          mode: "index",
        },
        scales: {
          y: {
            grace: "10%",
            beginAtZero: true,
            ticks: {
              maxTicksLimit: 5
            }
          },
          x: {
            ticks: {
              maxTicksLimit: maxTicksLimitX,
            }
          }
        }  
      }
    });

    // reset the display: block style that chart.js applies automatically
    ctx.style.display = "";
  });
}

// beautify browser lables
function beautifyBrowserName(name) {
  if (name === "firefox") return "Firefox";
  if (name === "chrome") return "Chrome";
  if (name === "edge") return "Edge";
  if (name === "opera") return "Opera";
  if (name === "safari") return "Safari";
  if (name === "other") return "Other";
  if (name === "ie") return "IE";
  return name;
}

// create browsers chart
function createBrowsersChart() {
  const canvases = document.querySelectorAll("canvas.browsers");
  if (!canvases || !canvases.length) return;

  canvases.forEach(ctx => {
    const data = JSON.parse(ctx.dataset.data);
    const period = ctx.dataset.period;

    const gradient = ctx.getContext("2d").createLinearGradient(500, 0, 0, 0);
    const gradientHover = ctx.getContext("2d").createLinearGradient(500, 0, 0, 0);
    gradient.addColorStop(0, "rgba(179, 157, 219, 0.95)");   
    gradient.addColorStop(1, "rgba(179, 157, 219, 0.05)");
    gradientHover.addColorStop(0, "rgba(179, 157, 219, 0.9)");   
    gradientHover.addColorStop(1, "rgba(179, 157, 219, 0.4)");

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map(d => beautifyBrowserName(d.name)),
        datasets: [{
          label: "Views",
          data: data.map(d => d.value),
          backgroundColor: gradient,
          borderColor: "rgba(179, 157, 219, 1)",
          borderWidth: 1,
          hoverBackgroundColor: gradientHover,
          hoverBorderWidth: 2
        }]
      },
      options: {
        indexAxis: "y",
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            titleColor: "#333",
            titleFont: { weight: "normal", size: 15 },
            bodyFont: { weight: "normal", size: 16 },
            bodyColor: "rgb(179, 157, 219)",
            padding: 12,
            cornerRadius: 2,
            borderColor: "rgba(0, 0, 0, 0.1)",
            borderWidth: 1,
            displayColors: false,
          }
        },
        responsive: true,
        interaction: {
          intersect: false,
          mode: "index",
          axis: "y"
        },
        scales: {
          x: {
            grace: "5%",
            beginAtZero: true,
            ticks: {
              maxTicksLimit: 6,
            }
          }
        }  
      }
    });

    // reset the display: block style that chart.js applies automatically
    ctx.style.display = "";
  });
}

// create referrers chart
function createReferrersChart() {
  const canvases = document.querySelectorAll("canvas.referrers");
  if (!canvases || !canvases.length) return;

  canvases.forEach(ctx => {
    const data = JSON.parse(ctx.dataset.data);
    const period = ctx.dataset.period;
    let max = Array.from(data).sort((a, b) => a.value > b.value ? -1 : 1)[0];

    let tooltipEnabled = true;
    let hoverBackgroundColor = "rgba(179, 157, 219, 1)";
    let hoverBorderWidth = 2;
    let borderColor = "rgba(179, 157, 219, 1)";
    if (data.length === 0) {
      data.push({ name: "No views.", value: 1 });
      max = { value: 1000 };
      tooltipEnabled = false;
      hoverBackgroundColor = "rgba(179, 157, 219, 0.1)";
      hoverBorderWidth = 1;
      borderColor = "rgba(179, 157, 219, 0.2)";
    }

    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: data.map(d => d.name.replace(/\[dot\]/g, ".")),
        datasets: [{
          label: "Views",
          data: data.map(d => d.value),
          backgroundColor: data.map(d => `rgba(179, 157, 219, ${Math.max((d.value / max.value) - 0.2, 0.1).toFixed(2)})`),
          borderWidth: 1,
          borderColor,
          hoverBackgroundColor,
          hoverBorderWidth,
        }]
      },
      options: {
        plugins: {
          legend: {
            position: "left",
            labels: {
              boxWidth: 25,
              font: { size: 11 }
            }
          },
          tooltip: {
            enabled: tooltipEnabled,
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            titleColor: "#333",
            titleFont: { weight: "normal", size: 15 },
            bodyFont: { weight: "normal", size: 16 },
            bodyColor: "rgb(179, 157, 219)",
            padding: 12,
            cornerRadius: 2,
            borderColor: "rgba(0, 0, 0, 0.1)",
            borderWidth: 1,
            displayColors: false,
          }
        },
        responsive: false,
      }
    });

    // reset the display: block style that chart.js applies automatically
    ctx.style.display = "";
  });
}


// beautify browser lables
function beautifyOsName(name) {
  if (name === "android") return "Android";
  if (name === "ios") return "iOS";
  if (name === "linux") return "Linux";
  if (name === "macos") return "macOS";
  if (name === "windows") return "Windows";
  if (name === "other") return "Other";
  return name;
}


// create operation systems chart
function createOsChart() {
  const canvases = document.querySelectorAll("canvas.os");
  if (!canvases || !canvases.length) return;

  canvases.forEach(ctx => {
    const data = JSON.parse(ctx.dataset.data);
    const period = ctx.dataset.period;

    const gradient = ctx.getContext("2d").createLinearGradient(500, 0, 0, 0);
    const gradientHover = ctx.getContext("2d").createLinearGradient(500, 0, 0, 0);
    gradient.addColorStop(0, "rgba(179, 157, 219, 0.95)");   
    gradient.addColorStop(1, "rgba(179, 157, 219, 0.05)");
    gradientHover.addColorStop(0, "rgba(179, 157, 219, 0.9)");   
    gradientHover.addColorStop(1, "rgba(179, 157, 219, 0.4)");

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map(d => beautifyOsName(d.name)),
        datasets: [{
          label: "Views",
          data: data.map(d => d.value),
          backgroundColor: gradient,
          borderColor: "rgba(179, 157, 219, 1)",
          borderWidth: 1,
          hoverBackgroundColor: gradientHover,
          hoverBorderWidth: 2
        }]
      },
      options: {
        indexAxis: "y",
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            titleColor: "#333",
            titleFont: { weight: "normal", size: 15 },
            bodyFont: { weight: "normal", size: 16 },
            bodyColor: "rgb(179, 157, 219)",
            padding: 12,
            cornerRadius: 2,
            borderColor: "rgba(0, 0, 0, 0.1)",
            borderWidth: 1,
            displayColors: false,
          }
        },
        responsive: true,
        interaction: {
          intersect: false,
          mode: "index",
          axis: "y"
        },
        scales: {
          x: {
            grace:"5%",
            beginAtZero: true,
            ticks: {
              maxTicksLimit: 6,
            }
          }
        }  
      }
    });

    // reset the display: block style that chart.js applies automatically
    ctx.style.display = "";
  });
}

// add data to the map
function feedMapData(period) {
  const map = document.querySelector("svg.map");
  const paths = map.querySelectorAll("path");
  if (!map || !paths || !paths.length) return;

  let data = JSON.parse(map.dataset[period || "day"]);
  if (!data) return;

  let max = data.sort((a, b) => a.value > b.value ? -1 : 1)[0];

  if (!max) max = { value: 1 }
  
  data = data.reduce((a, c) => ({ ...a, [c.name]: c.value }), {});
  
  for (let i = 0; i < paths.length; ++i) {
    const id = paths[i].dataset.id;
    const views = data[id] || 0;
    paths[i].dataset.views = views;
    const colorLevel = Math.ceil((views / max.value) * 6);  
    const classList = paths[i].classList;
    for (let j = 1; j < 7; j++) {
      paths[i].classList.remove(`color-${j}`);
    }
    paths[i].classList.add(`color-${colorLevel}`)
    paths[i].dataset.views = views;
  }
}

// handle map tooltip hover
function mapTooltipHoverOver() {
  const tooltip = document.querySelector("#map-tooltip");
  if (!tooltip) return;
  if (!event.target.dataset.id) return mapTooltipHoverOut();
  if (!tooltip.classList.contains("active")) {
    tooltip.classList.add("visible");
  }
  tooltip.dataset.tooltip = `${event.target.ariaLabel}: ${event.target.dataset.views || 0}`;
  const rect = event.target.getBoundingClientRect();
  tooltip.style.top = rect.top + (rect.height / 2) + "px";
  tooltip.style.left = rect.left + (rect.width / 2) + "px";
  event.target.classList.add("active");
}
function mapTooltipHoverOut() {
  const tooltip = document.querySelector("#map-tooltip");
  const map = document.querySelector("svg.map");
  const paths = map.querySelectorAll("path");
  if (!tooltip || !map) return;
  tooltip.classList.remove("visible");
  for (let i = 0; i < paths.length; ++i) {
    paths[i].classList.remove("active");
  }
}

// create stats charts
function createCharts() {
  createViewsChart();
  createBrowsersChart();
  createReferrersChart();
  createOsChart();
  feedMapData();
}

// change stats period for showing charts and data
function changeStatsPeriod(event) {
  const period = event.target.dataset.period;
  if (!period) return;
  const canvases = document.querySelector("#stats").querySelectorAll("[data-period]");
  const buttons = document.querySelector("#stats").querySelectorAll(".nav");
  if (!buttons || !canvases) return;
  buttons.forEach(b => b.disabled = false);
  event.target.disabled = true;
  canvases.forEach(canvas => {
    if (canvas.dataset.period === period) {
      canvas.classList.remove("hidden");
    } else {
      canvas.classList.add("hidden");
    }
  });
  feedMapData(period);
}