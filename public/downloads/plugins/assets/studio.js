(() => {
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.site-menu');
  if (toggle && menu) {
    const setOpen = open => { toggle.setAttribute('aria-expanded', String(open)); menu.classList.toggle('open', open); toggle.querySelector('span').textContent = open ? '−' : '+'; };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); } });
    document.addEventListener('click', e => { if (!e.target.closest('.site-nav')) setOpen(false); });
  }
  document.querySelectorAll('[data-edition]').forEach(button => button.addEventListener('click', () => {
    const instrument = button.dataset.edition === 'instrument';
    const img = document.getElementById('hero-rack');
    img.src = instrument ? 'assets/modular/modular-instrument.png' : 'assets/modular/modular-fx.png';
    img.alt = instrument ? 'Modular Instrument with four source layers and an effects chain' : 'Modular FX with an effects chain, macros and analog meters';
    document.querySelectorAll('[data-edition]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  }));
  const year = document.getElementById('yr');
  if (year) year.textContent = new Date().getFullYear();
})();
