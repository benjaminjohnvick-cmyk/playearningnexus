// Lets a converted function `export default __handler(async (req) => {...})`.
// __handler is an identity wrapper so the router can import the default handler.
export const __handler = <T>(fn: T): T => fn;
