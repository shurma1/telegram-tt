const protocolRegex = /^(https?:|tg:|ton:|mailto:|tel:)/;
const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w.-]*)*\/?(\?[^\s#]*)?(#\S*)?$/;
const tgTonRegex = /^(tg|ton):\/\/[a-zA-Z0-9?=]+$/;
const mailtoRegex = /^mailto:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const telRegex = /^tel:\+?[0-9]{1,3}[0-9]{4,14}$/;

enum ProtocolSupport {
  HTTPS = 'https:',
  HTTP = 'http:',
  TG = 'tg:',
  TON = 'ton:',
  MAILTO = 'mailto:',
  TEL = 'tel:',
}
const defaultProtocol = 'https:';

export function URLValidate(url: string): boolean {
  // eslint-disable-next-line no-null/no-null
  let protocol: ProtocolSupport | null = null;
  const match = url.match(protocolRegex);
  if (match) {
    if (match.length) {
      protocol = match[0] as ProtocolSupport;
    }
  }
  if (!protocol && url.includes('://')) {
    return false;
  }

  if (!protocol) {
    protocol = defaultProtocol as ProtocolSupport;
  }

  switch (protocol) {
    case ProtocolSupport.HTTPS:
    case ProtocolSupport.HTTP: {
      return urlRegex.test(url);
    }
    case ProtocolSupport.TG:
    case ProtocolSupport.TON: {
      return tgTonRegex.test(url);
    }
    case ProtocolSupport.MAILTO: {
      return mailtoRegex.test(url);
    }
    case ProtocolSupport.TEL: {
      return telRegex.test(url);
    }
    default: {
      return false;
    }
  }
}
