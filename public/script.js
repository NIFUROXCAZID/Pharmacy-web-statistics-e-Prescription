'use strict';

const goTopButton = document.querySelector('.go-top__button');
// const goDownButton = document.querySelector('.go-down__button');

goTopButton.addEventListener('click', scrollToStart);
// goDownButton.addEventListener('click', scrollToEnd);

function scrollToStart() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// function scrollToEnd() {
//   window.scrollTo({
//     top: document.documentElement.scrollHeight,
//     behavior: 'smooth'
//   });
// }

const themeButton = document.querySelector("#theme-toggle");
const savedTheme = localStorage.getItem("theme");
const currentTheme = savedTheme || "dark";
document.documentElement.dataset.theme = currentTheme;
themeButton.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme;
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = newTheme;
  localStorage.setItem("theme", newTheme);
});



const headingRow = document.querySelector('#pharmacy-heading');
headingRow.addEventListener('click', () => {
  const expanded = headingRow.classList.toggle('is-expanded');
  for (const text of headingRow.querySelectorAll('.table-text')) {
    text.classList.toggle('table-text--expanded', expanded);
  }
  for (const button of headingRow.querySelectorAll('.table-text-button')) {
    button.setAttribute('aria-expanded', String(expanded));
  }
});