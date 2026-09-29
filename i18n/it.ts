/** Italian texts of the interface; its keys are the keys of every dictionary. */
export const it = {
  'app.name': 'News App',
  'news.updatedAtTime': 'Aggiornato alle {time}',
  'news.updatedAtDate': 'Aggiornato il {dateTime}',
  'news.refresh': 'Aggiorna',
  'language.italian': 'Italiano',
  'language.english': 'Inglese',
  'categories.italy': 'Italia',
  'categories.usa': 'USA',
  'states.loading': 'Caricamento notizie...',
  'states.empty': 'Nessuna notizia disponibile',
  'states.retry': 'Riprova',
  'states.close': 'Chiudi',
  'errors.network': 'Connessione assente. Controlla la rete e riprova.',
  'errors.timeout': 'Il server non risponde. Riprova.',
  'errors.auth': 'Chiave API mancante o non valida. Controlla il file .env.',
  'errors.rateLimit': 'Limite di richieste raggiunto. Riprova più tardi.',
  'errors.badRequest': "Richiesta non valida. Controlla la configurazione dell'app.",
  'errors.server': 'Il servizio notizie non è disponibile. Riprova più tardi.',
  'errors.unknown': 'Si è verificato un errore imprevisto.',
  'errors.openArticle': "Impossibile aprire l'articolo.",
  'card.a11y': 'Apri notizia: {title}, {source}',
};

export type TranslationKey = keyof typeof it;

/** A dictionary has exactly the keys of the Italian one, so a missing or extra text fails the type check. */
export type Dictionary = Record<TranslationKey, string>;
