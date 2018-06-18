export default function showRecaptcha() {
  const captcha = document.getElementById('g-recaptcha');
  if (!captcha) return null;
  if (!window.grecaptcha || !window.grecaptcha.render) {
    return setTimeout(() => showRecaptcha(), 200);
  }
  if (!captcha.childNodes.length) {
    window.captchaId = window.grecaptcha.render(captcha);
  }
  return null;
}
