export const restoreSelectionByOffsets = (
  contentEditableRef: React.RefObject<HTMLDivElement>,
  start: number,
  end: number,
) => {
  const contentEditable = contentEditableRef.current;
  if (!contentEditable) return;

  const nodes: (Text | HTMLBRElement)[] = [];
  const walker = document.createTreeWalker(
    contentEditable,
    // eslint-disable-next-line no-bitwise
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return NodeFilter.FILTER_ACCEPT;
        } else if (
          (node.nodeType === Node.ELEMENT_NODE)
          && ((node as Element).tagName === 'BR' || (node as Element).tagName === 'IMG')
        ) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    },
  );

  // eslint-disable-next-line no-null/no-null
  let currentNode: Node | null = null;
  // eslint-disable-next-line no-cond-assign
  while ((currentNode = walker.nextNode())) {
    nodes.push(currentNode as Text | HTMLBRElement);
  }

  let currentOffset = 0;
  const nodeEntries: Array<{
    node: Text | HTMLBRElement;
    start: number;
    end: number;
  }> = [];

  for (const node of nodes) {
    const length = node.nodeType === Node.TEXT_NODE
      ? node.textContent?.length || 0
      : (node as HTMLElement).tagName === 'IMG'
        ? 2
        : 1;
    nodeEntries.push({
      node,
      start: currentOffset,
      end: currentOffset + length,
    });
    currentOffset += length;
  }

  const totalLength = currentOffset;
  const clampedStart = Math.min(start, totalLength);
  const clampedEnd = Math.min(end, totalLength);

  let startNodeEntry = nodeEntries.find(
    (entry) => clampedStart >= entry.start && clampedStart < entry.end,
  );
  let endNodeEntry = nodeEntries.find(
    (entry) => clampedEnd >= entry.start && clampedEnd < entry.end,
  );

  if (!startNodeEntry && nodeEntries.length) {
    startNodeEntry = nodeEntries[nodeEntries.length - 1];
  }
  if (!endNodeEntry && nodeEntries.length) {
    endNodeEntry = nodeEntries[nodeEntries.length - 1];
  }

  if (!startNodeEntry || !endNodeEntry) return;

  const startOffsetInNode = clampedStart - startNodeEntry.start;
  const endOffsetInNode = clampedEnd - endNodeEntry.start;

  const getContainerAndOffset = (
    entry: typeof nodeEntries[number],
    offsetInNode: number,
  ) => {
    if (entry.node.nodeType === Node.TEXT_NODE) {
      return { container: entry.node, offset: offsetInNode };
    } else {
      const parent = entry.node.parentNode;
      // eslint-disable-next-line no-null/no-null
      if (!parent) return null;
      const index = Array.from(parent.childNodes).indexOf(entry.node);
      return {
        container: parent,
        offset: index + (offsetInNode > 0 ? 1 : 0),
      };
    }
  };

  const startPos = getContainerAndOffset(startNodeEntry, startOffsetInNode);
  const endPos = getContainerAndOffset(endNodeEntry, endOffsetInNode);

  if (!startPos || !endPos) return;

  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  try {
    range.setStart(startPos.container, startPos.offset);
    range.setEnd(endPos.container, endPos.offset);
  } catch (e) {
    return;
  }

  selection.removeAllRanges();
  selection.addRange(range);
};
