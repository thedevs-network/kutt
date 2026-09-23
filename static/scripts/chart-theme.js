(() => {
  "use strict";
  if (!window.Chart) return;
  Chart.register({
    id: "kuttTheme",
    beforeUpdate(chart) {
      const dark = document.documentElement.dataset.theme === "dark";
      const color = dark ? "#b8c2c7" : "#586976", border = dark ? "#576168" : "#cbd5da";
      chart.options.color = color;
      for (const scale of Object.values(chart.options.scales || {})) {
        if (scale.ticks) scale.ticks.color = color;
        if (scale.grid) scale.grid.color = border;
        if (scale.border) scale.border.color = border;
      }
      const plugins = chart.options.plugins;
      if (plugins.legend && plugins.legend.labels) plugins.legend.labels.color = color;
      if (plugins.tooltip) {
        plugins.tooltip.backgroundColor = dark ? "#363b40" : "#fff";
        plugins.tooltip.titleColor = plugins.tooltip.bodyColor = dark ? "#edf0f2" : "#243f49";
        plugins.tooltip.borderColor = border;
      }
    }
  });
  document.addEventListener("kutt:theme", () => {
    for (const chart of Object.values(Chart.instances)) chart.update("none");
  });
})();
