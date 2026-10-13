export const requestDeletionBlockSql=`CASE
  WHEN EXISTS (SELECT 1 FROM availability_requests child WHERE child.source_request_id=r.id) THEN 'linked'
  WHEN EXISTS (SELECT 1 FROM checkin_practices p WHERE p.request_id=r.id AND (p.state IN ('sending','sent') OR p.sent_at IS NOT NULL OR p.send_attempted_at IS NOT NULL))
    OR EXISTS (SELECT 1 FROM alloggiati_receipt_links l WHERE l.request_id=r.id)
    OR EXISTS (SELECT 1 FROM availability_events e WHERE e.request_id=r.id AND (e.event_type='alloggiati_sent' OR (e.event_type='alloggiati_send_resolved' AND e.to_status='police_registered')))
  THEN 'submitted' ELSE NULL END`;

export const requestDeletionMessages={
  linked:"Questa richiesta ha altre pratiche collegate. Elimina prima quelle inserite per errore; le altre non verranno cancellate automaticamente.",
  submitted:"La pratica ha un invio Alloggiati Web eseguito o da verificare, oppure una ricevuta archiviata. Non può essere eliminata da questa funzione.",
  changed:"La richiesta è stata aggiornata dopo l’apertura della scheda. Ricarica la pagina e controlla i dati prima di eliminarla.",
};

export function isRequestAttachment(key,requestId){
  if(typeof key!=="string"||!/^[-\w]+$/.test(requestId))return false;
  const prefixes=[`${requestId}/`,`identity-documents/${requestId}/`];
  return prefixes.some(prefix=>key.startsWith(prefix)&&/^[-\w]+\.(pdf|png|jpe?g)$/i.test(key.slice(prefix.length)));
}

export async function removeRequestAttachments(keys,requestId,remove){
  const failed=[];
  for(const key of new Set(keys)){
    if(!isRequestAttachment(key,requestId)){failed.push(key);continue;}
    try{await remove(key);}catch{try{await remove(key);}catch{failed.push(key);}}
  }
  return failed;
}
