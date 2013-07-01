/**
* Izpiše besedo, ki jo ugibamo. Znak _ pomeni, da črka na tem mestu ni znana.
* @param string beseda  Vhodna beseda oz. besedna zveza.
*/
function izpisiBesedo(beseda) {
  var rez = [];
  for(var i=0; i<beseda.length; i++) {
    if(beseda[i] == ' ')
      rez.push('<div class="crkaPresledek">&nbsp;</div>');
    else if(beseda[i] == '_')
      rez.push('<div class="crka">&nbsp;</div>');
    else
      rez.push('<div class="crka">', beseda[i], '</div>');
  }
  $('#pBeseda').html(rez.join(''));
}


/**
* Prikaže animacijo nalaganja.
*/
function showLoading() {
  $('#status').html('<img src="img/ajax-loader.gif" alt="Ajax loader" />');
}