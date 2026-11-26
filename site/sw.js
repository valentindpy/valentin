/* =====================================================================
   VD SERVICES — le service worker du formulaire

   Il existe pour une raison précise, écrite dans la note de conception :
   le formulaire s'ouvre sur un téléphone en 4G, dans un hall ou une
   cave. Sans lui, un réseau qui tombe donne une page blanche. Avec lui,
   la dernière version connue s'affiche quand même.

   Deux règles, et pas une de plus :

     navigation   le réseau d'abord. Une page servie depuis le cache
                  pourrait annoncer un numéro d'astreinte périmé, et
                  cela coûte plus cher qu'une seconde d'attente. Le
                  cache ne sert que si le réseau ne répond pas.

     le reste     le cache d'abord, le réseau derrière pour la fois
                  suivante. Ce sont les fontes, les icônes, le favicon :
                  rien qui change d'un jour à l'autre.

   Ce qui n'est jamais touché : les requêtes qui ne sont pas des GET.
   Le dépôt d'une demande part en POST vers la base, il doit échouer
   franchement quand le réseau manque — le formulaire bascule alors sur
   l'envoi par messagerie, et le demandeur le voit.
   ===================================================================== */

const CACHE = "vds-coquille-3";   /* changé avec les langues */

/* La coquille : ce qu'il faut avoir sous la main pour afficher le
   formulaire sans réseau. Les fontes viennent s'y ajouter à l'usage. */
const COQUILLE = [
  "/formulaire",
  "/en/form",
  "/manifest.webmanifest",
  "/en/manifest.webmanifest",
  "/favicon.svg",
  "/icones/icone-192.png",
  /* les fontes sont servies par le domaine depuis qu'elles ont changé :
     sans elles dans la coquille, le formulaire s'ouvrirait hors réseau
     dans la fonte de secours, et n'aurait plus l'air de la maison */
  "/polices/polices.css",
  "/polices/inter-latin.woff2",
  "/polices/source-serif-latin.woff2",
];

self.addEventListener("install", (ev) => {
  /* Un par un, et chacun avec son filet : addAll abandonne tout le lot
     des qu'une seule adresse repond de travers — une redirection, un
     fichier renomme — et on se retrouverait sans coquille du tout. */
  ev.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(COQUILLE.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const memeOrigine = url.origin === self.location.origin;
  const fonte = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!memeOrigine && !fonte) return;        /* la base de données, jamais */

  /* --- une page : le réseau d'abord --- */
  if (req.mode === "navigate") {
    ev.respondWith(
      fetch(req)
        .then((rep) => {
          const copie = rep.clone();
          caches.open(CACHE).then((c) => c.put(req, copie)).catch(() => {});
          return rep;
        })
        /* ignoreSearch : les raccourcis de l'ecran d'accueil ouvrent
           /formulaire?besoin=urgence. Sans cela, hors reseau, chacun
           manquerait le cache pour une question de point d'interrogation. */
        /* Le repli reste dans la langue demandee : un anglophone hors
           reseau doit retomber sur /en/form, pas sur le formulaire
           francais — il ne saurait pas le remplir. */
        .catch(() => {
          const p = url.pathname;
          const replis = p === "/en" || p.startsWith("/en/")
            ? ["/en/form", "/en/form/", "/formulaire"]
            : ["/formulaire", "/formulaire/"];
          return replis.reduce(
            (chaine, adr) => chaine.then(
              (c) => c || caches.match(adr, { ignoreSearch: true })),
            caches.match(req, { ignoreSearch: true }));
        }),
    );
    return;
  }

  /* --- le reste : le cache d'abord --- */
  ev.respondWith(
    caches.match(req).then((cache) => {
      const reseau = fetch(req)
        .then((rep) => {
          if (rep && (rep.ok || rep.type === "opaque")) {
            const copie = rep.clone();
            caches.open(CACHE).then((c) => c.put(req, copie)).catch(() => {});
          }
          return rep;
        })
        .catch(() => cache);
      return cache || reseau;
    }),
  );
});
