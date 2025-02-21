import type { FC, RefObject, StateHookSetter } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import type { IAnchorPosition } from '../../../types';
import type { ISelectedTextFormats } from '../../../util/astEditor';
import type { SelectionOffsets } from '../../../util/getSelectionRelativeElement';
import type { ASTNode } from '../../../util/parseHtmlAsAST';
import type { History } from '../../common/Composer';

import {
  applyStylesToAst,
  ASTStyles,
  getAstStylesForSelection,
} from '../../../util/astEditor';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { ensureProtocol } from '../../../util/ensureProtocol';
import getKeyFromEvent from '../../../util/getKeyFromEvent';
import { getSelectionRelativeElement } from '../../../util/getSelectionRelativeElement';
import { restoreSelectionByOffsets } from '../../../util/restoreSelectionByOffsets';
import stopEvent from '../../../util/stopEvent';
import { URLValidate } from '../../../util/URLValidate';
import { IS_ANDROID, IS_IOS } from '../../../util/windowEnvironment';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';
import useVirtualBackdrop from '../../../hooks/useVirtualBackdrop';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import './TextFormatter.scss';

export type OwnProps = {
  isOpen: boolean;
  anchorPosition?: IAnchorPosition;
  selectedRange?: Range;
  setSelectedRange: (range: Range) => void;
  getAST: () => ASTNode[];
  setAST: (ast: ASTNode[]) => void;
  getJsonAST: () => string;
  getHtml: () => string;
  onClose: () => void;
  inputRef: RefObject<HTMLDivElement | null>;
  setStyleEditing: StateHookSetter<boolean>;
  isStyleEditing: boolean;
  addAstToHistory: (ast: ASTNode[], selection?: SelectionOffsets) => void;
  history: History;
  setHistorySelection: StateHookSetter<SelectionOffsets | null>;
  historySelection: SelectionOffsets | null;
};

const TextFormatter: FC<OwnProps> = ({
  isOpen,
  anchorPosition,
  selectedRange,
  onClose,
  getAST,
  setAST,
  setStyleEditing,
  isStyleEditing,
  getHtml,
  inputRef,
  addAstToHistory,
  history,
  setHistorySelection,
  historySelection,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen);
  const [isLinkControlOpen, openLinkControl, closeLinkControl] = useFlag();
  const [linkUrl, setLinkUrl] = useState('');
  const [inputClassName, setInputClassName] = useState<string | undefined>();
  // eslint-disable-next-line no-null/no-null
  const [selectedTextRelativeInput, setSelectedTextRelativeInput] = useState<SelectionOffsets | null>(null);
  const [selectedTextFormats, setSelectedTextFormats] = useState<ISelectedTextFormats>({});

  useEffect(() => (isOpen ? captureEscKeyListener(onClose) : undefined), [isOpen, onClose]);
  useVirtualBackdrop(
    isOpen,
    containerRef,
    onClose,
    true,
  );

  useEffect(() => {
    if (isLinkControlOpen) {
      linkUrlInputRef.current!.focus();
    } else {
      setLinkUrl(selectedTextFormats.textlinkhref || '');
    }
  }, [isLinkControlOpen, selectedTextFormats]);

  useEffect(() => {
    if (!shouldRender) {
      closeLinkControl();
      setSelectedTextFormats({});
      setInputClassName(undefined);
    }
  }, [closeLinkControl, shouldRender]);

  useEffect(() => {
    if (!selectedRange || !inputRef.current) {
      // eslint-disable-next-line no-null/no-null
      setSelectedTextRelativeInput(null);
      return;
    }

    const offsets = getSelectionRelativeElement(inputRef.current, selectedRange);
    if (!offsets) {
      // eslint-disable-next-line no-null/no-null
      setSelectedTextRelativeInput(null);
      return;
    }
    setSelectedTextRelativeInput(offsets);
  }, [selectedRange]);

  useEffect(() => {
    if (!isOpen || !selectedTextRelativeInput) {
      return;
    }

    const selectionAttributes = getAstStylesForSelection(
      getAST(),
      selectedTextRelativeInput.start,
      selectedTextRelativeInput.end - selectedTextRelativeInput.start,
    );

    setSelectedTextFormats(selectionAttributes);
  }, [isOpen, selectedTextRelativeInput, openLinkControl]);

  const moveCursorToEnd = (input: HTMLDivElement) => {
    const range = document.createRange();
    const selection = window.getSelection()!;

    range.selectNodeContents(input);
    range.collapse(false);

    selection.removeAllRanges();
    selection.addRange(range);

    if (IS_ANDROID || IS_IOS) {
      input.blur();
      input.focus();
    }
  };

  useEffect(() => {
    if (!inputRef.current) {
      return;
    }

    if (history.isUndo) {
      if (historySelection) {
        restoreSelectionByOffsets(
          inputRef as RefObject<HTMLDivElement>,
          historySelection.start,
          historySelection.end,
        );
        // eslint-disable-next-line no-null/no-null
        setHistorySelection(null);
      } else {
        moveCursorToEnd(inputRef.current);
        onClose();
      }
      return;
    }

    if (!selectedTextRelativeInput || !isStyleEditing) {
      return;
    }

    restoreSelectionByOffsets(
      inputRef as RefObject<HTMLDivElement>,
      selectedTextRelativeInput.start,
      selectedTextRelativeInput.end,
    );
  }, [getHtml]);

  function updateInputStyles() {
    const input = linkUrlInputRef.current;
    if (!input) {
      return;
    }

    const { offsetWidth, scrollWidth, scrollLeft } = input;
    if (scrollWidth <= offsetWidth) {
      setInputClassName(undefined);
      return;
    }

    let className = '';
    if (scrollLeft < scrollWidth - offsetWidth) {
      className = 'mask-right';
    }
    if (scrollLeft > 0) {
      className += ' mask-left';
    }

    setInputClassName(className);
  }

  function handleLinkUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLinkUrl(e.target.value);
    updateInputStyles();
  }

  // eslint-disable-next-line @typescript-eslint/no-shadow
  function getFormatButtonClassName(selectedTextFormats: ISelectedTextFormats, key: keyof ISelectedTextFormats) {
    if (selectedTextFormats[key]) {
      return 'active';
    }

    if (key === 'textlinkhref' && !!selectedTextFormats[key]?.length) {
      return 'active';
    }

    if (key === 'monospace') {
      if (Object.keys(selectedTextFormats).some(
        (fKey) => fKey !== key && Boolean(selectedTextFormats[fKey as keyof ISelectedTextFormats]),
      )) {
        return 'disabled';
      }
    } else if (selectedTextFormats.monospace) {
      return 'disabled';
    }

    return undefined;
  }

  const handleSpoilerText = useLastCallback(() => {
    if (!selectedTextRelativeInput) {
      return;
    }
    setStyleEditing(true);

    setSelectedTextFormats((selectedFormats) => {
      const newAst = applyStylesToAst(
        getAST(),
        selectedTextRelativeInput.start,
        selectedTextRelativeInput.end - selectedTextRelativeInput.start,
        ASTStyles.Spoiler,
        !!selectedFormats.spoiler,
      );
      setAST(newAst);
      addAstToHistory(newAst, selectedTextRelativeInput);
      return {
        ...selectedFormats,
        spoiler: !selectedFormats.spoiler,
      };
    });
    onClose();
  });

  const handleBoldText = useLastCallback(() => {
    if (!selectedTextRelativeInput) {
      return;
    }
    setStyleEditing(true);

    setSelectedTextFormats((selectedFormats) => {
      const newAst = applyStylesToAst(
        getAST(),
        selectedTextRelativeInput.start,
        selectedTextRelativeInput.end - selectedTextRelativeInput.start,
        ASTStyles.Bold,
        !!selectedFormats.bold,
      );
      setAST(newAst);
      addAstToHistory(newAst, selectedTextRelativeInput);
      return {
        ...selectedFormats,
        bold: !selectedFormats.bold,
      };
    });
  });

  const handleItalicText = useLastCallback(() => {
    if (!selectedTextRelativeInput) {
      return;
    }
    setStyleEditing(true);

    setSelectedTextFormats((selectedFormats) => {
      const newAst = applyStylesToAst(
        getAST(),
        selectedTextRelativeInput.start,
        selectedTextRelativeInput.end - selectedTextRelativeInput.start,
        ASTStyles.Italic,
        !!selectedFormats.italic,
      );
      setAST(newAst);
      addAstToHistory(newAst, selectedTextRelativeInput);
      return {
        ...selectedFormats,
        italic: !selectedFormats.italic,
      };
    });
  });

  const handleUnderlineText = useLastCallback(() => {
    if (!selectedTextRelativeInput) {
      return;
    }
    setStyleEditing(true);

    setSelectedTextFormats((selectedFormats) => {
      const newAst = applyStylesToAst(
        getAST(),
        selectedTextRelativeInput.start,
        selectedTextRelativeInput.end - selectedTextRelativeInput.start,
        ASTStyles.Underline,
        !!selectedFormats.underline,
      );
      setAST(newAst);
      addAstToHistory(newAst, selectedTextRelativeInput);
      return {
        ...selectedFormats,
        underline: !selectedFormats.underline,
      };
    });
  });

  const handleStrikethroughText = useLastCallback(() => {
    if (!selectedTextRelativeInput) {
      return;
    }
    setStyleEditing(true);

    setSelectedTextFormats((selectedFormats) => {
      const newAst = applyStylesToAst(
        getAST(),
        selectedTextRelativeInput.start,
        selectedTextRelativeInput.end - selectedTextRelativeInput.start,
        ASTStyles.Strike,
        !!selectedFormats.strikethrough,
      );
      setAST(newAst);
      addAstToHistory(newAst, selectedTextRelativeInput);
      return {
        ...selectedFormats,
        strikethrough: !selectedFormats.strikethrough,
      };
    });
  });

  const handleQuoteText = useLastCallback(() => {
    if (!selectedTextRelativeInput) {
      return;
    }
    setStyleEditing(true);

    setSelectedTextFormats((selectedFormats) => {
      const newAst = applyStylesToAst(
        getAST(),
        selectedTextRelativeInput.start,
        selectedTextRelativeInput.end - selectedTextRelativeInput.start,
        ASTStyles.Blockquote,
        !!selectedFormats.quote,
      );
      setAST(newAst);
      addAstToHistory(newAst, selectedTextRelativeInput);
      return {
        ...selectedFormats,
        quote: !selectedFormats.quote,
      };
    });
  });

  const handleMonospaceText = useLastCallback(() => {
    if (!selectedTextRelativeInput) {
      return;
    }
    setStyleEditing(true);

    setSelectedTextFormats((selectedFormats) => {
      const newAst = applyStylesToAst(
        getAST(),
        selectedTextRelativeInput.start,
        selectedTextRelativeInput.end - selectedTextRelativeInput.start,
        ASTStyles.Code,
        !!selectedFormats.monospace,
      );
      setAST(newAst);
      addAstToHistory(newAst, selectedTextRelativeInput);
      return {
        ...selectedFormats,
        monospace: !selectedFormats.monospace,
      };
    });
  });

  const handleLinkUrlConfirm = useLastCallback(() => {
    const formattedLinkUrl = (ensureProtocol(linkUrl) || '').split('%').map(encodeURI).join('%');
    if (!selectedTextRelativeInput) {
      return;
    }
    setStyleEditing(true);

    setSelectedTextFormats((selectedFormats) => {
      const newAst = applyStylesToAst(
        getAST(),
        selectedTextRelativeInput.start,
        selectedTextRelativeInput.end - selectedTextRelativeInput.start,
        ASTStyles.TextUrl,
        !formattedLinkUrl?.length,
        formattedLinkUrl,
      );
      setAST(newAst);
      addAstToHistory(newAst, selectedTextRelativeInput);
      return {
        ...selectedFormats,
        textlinkhref: formattedLinkUrl.length ? formattedLinkUrl : '',
      };
    });
    onClose();
  });

  const handleKeyDown = useLastCallback((e: KeyboardEvent) => {
    const HANDLERS_BY_KEY: Record<string, AnyToVoidFunction> = {
      k: openLinkControl,
      b: handleBoldText,
      u: handleUnderlineText,
      i: handleItalicText,
      m: handleMonospaceText,
      s: handleStrikethroughText,
      p: handleSpoilerText,
    };

    const handler = HANDLERS_BY_KEY[getKeyFromEvent(e)];

    if (
      e.altKey
      || !(e.ctrlKey || e.metaKey)
      || !handler
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    handler();
  });

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const lang = useOldLang();

  function handleContainerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && isLinkControlOpen) {
      handleLinkUrlConfirm();
      e.preventDefault();
    }
  }

  if (!shouldRender) {
    return undefined;
  }

  const className = buildClassName(
    'TextFormatter',
    transitionClassNames,
    isLinkControlOpen && 'link-control-shown',
  );

  const linkUrlConfirmClassName = buildClassName(
    'TextFormatter-link-url-confirm',
    (!linkUrl.length || URLValidate(linkUrl)) && 'shown',
  );

  const style = anchorPosition
    ? `left: ${anchorPosition.x}px; top: ${anchorPosition.y}px;--text-formatter-left: ${anchorPosition.x}px;`
    : '';

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      onKeyDown={handleContainerKeyDown}
      // Prevents focus loss when clicking on the toolbar
      onMouseDown={stopEvent}
    >
      <div className="TextFormatter-buttons">
        <Button
          color="translucent"
          ariaLabel="Spoiler text"
          className={getFormatButtonClassName(selectedTextFormats, 'spoiler')}
          onClick={handleSpoilerText}
        >
          <Icon name="eye-closed" />
        </Button>
        <div className="TextFormatter-divider" />
        <Button
          color="translucent"
          ariaLabel="Bold text"
          className={getFormatButtonClassName(selectedTextFormats, 'bold')}
          onClick={handleBoldText}
        >
          <Icon name="bold" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Italic text"
          className={getFormatButtonClassName(selectedTextFormats, 'italic')}
          onClick={handleItalicText}
        >
          <Icon name="italic" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Underlined text"
          className={getFormatButtonClassName(selectedTextFormats, 'underline')}
          onClick={handleUnderlineText}
        >
          <Icon name="underlined" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Strikethrough text"
          className={getFormatButtonClassName(selectedTextFormats, 'strikethrough')}
          onClick={handleStrikethroughText}
        >
          <Icon name="strikethrough" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Monospace text"
          className={getFormatButtonClassName(selectedTextFormats, 'monospace')}
          onClick={handleMonospaceText}
        >
          <Icon name="monospace" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Quote text"
          className={getFormatButtonClassName(selectedTextFormats, 'quote')}
          onClick={handleQuoteText}
        >
          <Icon name="quote_outline" />
        </Button>
        <div className="TextFormatter-divider" />
        <Button
          color="translucent"
          ariaLabel={lang('TextFormat.AddLinkTitle')}
          onClick={openLinkControl}
          className={getFormatButtonClassName(selectedTextFormats, 'textlinkhref')}
        >
          <Icon name="link" />
        </Button>
      </div>

      <div className="TextFormatter-link-control">
        <div className="TextFormatter-buttons">
          <Button color="translucent" ariaLabel={lang('Cancel')} onClick={closeLinkControl}>
            <Icon name="arrow-left" />
          </Button>
          <div className="TextFormatter-divider" />

          <div
            className={buildClassName('TextFormatter-link-url-input-wrapper', inputClassName)}
          >
            <input
              ref={linkUrlInputRef}
              className="TextFormatter-link-url-input"
              type="text"
              value={linkUrl}
              placeholder="Enter URL..."
              autoComplete="off"
              inputMode="url"
              dir="auto"
              onChange={handleLinkUrlChange}
              onScroll={updateInputStyles}
            />
          </div>

          <div className={linkUrlConfirmClassName}>
            <div className="TextFormatter-divider" />
            <Button
              color="translucent"
              ariaLabel={lang('Save')}
              className="color-primary"
              onClick={handleLinkUrlConfirm}
            >
              <Icon name="check" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(TextFormatter);
