// The server writes links into replies and reduces them to labels for the
// voice, so the page must read them the same way: one implementation.
export { parseLinks, stripLinks, type Segment } from '../../server/links';
