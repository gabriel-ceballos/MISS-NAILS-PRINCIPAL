const TITLES={catalogo:'Catálogo',carrito:'Carrito',pedidos:'Pedidos',cuenta:'Mi cuenta'};

export function createRouter(app){
  const panels=[...document.querySelectorAll('[data-view-panel]')];
  const navItems=[...document.querySelectorAll('.mn-nav-item')];
  function renderView(){
    const requested=location.hash.replace('#','').toLowerCase();
    const view=TITLES[requested] ? requested : 'catalogo';
    panels.forEach(panel=>panel.classList.toggle('active',panel.dataset.viewPanel===view));
    navItems.forEach(item=>{
      const active=item.dataset.view===view;
      item.classList.toggle('active',active);
      if(active) item.setAttribute('aria-current','page'); else item.removeAttribute('aria-current');
    });
    app.dataset.view=view;
    app.dataset.shell=(view==='pedidos'||view==='cuenta')?'account':'shopping';
    document.title=`MISS NAILS · ${TITLES[view]} · Preview`;
  }
  window.addEventListener('hashchange',renderView);
  renderView();
  return {renderView};
}
