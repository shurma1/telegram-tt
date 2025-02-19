import EMOJI_REGEX from '../lib/twemojiRegex';

export enum NodeType {
  Text = 'Text',
  Emoji = 'Emoji',

  Bold = 'MessageEntityBold',
  Blockquote = 'MessageEntityBlockquote',
  BotCommand = 'MessageEntityBotCommand',
  Cashtag = 'MessageEntityCashtag',
  Code = 'MessageEntityCode',
  Email = 'MessageEntityEmail',
  Hashtag = 'MessageEntityHashtag',
  Italic = 'MessageEntityItalic',
  MentionName = 'MessageEntityMentionName',
  Mention = 'MessageEntityMention',
  Phone = 'MessageEntityPhone',
  Pre = 'MessageEntityPre',
  Strike = 'MessageEntityStrike',
  TextUrl = 'MessageEntityTextUrl',
  Url = 'MessageEntityUrl',
  Underline = 'MessageEntityUnderline',
  Spoiler = 'MessageEntitySpoiler',
  CustomEmoji = 'MessageEntityCustomEmoji',
  Unknown = 'MessageEntityUnknown',
}

interface ASTNodeBase {
  type: NodeType;
  children?: ASTNode[];
}

export interface TextNode extends ASTNodeBase {
  type: NodeType.Text;
  content: string;
}

export interface FormattedNode extends ASTNodeBase {
  type:
  | NodeType.Bold
  | NodeType.Italic
  | NodeType.Underline
  | NodeType.Strike
  | NodeType.Spoiler;
}

export interface LinkNode extends ASTNodeBase {
  type: NodeType.Url | NodeType.TextUrl;
  url?: string;
}

export interface CodeNode extends ASTNodeBase {
  type: NodeType.Code;
  content: string;
}

export interface PreNode extends ASTNodeBase {
  type: NodeType.Pre;
  language?: string;
  content: string;
}

export interface MentionNode extends ASTNodeBase {
  type: NodeType.Mention | NodeType.MentionName;
  userId?: string;
}

export interface CustomEmojiNode extends ASTNodeBase {
  type: NodeType.CustomEmoji;
  documentId: string;
  content: string;
}

export interface BlockquoteNode extends ASTNodeBase {
  type: NodeType.Blockquote;
  canCollapse?: boolean;
}

export interface EmojiNode extends ASTNodeBase {
  type: NodeType.Emoji;
  content: string;
}

export interface StringEntityNode extends ASTNodeBase {
  type:
  | NodeType.Hashtag
  | NodeType.Cashtag
  | NodeType.Phone
  | NodeType.BotCommand
  | NodeType.Email;
}

export type ASTNode =
  | TextNode
  | FormattedNode
  | LinkNode
  | CodeNode
  | PreNode
  | MentionNode
  | CustomEmojiNode
  | BlockquoteNode
  | EmojiNode
  | StringEntityNode;

export const ENTITY_CLASS_BY_NODE_NAME: Record<string, NodeType> = {
  B: NodeType.Bold,
  STRONG: NodeType.Bold,
  H1: NodeType.Bold,
  H2: NodeType.Bold,
  H3: NodeType.Bold,
  H4: NodeType.Bold,
  H5: NodeType.Bold,
  H6: NodeType.Bold,

  I: NodeType.Italic,
  EM: NodeType.Italic,

  INS: NodeType.Underline,
  U: NodeType.Underline,

  S: NodeType.Strike,
  STRIKE: NodeType.Strike,
  DEL: NodeType.Strike,

  CODE: NodeType.Code,

  PRE: NodeType.Pre,

  BLOCKQUOTE: NodeType.Blockquote,

  A: NodeType.TextUrl,

  SPAN: NodeType.Spoiler,
};

const MAX_TAG_DEEPNESS = 5;

export function parseHtmlAsAST(html: string): ASTNode[] {
  const fragment = document.createElement('div');
  fragment.innerHTML = html;
  return Array.from(fragment.childNodes)
    .map((node) => parseNode(node))
    .flat()
    // eslint-disable-next-line no-null/no-null
    .filter((node) => node !== null) as ASTNode[];
}

function parseNode(rootNode: ChildNode): ASTNode[] {
  const stack: { node: ChildNode; depth: number }[] = [{ node: rootNode, depth: 0 }];
  const result: ASTNode[] = [];

  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;

    if (node.nodeType === Node.COMMENT_NODE || depth > MAX_TAG_DEEPNESS) {
      continue;
    }

    if (node.nodeType === Node.TEXT_NODE || (node as HTMLElement).tagName === 'BR') {
      const content = (node as HTMLElement).tagName === 'BR' ? '\n' : node.textContent || '';
      if (content) {
        result.push({
          type: NodeType.Text,
          content,
        });
      }
      continue;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const type = getNodeType(element);

      switch (type) {
        case NodeType.Blockquote:
        case NodeType.Underline:
        case NodeType.Strike:
        case NodeType.Spoiler:
        case NodeType.Italic:
        case NodeType.Bold: {
          result.push({
            type,
            children: Array.from(element.childNodes)
              .map((child) => parseNode(child))
              .flat(),
          });
          break;
        }
        case NodeType.TextUrl: {
          result.push({
            type: NodeType.TextUrl,
            url: element.getAttribute('href') || '',
            children: Array.from(element.childNodes)
              .map((child) => parseNode(child))
              .flat(),
          });
          break;
        }
        case NodeType.Pre: {
          result.push({
            type: NodeType.Pre,
            content: element.textContent || '',
            language: element.getAttribute('data-language') || '',
          });
          break;
        }
        case NodeType.Code: {
          result.push({
            type: NodeType.Code,
            content: element.textContent || '',
          });
          break;
        }
        case NodeType.CustomEmoji: {
          result.push({
            type: NodeType.CustomEmoji,
            documentId: element.getAttribute('data-document-id') || '',
            content: element.getAttribute('alt') || '  ',
          });
          break;
        }
        case NodeType.Emoji: {
          result.push({
            type: NodeType.Emoji,
            content: element.getAttribute('alt') || '',
          });
          break;
        }
        default:
          Array.from(element.childNodes).reverse().forEach((child) => {
            stack.push({ node: child, depth: depth + 1 });
          });
          break;
      }
    }
  }

  return result;
}

function getNodeType(element: HTMLElement): NodeType | undefined {
  if (isEmojiNode(element)) {
    (element as HTMLImageElement).src = '';
    if (element.getAttribute('data-document-id')) {
      return NodeType.CustomEmoji;
    }
    return NodeType.Emoji;
  }

  return ENTITY_CLASS_BY_NODE_NAME[element.tagName];
}

function isEmojiNode(element: HTMLElement) {
  if (element.tagName !== 'IMG') {
    return false;
  }
  return (element as HTMLImageElement).alt.length === 2 && (element as HTMLImageElement).alt.match(EMOJI_REGEX);
}
