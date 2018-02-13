export default function showRecaptcha() {
  const captcha = document.getElementById('g-recaptcha');
  if (!captcha) return null;
  window.recaptchaCallback = response => {
    const captchaInput = document.getElementById('g-recaptcha-input');
    captchaInput.value = response;
  };
  if (!window.grecaptcha) {
    return setTimeout(() => showRecaptcha(captcha), 200);
  }
  return setTimeout(() => {
    if ((window, captcha, !captcha.childNodes.length)) {
      window.grecaptcha.render(captcha);
    }
    return null;
  }, 1000);
}
