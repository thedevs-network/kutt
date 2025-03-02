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

const mapInteractions = {
  MIN_SCALE: 1,
  MAX_SCALE: 14,
  ZOOM_IN_FACTOR: 1.2,
  ZOOM_OUT_FACTOR: 0.8,
  DOUBLE_CLICK_DELAY: 300,
  
  svg: null,
  g: null,
  ctm: null,
  mapBounds: null,
  
  lastHoveredPath: null,

  dragging: false,
  dragStart: { x: 0, y: 0 },
  startCTM: null,
  
  pinching: false,
  initialPinchDistance: 0,
  pinchStartCTM: null,
  
  init: function() {
    this.svg = document.querySelector("svg.map");
    if (!this.svg) {
      console.error("SVG map not found!");
      return;
    }
        
    const svgParent = this.svg.parentElement;
    if (svgParent) {
      svgParent.style.position = "relative";
    }
    
    this.g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    while (this.svg.firstChild) {
      this.g.appendChild(this.svg.firstChild);
    }
    this.svg.appendChild(this.g);
    
    const viewBox = this.svg.viewBox.baseVal;
    this.mapBounds = {
      x: viewBox.x,
      y: viewBox.y,
      width: viewBox.width,
      height: viewBox.height
    };
    
    this.ctm = this.svg.createSVGMatrix();
    this.addEventListeners();
  },

  mapTooltip: function() {
    return document.querySelector("#map-tooltip");
  },

  map: function() {
    return document.querySelector("svg.map");
  },

  tooltipHoverOut: function() {
    const svg = this.map();
    const tooltip = this.mapTooltip()
    if (!tooltip || !svg) return;
    
    if (window.matchMedia("(pointer: coarse)").matches && this.dragging) return;

    tooltip.classList.remove("visible");
    if (this.lastHoveredPath) {
      this.lastHoveredPath.classList.remove("active");
      this.lastHoveredPath = null;
    }
  },

  tooltipHoverOver: function(event) {
    if (!event || !event.target) {
      if (this.lastHoveredPath) {
        const br = this.lastHoveredPath.getBoundingClientRect();
        event = {
          clientX: br.left + br.width / 2,
          clientY: br.top + br.height / 2,
          target: this.lastHoveredPath
        };
      } else {
        console.warn("tooltipHoverOver: event.target undefined");
        return;
      }
    }
    
    const tooltip = this.mapTooltip();
    if (!tooltip) return;
    
    const target = event.target;
    if (!target.dataset.id) {
      this.tooltipHoverOut();
      return;
    }
    
    if (this.lastHoveredPath !== target) {
      if (this.lastHoveredPath) {
        this.lastHoveredPath.classList.remove("active");
      }
      this.lastHoveredPath = target;
    }
    
    tooltip.dataset.currentId = target.dataset.id;
    if (!tooltip.classList.contains("visible")) {
      tooltip.classList.add("visible");
    }
    tooltip.dataset.tooltip = `${target.getAttribute("aria-label")}: ${target.dataset.views || 0}`;
    
    const container = this.map();
    const containerRect = container.getBoundingClientRect();
    
    const bbox = target.getBBox();
    let centerPoint = container.createSVGPoint();
    centerPoint.x = bbox.x + bbox.width / 2;
    centerPoint.y = bbox.y + bbox.height / 2;
    
    const ctm = target.getScreenCTM();
    if (!ctm) {
      console.warn("tooltipHoverOver: getScreenCTM() is null");
      return;
    }
    const centerScreen = centerPoint.matrixTransform(ctm);
    
    let localX = centerScreen.x - containerRect.left;
    let localY = centerScreen.y - containerRect.top;
    
    tooltip.style.position = "absolute";
    tooltip.style.pointerEvents = "none";
    
    const tWidth = tooltip.offsetWidth;
    const tHeight = tooltip.offsetHeight;
    
    let posX = localX - tWidth / 2;
    let posY = localY - tHeight / 2;
    
    const leftMargin = 30;
    const rightMargin = 30;
    const topMargin = 30;
    const bottomMargin = 30;
    
    function clamp(value, min, max) {
      return Math.max(min, Math.min(value, max));
    }
    
    posX = clamp(posX, leftMargin, container.clientWidth - tWidth - rightMargin);
    posY = clamp(posY, topMargin, container.clientHeight - tHeight - bottomMargin);
    
    tooltip.style.transform = `translate(${posX}px, ${posY}px)`;
    
    target.classList.add("active");
  },
   
  setCTM: function(matrix) {
    this.g.setAttribute("transform", 
      `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`
    );
    this.ctm = matrix;
  },

  applyBounding: function(matrix) {
    const scaleX = matrix.a;
    const scaleY = matrix.d;
    const scaledWidth = this.mapBounds.width * scaleX;
    const scaledHeight = this.mapBounds.height * scaleY;
    const containerW = this.svg.clientWidth;
    const containerH = this.svg.clientHeight;
    let tx = matrix.e;
    let ty = matrix.f;
    
    if (scaledWidth > containerW) {
      const minX = containerW - scaledWidth;
      if (tx < minX) tx = minX;
      if (tx > 200) tx = 200;
    }

    if (scaledHeight > containerH) {
      const minY = containerH - scaledHeight;
      if (ty < minY) ty = minY;
      if (ty > 200) ty = 200;
    }
    
    return matrix.translate((tx - matrix.e) / scaleX, (ty - matrix.f) / scaleY);
  },

  zoomToPoint: function(eventClientX, eventClientY, factor) {
    const p = this.svg.createSVGPoint();
    p.x = eventClientX;
    p.y = eventClientY;
    
    const invMatrix = this.g.getScreenCTM().inverse();
    const loc = p.matrixTransform(invMatrix);
    
    const currentScale = this.ctm.a;
    let targetScale = currentScale * factor;
    if (targetScale < this.MIN_SCALE) targetScale = this.MIN_SCALE;
    if (targetScale > this.MAX_SCALE) targetScale = this.MAX_SCALE;
    const scaleDelta = targetScale / currentScale;
    
    const translateTo = this.svg.createSVGMatrix().translate(loc.x, loc.y);
    const scaleMat = this.svg.createSVGMatrix().scale(scaleDelta);
    const translateBack = this.svg.createSVGMatrix().translate(-loc.x, -loc.y);
    
    let rawCTM = this.ctm
      .multiply(translateTo)
      .multiply(scaleMat)
      .multiply(translateBack);
      
    let boundedCTM = this.applyBounding(rawCTM);
    
    if (factor > 1 &&
        Math.abs(boundedCTM.e - this.ctm.e) < 0.001 &&
        Math.abs(boundedCTM.f - this.ctm.f) < 0.001) {
      this.setCTM(rawCTM);
    } else {
      this.setCTM(boundedCTM);
    }
  },

  zoomAtCenter: function(factor) {
    const rect = this.svg.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    this.zoomToPoint(centerX, centerY, factor);
  },

  createZoomButton: function(className, ariaLabel, svgHTML) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button " + className;
    button.setAttribute("aria-haspopup", "false");
    button.setAttribute("aria-label", ariaLabel);
    button.innerHTML = svgHTML;
    button.style.marginBottom = "10px";
    button.style.padding = "0 8px";
    return button;
  },

  startDrag: function(event) {
    if (event.touches && event.touches.length > 1) return;
    this.dragging = true;
    this.svg.style.cursor = "grabbing";
    this.dragStart.x = event.touches ? event.touches[0].clientX : event.clientX;
    this.dragStart.y = event.touches ? event.touches[0].clientY : event.clientY;
    this.startCTM = this.ctm;
    if (event.cancelable) {
      event.preventDefault();
    }
  },

  moveDrag: function(event) {
    if (!this.dragging) return;
    if (event.touches && event.touches.length > 1) return;
    if (event.cancelable) {
      event.preventDefault();
    }
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    const dx = clientX - this.dragStart.x;
    const dy = clientY - this.dragStart.y;
    const scaleX = this.startCTM.a;
    const scaleY = this.startCTM.d;
    let newCTM = this.startCTM.multiply(
      this.svg.createSVGMatrix().translate(dx / scaleX, dy / scaleY)
    );
    newCTM = this.applyBounding(newCTM);
    this.setCTM(newCTM);
  },

  endDrag: function() {
    this.dragging = false;
    this.svg.style.cursor = "default";
  },

  startPinch: function(event) {
    if (event.touches.length === 2) {
      this.pinching = true;
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      this.initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
      this.pinchStartCTM = this.ctm;
      event.preventDefault();
    }
  },

  movePinch: function(event) {
    if (!this.pinching || event.touches.length !== 2) return;
    event.preventDefault();
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    const currentDistance = Math.sqrt(dx * dx + dy * dy);
    let scaleFactor = currentDistance / this.initialPinchDistance;
    const currentScale = this.pinchStartCTM.a;
    let targetScale = currentScale * scaleFactor;
    if (targetScale < this.MIN_SCALE) targetScale = this.MIN_SCALE;
    if (targetScale > this.MAX_SCALE) targetScale = this.MAX_SCALE;
    scaleFactor = targetScale / currentScale;
    
    const midX = (touch1.clientX + touch2.clientX) / 2;
    const midY = (touch1.clientY + touch2.clientY) / 2;
    
    const p = this.svg.createSVGPoint();
    p.x = midX;
    p.y = midY;
    const invMatrix = this.g.getScreenCTM().inverse();
    const loc = p.matrixTransform(invMatrix);
    
    const translateTo = this.svg.createSVGMatrix().translate(loc.x, loc.y);
    const scaleMat = this.svg.createSVGMatrix().scale(scaleFactor);
    const translateBack = this.svg.createSVGMatrix().translate(-loc.x, -loc.y);
    
    let newCTM = this.pinchStartCTM
      .multiply(translateTo)
      .multiply(scaleMat)
      .multiply(translateBack);
    newCTM = this.applyBounding(newCTM);
    this.setCTM(newCTM);
  },

  endPinch: function(event) {
    if (event.touches.length < 2) {
      this.pinching = false;
    }
  },
  
  updateTooltipRAF: function(event) {
    if (!mapInteractions.tooltipUpdateScheduled) {
      mapInteractions.tooltipUpdateScheduled = true;
      window.requestAnimationFrame(() => {
        this.tooltipHoverOver(event);
        mapInteractions.tooltipUpdateScheduled = false;
      });
    }
  },

  addEventListeners: function() {
    let lastLeftClickTime = 0;
    let lastRightClickTime = 0;

    const updateTooltip = () => {
      if (this.lastHoveredPath) {
        this.updateTooltipRAF({ target: this.lastHoveredPath });
      }
    };

    this.svg.addEventListener("wheel", (event) => {
      event.preventDefault();
      const zoomDirection = event.deltaY < 0 ? this.ZOOM_IN_FACTOR : 1 / this.ZOOM_IN_FACTOR;
      this.zoomToPoint(event.clientX, event.clientY, zoomDirection);
      updateTooltip()
    }, { passive: false });

    this.svg.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    this.svg.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const now = Date.now();

      if (event.button === 0) {
        if (now - lastLeftClickTime < this.DOUBLE_CLICK_DELAY) {
          this.zoomToPoint(event.clientX, event.clientY, this.ZOOM_IN_FACTOR);
        }
        lastLeftClickTime = now;
        this.startDrag(event);
      }
      else if (event.button === 2) {
        if (now - lastRightClickTime < this.DOUBLE_CLICK_DELAY) {
          this.zoomToPoint(event.clientX, event.clientY, this.ZOOM_OUT_FACTOR);
        }
        lastRightClickTime = now;
      }
    }, { passive: false });

    this.svg.addEventListener("mouseup", this.endDrag.bind(this));
    this.svg.addEventListener("mouseleave", this.endDrag.bind(this));

    this.svg.addEventListener("mousemove", (event) => {
      if (!mapInteractions.isTicking) {
        window.requestAnimationFrame(() => {
          this.moveDrag(event);
          mapInteractions.isTicking = false;
        });
        mapInteractions.isTicking = true;
      }
    });

    this.svg.addEventListener("touchstart", (event) => {
      if (event.cancelable) event.preventDefault();
      if (event.touches.length === 2) {
        this.startPinch(event);
      } else if (event.touches.length === 1) {
        this.startDrag(event);
      }
    }, { passive: false });

    this.svg.addEventListener("touchmove", (event) => {
      if (event.touches.length === 2) {
        this.movePinch(event);
      } else if (event.touches.length === 1) {
        this.moveDrag(event);
        updateTooltip();
      }
    }, { passive: false });

    this.svg.addEventListener("touchend", (event) => {
      if (event.touches.length < 2) {
        this.endPinch(event);
        this.endDrag(event);
        updateTooltip();
      }
    });

    this.bindZoomControls(updateTooltip);
  },

  bindZoomControls: function(updateTooltip) {
    const zoomInButton = document.getElementById("zoomInButton");
    const zoomOutButton = document.getElementById("zoomOutButton");
  
    if (zoomInButton && zoomOutButton) {
      zoomInButton.addEventListener("click", () => {
        this.zoomAtCenter(this.ZOOM_IN_FACTOR)
        updateTooltip()
      });
      zoomOutButton.addEventListener("click", () => {
        this.zoomAtCenter(this.ZOOM_OUT_FACTOR)
        updateTooltip()
      });
    }
  }
};

// create stats charts
function createCharts() {
  if (Chart === undefined) {
    setTimeout(function() { createCharts() }, 100);
    return;
  }
  createViewsChart();
  createBrowsersChart();
  createReferrersChart();
  createOsChart();
  feedMapData();
  mapInteractions.init();
}