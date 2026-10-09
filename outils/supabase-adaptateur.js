/* =====================================================================
   VD SERVICES — la plateforme parle à Supabase

   La plateforme a été écrite pour la base de Claude. Plutôt que de
   réécrire trois mille lignes d'écrans, ce fichier reconstruit le même
   `db` au-dessus de Supabase : mêmes appels, mêmes noms, autre moteur.
   Les vues ne savent pas que le sol a changé.

   Deux traductions se font ici, et nulle part ailleurs :
     • les noms — la plateforme dit statutDemandeur, Postgres dit
       statut_demandeur ;
     • les champs rares des parcours énergie et consultation publique,
       rangés dans une colonne `extra` et remis à plat à la lecture.
   ===================================================================== */

var SB={
  url:"https://xunxejadiyaodhwbjqrn.supabase.co",
  cle:"sb_publishable_wkNhgamhbc4wzJ-L_aR73g_hlTHCdIl",
  jeton:null,          /* jeton de la session, posé à la connexion */
  moi:null             /* {id, email, role, client_id} */
};

/* ---------- correspondance des tables ---------- */
/* cle   : la colonne qui identifie une ligne, quand ce n'est pas `id`
   plat  : les champs du parcours rangés dans `extra`
   dates : rien de particulier, Postgres s'en charge */
var TABLES={
  demandes:{cle:"id",extra:["entite","organisme","service","fonction","nature","site",
    "nbDevis","montant","dateLimite","pieces","refInterne","logement","anciennete",
    "occupation","usage","personnes","revenus","chauffage","dpe","devisSigne"]},
  clients:{cle:"id"},
  residences:{cle:"id"},
  prestataires:{cle:"id"},
  interventions:{cle:"id"},
  photos:{cle:"id"},
  documents:{cle:"id"},
  devis:{cle:"id"},
  bordereaux:{cle:"demande_id"},
  reglages:{cle:"cle",enveloppe:"valeur"},
  tarifs:{cle:"cle",enveloppe:null}
};
/* quelques noms ne suivent pas la règle générale */
var RENOMME={
  precision:"precision_lieu",   /* `precision` est réservé en SQL */
  date:"date_inter",            /* interventions */
  dateDevis:"date_devis"
};
var RENOMME_INV={};
Object.keys(RENOMME).forEach(function(k){RENOMME_INV[RENOMME[k]]=k});

function versSnake(k){
  if(RENOMME[k])return RENOMME[k];
  return k.replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase();
}
function versCamel(k){
  if(RENOMME_INV[k])return RENOMME_INV[k];
  return k.replace(/_([a-z0-9])/g,function(_,c){return c.toUpperCase()});
}

/* ---------- lecture : la ligne Postgres devient l'objet attendu ---------- */
function versPlateforme(table,ligne){
  var t=TABLES[table]||{},o={};
  Object.keys(ligne).forEach(function(k){
    if(k==="extra")return;
    o[versCamel(k)]=ligne[k];
  });
  if(ligne.extra&&typeof ligne.extra==="object"){
    Object.keys(ligne.extra).forEach(function(k){o[k]=ligne.extra[k]});
  }
  if(t.enveloppe&&ligne[t.enveloppe]&&typeof ligne[t.enveloppe]==="object"){
    Object.keys(ligne[t.enveloppe]).forEach(function(k){o[k]=ligne[t.enveloppe][k]});
    delete o[versCamel(t.enveloppe)];
  }
  if(t.cle!=="id")o.id=ligne[t.cle];
  return o;
}
/* ---------- écriture : l'objet attendu redevient une ligne ---------- */
function versBase(table,obj){
  var t=TABLES[table]||{},l={},ex={};
  if(t.enveloppe){
    var v={};
    Object.keys(obj).forEach(function(k){if(k!=="id")v[k]=obj[k]});
    l[t.cle]=obj.id;l[t.enveloppe]=v;
    return l;
  }
  Object.keys(obj).forEach(function(k){
    if(k==="id"&&t.cle!=="id")return;
    if(t.extra&&t.extra.indexOf(k)>=0){ex[k]=obj[k];return}
    l[versSnake(k)]=obj[k];
  });
  if(t.extra)l.extra=ex;
  if(t.cle!=="id"&&obj.id!=null)l[t.cle]=obj.id;
  return l;
}

/* ---------- l'appel HTTP ---------- */
function sbEntetes(extra){
  var h={"apikey":SB.cle,"Authorization":"Bearer "+(SB.jeton||SB.cle)};
  if(extra)Object.keys(extra).forEach(function(k){h[k]=extra[k]});
  return h;
}
function sbFetch(chemin,options){
  options=options||{};
  options.headers=sbEntetes(options.headers);
  return fetch(SB.url+chemin,options).then(function(r){
    if(r.status===204)return null;
    return r.text().then(function(txt){
      var corps=null;
      try{corps=txt?JSON.parse(txt):null}catch(e){corps=txt}
      if(!r.ok){
        var e=new Error((corps&&corps.message)||("erreur "+r.status));
        e.code=r.status;e.detail=corps&&corps.details;
        throw e;
      }
      return corps;
    });
  });
}

/* ---------- le `db` que la plateforme croit utiliser ---------- */
function faireDb(){
  return {
    collection:function(nom){
      return {
        /* la plateforme s'abonne ; ici on lit une fois, et on relit
           après chaque écriture — le volume ne justifie pas mieux. */
        onSnapshot:function(ok,ko){
          ABONNES[nom]={ok:ok,ko:ko};
          return rafraichir(nom);
        },
        add:function(obj){
          return sbFetch("/rest/v1/"+nom,{method:"POST",
            headers:{"Content-Type":"application/json","Prefer":"return=representation"},
            body:JSON.stringify(versBase(nom,obj))})
            .then(function(r){
              var cree=(r&&r[0])||{};
              return rafraichir(nom).then(function(){
                return {id:cree[(TABLES[nom]||{}).cle||"id"]};
              });
            });
        }
      };
    },
    doc:function(chemin){
      var p=String(chemin).split("/"),nom=p[0],id=p.slice(1).join("/");
      var t=TABLES[nom]||{cle:"id"};
      var filtre="?"+t.cle+"=eq."+encodeURIComponent(id);
      return {
        set:function(obj){
          var ligne=versBase(nom,Object.assign({},obj,{id:id}));
          return sbFetch("/rest/v1/"+nom,{method:"POST",
            headers:{"Content-Type":"application/json",
              "Prefer":"resolution=merge-duplicates,return=minimal"},
            body:JSON.stringify(ligne)})
            .then(function(){return rafraichir(nom)});
        },
        update:function(patch){
          return sbFetch("/rest/v1/"+nom+filtre,{method:"PATCH",
            headers:{"Content-Type":"application/json","Prefer":"return=minimal"},
            body:JSON.stringify(versBase(nom,patch))})
            .then(function(){return rafraichir(nom)});
        },
        delete:function(){
          return sbFetch("/rest/v1/"+nom+filtre,{method:"DELETE",
            headers:{"Prefer":"return=minimal"}})
            .then(function(){return rafraichir(nom)});
        }
      };
    }
  };
}

var ABONNES={};
function rafraichir(nom){
  var ordre={demandes:"recu.desc",interventions:"date_inter.desc",devis:"date_devis.desc"}[nom];
  return sbFetch("/rest/v1/"+nom+"?select=*"+(ordre?"&order="+ordre:""))
    .then(function(lignes){
      DATA[nom]=(lignes||[]).map(function(l){return versPlateforme(nom,l)});
      if(nom==="photos"||nom==="demandes"||nom==="interventions")recollerPhotos();
      ready=true;
      if(typeof paint==="function")paint();
    })
    .catch(function(e){
      console.warn("lecture "+nom,e&&e.message);
      DATA[nom]=DATA[nom]||[];
      ready=true;
      if(typeof paint==="function")paint();
    });
}
function toutRelire(){
  return Promise.all(Object.keys(DATA).map(rafraichir)).then(recollerPhotos);
}
/* Les photos ont leur propre table ; les écrans, eux, les cherchent dans
   la demande et dans l'intervention. On les y remet après chaque lecture :
   une jointure de plus ici, zéro ligne à changer dans les vues. */
function recollerPhotos(){
  var avant={},apres={};
  (DATA.photos||[]).forEach(function(ph){
    var d=(ph.moment==="apres")?apres:avant;
    (d[ph.demandeId]=d[ph.demandeId]||[]).push(ph);
  });
  (DATA.demandes||[]).forEach(function(d){d.photos=avant[d.id]||[]});
  (DATA.interventions||[]).forEach(function(i){i.photosApres=apres[i.demandeId]||[]});
}

/* ---------- la connexion ---------- */
function sbConnexion(email,motdepasse){
  return fetch(SB.url+"/auth/v1/token?grant_type=password",{
      method:"POST",headers:{"apikey":SB.cle,"Content-Type":"application/json"},
      body:JSON.stringify({email:email,password:motdepasse})})
    .then(function(r){return r.json().then(function(j){
      if(!r.ok)throw new Error(j.error_description||j.msg||"identifiants refusés");
      return j;
    })});
}
function sbMotDePasseOublie(email){
  return fetch(SB.url+"/auth/v1/recover",{
    method:"POST",headers:{"apikey":SB.cle,"Content-Type":"application/json"},
    body:JSON.stringify({email:email})});
}
function sbMonProfil(){
  return sbFetch("/rest/v1/profils?select=id,role,client_id,nom")
    .then(function(l){return (l&&l[0])||null});
}
function sbDeconnexion(){
  try{localStorage.removeItem("vds-jeton")}catch(e){}
  SB.jeton=null;SB.moi=null;
}
function sbReprendre(){
  try{
    var brut=localStorage.getItem("vds-jeton");
    if(!brut)return null;
    var j=JSON.parse(brut);
    if(!j||!j.access_token)return null;
    if(j.expire&&Date.now()>j.expire)return null;
    return j;
  }catch(e){return null}
}
function sbGarder(j){
  try{
    localStorage.setItem("vds-jeton",JSON.stringify({
      access_token:j.access_token,refresh_token:j.refresh_token,
      expire:Date.now()+((j.expires_in||3600)-60)*1000
    }));
  }catch(e){}
}

/* ---------- les fichiers ---------- */
function sbEnvoyerFichier(casier,chemin,fichier){
  return fetch(SB.url+"/storage/v1/object/"+casier+"/"+chemin,{
      method:"POST",headers:sbEntetes({"Content-Type":fichier.type||"application/octet-stream"}),
      body:fichier})
    .then(function(r){
      if(!r.ok)return r.text().then(function(t){throw new Error("envoi refusé : "+t)});
      return chemin;
    });
}
/* un lien valable une heure : le casier reste privé */
function sbLienSigne(casier,chemin){
  return sbFetch("/storage/v1/object/sign/"+casier+"/"+chemin,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({expiresIn:3600})})
    .then(function(j){return SB.url+"/storage/v1"+j.signedURL});
}
function sbSupprimerFichier(casier,chemin){
  return sbFetch("/storage/v1/object/"+casier+"/"+chemin,{method:"DELETE"});
}
