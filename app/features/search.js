export function initSearch(){
  const searchForm=document.getElementById('mn-search-form');
  const searchInput=document.getElementById('mn-search-input');
  const searchStatus=document.getElementById('mn-search-status');
  const products=[...document.querySelectorAll('.mn-product')];
  if(!searchForm || !searchInput) return;

  function executeSearch(){
    const query=searchInput.value.trim().toLowerCase();
    if(location.hash!=='#catalogo') location.hash='#catalogo';
    let visible=products.length;
    if(query){
      products.forEach(product=>{
        product.hidden=!product.textContent.toLowerCase().includes(query);
      });
      visible=products.filter(product=>!product.hidden).length;
      searchStatus.textContent=visible
        ? `${visible} resultado${visible===1?'':'s'} para “${searchInput.value.trim()}”`
        : `No encontramos productos para “${searchInput.value.trim()}”`;
    } else {
      products.forEach(product=>{product.hidden=false;});
      searchStatus.textContent='';
    }
  }
  searchForm.addEventListener('submit',event=>{event.preventDefault();executeSearch();});
  searchInput.addEventListener('input',()=>{if(!searchInput.value.trim()) executeSearch();});
}
