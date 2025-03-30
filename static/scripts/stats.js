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

//Add zoom map v0.4
const mapInteractions = {
  MIN_SCALE: 1,
  MAX_SCALE: 14,
  ZOOM_IN_FACTOR: 1.2,
  ZOOM_OUT_FACTOR: 0.8,
  FLY_SPEED: 1.25,

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
    this.isMobile = window.matchMedia("(pointer: coarse)").matches;
    this.svg = document.querySelector("svg.map");
    if (!this.svg) {
      console.error("SVG map not found!");
      return;
    }
    
    this.mapTooltip = document.querySelector("#map-tooltip");
    if (this.mapTooltip) {
        this.mapTooltip.style.position = "absolute";
        this.mapTooltip.style.pointerEvents = "none";
        this.mapTooltip.style.transition = "transform 0.15s ease-out";
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
  
  tooltipHoverOut: function() {
    const svg = this.svg;
    const tooltip = this.mapTooltip;
    if (!tooltip || !svg) return;
    if (this.isMobile && this.dragging) return;
    
    tooltip.classList.remove("visible");
    if (this.lastHoveredPath) {
      this.lastHoveredPath.classList.remove("active");
      this.lastHoveredPath = null;
    }
  },

  tooltipHoverOver: function(event) {
    const margins = { left: 30, right: 30, top: 30, bottom: 30 };
    const pos_threshold = 5;
    
    let target = event?.target ?? this.lastHoveredPath;
    
    if (!target) {
      console.warn("tooltipHoverOver: target undefined");
      return;
    }

    if (!event?.target) {
      const br = target.getBoundingClientRect();
      event = {
        clientX: br.left + br.width / 2,
        clientY: br.top + br.height / 2,
        target
      };
    }

    const { mapTooltip: tooltip, svg: container } = this;
    
    if (!target.dataset?.id) {
      this.tooltipHoverOut();
      return;
    }

    if (this.lastHoveredPath !== target) {
      this.lastHoveredPath?.classList?.remove("active");
      target.classList.add("active");
      this.lastHoveredPath = target;
    }

    const ariaLabel = target.getAttribute("aria-label");
    const views = target.dataset.views || 0;
    
    tooltip.dataset.currentId = target.dataset.id;
    tooltip.dataset.tooltip = `${ariaLabel}: ${views}`;
    tooltip.classList.add("visible");

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    
    const centerX = targetRect.left + targetRect.width / 2 - containerRect.left;
    const centerY = targetRect.top + targetRect.height / 2 - containerRect.top;
    
    const tWidth = tooltip.offsetWidth;
    const tHeight = tooltip.offsetHeight;
    
    let posX = Math.max(margins.left, 
      Math.min(centerX - tWidth / 2, 
        container.clientWidth - tWidth - margins.right));
    
    let posY = Math.max(margins.top, 
      Math.min(centerY - tHeight / 2, 
        container.clientHeight - tHeight - margins.bottom));

    const shouldUpdate = !this.lastPos || 
      Math.abs(posX - this.lastPos.x) > pos_threshold || 
      Math.abs(posY - this.lastPos.y) > pos_threshold;

    if (shouldUpdate) {
      tooltip.style.transform = `translate3d(${posX}px, ${posY}px, 0)`;
      this.lastPos = { x: posX, y: posY };
    }
  },

  setCTM: function(matrix) {
    this.g.style.transform = `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e}, ${matrix.f})`;
    this.ctm = matrix;
  },

  applyBounding: function(matrix) {    
    const {a: scaleX, d: scaleY, e: tx, f: ty} = matrix;
    const {width: mapW, height: mapH} = this.mapBounds;
    const [containerW, containerH] = this._cachedContainerSize || [0, 0];
    
    if (!this._cachedContainerSize || this._containerSizeChanged) {
        this._cachedContainerSize = [this.svg.clientWidth, this.svg.clientHeight];
        this._containerSizeChanged = false;
    }
    
    const scaledW = mapW * scaleX;
    const scaledH = mapH * scaleY;
    const maxOffset = this.isMobile ? 150 : 200;
    
    const clampAxis = (scaledDim, containerDim, currentPos) => {
      if (scaledDim > containerDim) {
        const min = containerDim - scaledDim;
        return Math.min(maxOffset, Math.max(min, currentPos));
      }
      return (containerDim - scaledDim) / 2;
    };
    
    const newX = clampAxis(scaledW, containerW, tx);
    const newY = clampAxis(scaledH, containerH, ty);
    
    const dx = (newX - tx) / scaleX || 0;
    const dy = (newY - ty) / scaleY || 0;
    
    return matrix.translate(dx, dy);
   },

  zoomToPoint: function(eventClientX, eventClientY, factor) {
    if (!this._tempPoint) this._tempPoint = this.svg.createSVGPoint();
    const p = this._tempPoint;
    p.x = eventClientX;
    p.y = eventClientY;
    
    const invMatrix = this.g.getScreenCTM().inverse();
    const centerScreen = p.matrixTransform(invMatrix);
    
    const currentScale = this.ctm.a;
    const targetScale = Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, currentScale * factor));
    const scaleDelta = targetScale / currentScale;
    
    const deltaMatrix = this.svg.createSVGMatrix();
    deltaMatrix.a = deltaMatrix.d = scaleDelta;
    deltaMatrix.e = centerScreen.x * (1 - scaleDelta);
    deltaMatrix.f = centerScreen.y * (1 - scaleDelta);
    
    const rawCTM = this.ctm.multiply(deltaMatrix);
    const boundedCTM = this.applyBounding(rawCTM);
    
    if (factor > 1 &&
        Math.abs(boundedCTM.e - this.ctm.e) < 1e-3 &&
        Math.abs(boundedCTM.f - this.ctm.f) < 1e-3) {
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

  startDrag: function(event) {
    if (event.touches && event.touches.length > 1) return;
    this.dragging = true;
    this.svg.style.cursor = "grabbing";
    this.dragStart.x = event.touches ? event.touches[0].clientX : event.clientX;
    this.dragStart.y = event.touches ? event.touches[0].clientY : event.clientY;
    this.startCTM = this.ctm;
    this.mapTooltip.style.willChange = "transform";
    this.g.style.willChange = "transform";
    if (event.cancelable) {
      event.preventDefault();
    }
  },

  moveDrag: function(event) {
    if (!this.dragging) return;
    
    const isTouchEvent = !!event.touches;
    if (isTouchEvent && event.touches.length > 1) return;
    if (event.cancelable) event.preventDefault();
    
    const { clientX, clientY } = isTouchEvent ? event.touches[0] : event;
    
    const { a: scaleX, d: scaleY } = this.startCTM;
    const invScaleX = 1 / scaleX;
    const invScaleY = 1 / scaleY;
    
    const flySpeed = this.isMobile ? this.FLY_SPEED + 1.5 : this.FLY_SPEED;
    const dx = (clientX - this.dragStart.x) * flySpeed * invScaleX;
    const dy = (clientY - this.dragStart.y) * flySpeed * invScaleY;
    
    this.setCTM(
        this.applyBounding(this.startCTM.translate(dx, dy))
    );
  },
  
  endDrag: function() {
    this.dragging = false;
    this.svg.style.cursor = "default";
    this.mapTooltip.style.willChange = "";
    this.g.style.willChange = "";
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
      this.mapTooltip.style.willChange = "transform";
      this.g.style.willChange = "transform";
      event.preventDefault();
    }
  },
 
  movePinch: function(event) {
    if (!this.pinching || event.touches.length !== 2) return;
    
    const [touch1, touch2] = event.touches;
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    const currentDistance = Math.hypot(dx, dy);
    
    const initialScale = this.pinchStartCTM.a;
    const targetScale = Math.min(Math.max(
      this.MIN_SCALE, 
      initialScale * (currentDistance / this.initialPinchDistance)
    ), this.MAX_SCALE);
    const scaleDelta = targetScale / this.ctm.a;
    
    this._tempMidPoint ??= this.svg.createSVGPoint();
    this._tempMidPoint.x = (touch1.clientX + touch2.clientX) * 0.5;
    this._tempMidPoint.y = (touch1.clientY + touch2.clientY) * 0.5;
    
    const center = this._tempMidPoint.matrixTransform(this.g.getScreenCTM().inverse());
    const deltaMatrix = this.svg.createSVGMatrix();
    deltaMatrix.a = deltaMatrix.d = scaleDelta;
    deltaMatrix.e = center.x * (1 - scaleDelta);
    deltaMatrix.f = center.y * (1 - scaleDelta);
    
    const newCTM = this.applyBounding(this.ctm.multiply(deltaMatrix));
    this.setCTM(newCTM);
    
    this.initialPinchDistance = currentDistance;
    this.pinchStartCTM = newCTM;
  },
  
  
  endPinch: function(event) {
    if (event.touches.length < 2) {
        this.pinching = false;
    }
  },

  addEventListeners: function() {
    const updateTooltip = () => {
      if (this.lastHoveredPath) {
        this.tooltipHoverOver({ target: this.lastHoveredPath });
      }
    };

    window.addEventListener('resize', () => {
      this.isMobile = window.matchMedia("(pointer: coarse)").matches;
      this._containerSizeChanged = true;
    });

    this.svg.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    this.svg.addEventListener("wheel", (event) => {
      event.preventDefault();
      const zoomDirection = event.deltaY < 0 ? this.ZOOM_IN_FACTOR : 1 / this.ZOOM_IN_FACTOR;
      this.zoomToPoint(event.clientX, event.clientY, zoomDirection);

      if (this.dragging) {
        this.startCTM = this.ctm;
        this.dragStart = {
          x: event.clientX,
          y: event.clientY
        };
      }
      updateTooltip();
    }, { passive: false });
    
    this.svg.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const now = Date.now();
    
      if (event.button === 0) {
        if (now - this.lastClickTime < this.DOUBLE_CLICK_DELAY) {
          this.zoomToPoint(event.clientX, event.clientY, this.ZOOM_IN_FACTOR);
          this.lastClickTime = 0;
          return;
        }
        this.startDrag(event);
        this.lastClickTime = now;
      }
      else if (event.button === 2) {
        if (now - this.lastClickTime < this.DOUBLE_CLICK_DELAY) {
          this.zoomToPoint(event.clientX, event.clientY, this.ZOOM_OUT_FACTOR);
          this.lastClickTime = 0;
          return;
        }
        this.lastClickTime = now;
      }
    }, { passive: false });

    const throttleRAF = (callback) => {
      return (event) => {
        if (!this.isTicking) {
          window.requestAnimationFrame(() => {
            callback(event);
            this.isTicking = false;
          });
          this.isTicking = true;
        }
      };
    };

    const handleMouseMove = throttleRAF((event) => {
      this.moveDrag(event);
    });

    const handleTouchMove = throttleRAF((event) => {
      if (event.touches.length === 2) {
        this.movePinch(event);
      } else if (event.touches.length === 1) {
        this.moveDrag(event);
      }
      updateTooltip();
    });

    const handleTouchStart = (event) => {
      if (event.cancelable) event.preventDefault();
      if (event.touches.length === 2) {
        this.startPinch(event);
      } else if (event.touches.length === 1) {
        this.startDrag(event);
      }
    };

    this.svg.addEventListener("mousemove", handleMouseMove);
    this.svg.addEventListener("mouseup", this.endDrag.bind(this));
    this.svg.addEventListener("mouseleave", this.endDrag.bind(this));

    this.svg.addEventListener("touchstart", handleTouchStart, { passive: false });
    this.svg.addEventListener("touchmove", handleTouchMove, { passive: false });
    this.svg.addEventListener("touchend", (event) => {
      if (event.touches.length < 2) {
        this.endPinch(event);
        this.endDrag(event);
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
