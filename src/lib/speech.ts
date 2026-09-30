// The server splits replies the same way to prepare clips before the page asks
// for them, so both sides must agree on every chunk: one implementation.
export { splitForSpeech } from '../../server/speech';
