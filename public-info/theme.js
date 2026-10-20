const preference = window.matchMedia("(prefers-color-scheme: dark)");
const apply = () => document.documentElement.classList.toggle("dark", preference.matches);
apply();
preference.addEventListener("change", apply);
