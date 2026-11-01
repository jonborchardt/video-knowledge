// The text of a social post, composed by code from the approved title, the public URL and the disclosure (spec §5.6,
// §12): packaging shows it in the release manifest and the social module posts the same words. Pure; no import.

/** X's limit, and what X counts any URL as. */
export const POST_MAX = 280;
export const URL_LENGTH = 23;
const ELLIPSIS = '…';

/** `<title>\n\n<url>\n\n<disclosure>`, within 280 counting the URL as 23; a title too long is cut at a word boundary
 *  with an ellipsis; the disclosure is said once and never cut. */
export function composePost(title: string, url: string, disclosure: string): string {
  const fixed = URL_LENGTH + 4 + disclosure.length; // the two blank lines and the URL as X counts it
  const room = POST_MAX - fixed;
  let t = title.trim();
  if (t.length > room) {
    const cut = t.slice(0, room - 1);
    const at = cut.lastIndexOf(' ');
    t = (at > room / 2 ? cut.slice(0, at) : cut).trimEnd() + ELLIPSIS;
  }
  return `${t}\n\n${url}\n\n${disclosure}`;
}

/** The length X counts: every URL as 23 characters. */
export const postLength = (text: string): number => text.replace(/https?:\/\/\S+/g, 'x'.repeat(URL_LENGTH)).length;
