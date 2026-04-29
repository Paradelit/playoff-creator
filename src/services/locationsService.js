import { httpsCallable, getFunctions } from 'firebase/functions';

let _functions;
function getFns() {
  if (!_functions) _functions = getFunctions();
  return _functions;
}

export async function resolveMapsUrlClient(shortUrl) {
  const fn = httpsCallable(getFns(), 'resolveMapsUrl');
  const res = await fn({ shortUrl });
  return res.data; // { resolvedUrl, placeName }
}
