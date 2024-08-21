function renderError(res, template, errors) {
  const error = errors[0].msg;
    
  const params = {};

  errors.forEach(e => {
    if (params[e.param]) return;
    params[e.param + "_error"] = e.msg;
  });

  res.render(template, {
    layout: null,
    error,
    ...params
  });
}

/**
 * @type {import("express").Handler}
 */
function addErrorRenderer(req, res, next) {
  res.render.error = (template, errors) => renderError(res, template, errors);  
}

module.exports = {
  addErrorRenderer,
}