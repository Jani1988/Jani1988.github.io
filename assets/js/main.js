(() => {
  const btn = document.querySelector('[data-burger]');
  const menu = document.querySelector('[data-mobile-menu]');
  if(btn && menu){
    btn.addEventListener('click', () => {
      const isHidden = menu.hasAttribute('hidden');
      if(isHidden) menu.removeAttribute('hidden');
      else menu.setAttribute('hidden','');
      btn.setAttribute('aria-expanded', String(isHidden));
    });
  }
})();
