import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ThemeKey, ThreadId } from '../../types';
import type { IVecColor } from '../../util/hexToVec3';

import { selectCanAnimateInterface } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { hexToVec3 } from '../../util/hexToVec3';
import { loadShaders } from '../../util/loadShaders';
import { IS_ELECTRON } from '../../util/windowEnvironment';

import './Wallpaper.scss';
import styles from './MiddleColumn.module.scss';

import fragmentShader from '../../assets/shaders/fragment-shader.glsl';
import vertexShader from '../../assets/shaders/vertex-shader.glsl';

interface OwnProps {
  customBackgroundValue?: string;
  customBackground?: string;
  backgroundColor?: string;
  isBackgroundBlurred?: boolean;
  isRightColumnShown?: boolean;
  renderingChatId?: string;
  renderingThreadId?: ThreadId | undefined;
}

interface StateProps {
  theme: ThemeKey;
  isAnimationEnabled: boolean;
}

interface IColors {
  color1: string;
  color2: string;
  color3: string;
  color4: string;
}

interface IVecColors {
  color1: IVecColor;
  color2: IVecColor;
  color3: IVecColor;
  color4: IVecColor;
}

const keyPoints = [
  [0.265, 0.582],
  [0.176, 0.918],
  [1 - 0.585, 1 - 0.164],
  [0.644, 0.755],
  [1 - 0.265, 1 - 0.582],
  [1 - 0.176, 1 - 0.918],
  [0.585, 0.164],
  [1 - 0.644, 1 - 0.755],
];

const BG_LIGHT_COLORS: IColors = {
  color1: '#D7DCBB',
  color2: '#73AA8B',
  color3: '#CED58D',
  color4: '#86B687',
};

const BG_DARK_COLORS: IColors = {
  color1: '#fec496',
  color2: '#dd6cb9',
  color3: '#962fbf',
  color4: '#4f5bd5',
};

const getColors = (themeColors: IColors): IVecColors => ({
  color1: hexToVec3(themeColors.color1),
  color2: hexToVec3(themeColors.color2),
  color3: hexToVec3(themeColors.color3),
  color4: hexToVec3(themeColors.color4),
});

const getColorsByTheme = (theme: ThemeKey) => {
  return getColors(theme === 'dark'
    ? BG_DARK_COLORS
    : BG_LIGHT_COLORS);
};

const Wallpaper = ({
  theme,
  isAnimationEnabled,
  customBackgroundValue,
  customBackground,
  backgroundColor,
  isBackgroundBlurred,
  isRightColumnShown,
  renderingChatId,
  renderingThreadId,
}: StateProps & OwnProps) => {
  const [isWebGLSupport, setIsWebGLSupport] = useState(true);
  // eslint-disable-next-line no-null/no-null
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const maskContainerRef = useRef<HTMLDivElement>(null);

  const colors = useMemo(() => getColorsByTheme(theme), [theme]);

  const glRef = useRef<WebGLRenderingContext | null>();
  const programRef = useRef<WebGLProgram | null>();
  const animatingRef = useRef(false);
  const keyShiftRef = useRef(0);
  const positionsRef = useRef<{
    color1: number[];
    color2: number[];
    color3: number[];
    color4: number[];
    target1: number[];
    target2: number[];
    target3: number[];
    target4: number[];
  }>({
    color1: [0, 0],
    color2: [0, 0],
    color3: [0, 0],
    color4: [0, 0],
    target1: [],
    target2: [],
    target3: [],
    target4: [],
  });

  const updateTargetColors = () => {
    const shift = keyShiftRef.current;
    positionsRef.current.target1 = keyPoints[shift % 8];
    positionsRef.current.target2 = keyPoints[(shift + 2) % 8];
    positionsRef.current.target3 = keyPoints[(shift + 4) % 8];
    positionsRef.current.target4 = keyPoints[(shift + 6) % 8];
    keyShiftRef.current = (shift + 1) % 8;
  };

  const renderGradientCanvas = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program) return;

    const resolutionLoc = gl.getUniformLocation(program, 'resolution');
    const color1Loc = gl.getUniformLocation(program, 'color1');
    const color2Loc = gl.getUniformLocation(program, 'color2');
    const color3Loc = gl.getUniformLocation(program, 'color3');
    const color4Loc = gl.getUniformLocation(program, 'color4');
    const color1PosLoc = gl.getUniformLocation(program, 'color1Pos');
    const color2PosLoc = gl.getUniformLocation(program, 'color2Pos');
    const color3PosLoc = gl.getUniformLocation(program, 'color3Pos');
    const color4PosLoc = gl.getUniformLocation(program, 'color4Pos');

    if (
      !resolutionLoc
      || !color1Loc
      || !color2Loc
      || !color3Loc
      || !color4Loc
      || !color1PosLoc
      || !color2PosLoc
      || !color3PosLoc
      || !color4PosLoc
    ) return;

    gl.uniform2fv(resolutionLoc, [gl.canvas.width, gl.canvas.height]);
    gl.uniform3fv(color1Loc, colors.color1);
    gl.uniform3fv(color2Loc, colors.color2);
    gl.uniform3fv(color3Loc, colors.color3);
    gl.uniform3fv(color4Loc, colors.color4);
    gl.uniform2fv(color1PosLoc, positionsRef.current.color1);
    gl.uniform2fv(color2PosLoc, positionsRef.current.color2);
    gl.uniform2fv(color3PosLoc, positionsRef.current.color3);
    gl.uniform2fv(color4PosLoc, positionsRef.current.color4);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [colors]);

  const animate = useCallback(() => {
    animatingRef.current = true;
    const {
      color1, color2, color3, color4, target1, target2, target3, target4,
    } = positionsRef.current;
    const speed = 0.1;

    const distance = (p1: number[], p2: number[]) => Math.sqrt((p1[1] - p2[1]) ** 2);

    if (
      distance(color1, target1) > 0.01
      || distance(color2, target2) > 0.01
      || distance(color3, target3) > 0.01
      || distance(color4, target4) > 0.01
    ) {
      positionsRef.current.color1 = [
        color1[0] * (1 - speed) + target1[0] * speed,
        color1[1] * (1 - speed) + target1[1] * speed,
      ];
      positionsRef.current.color2 = [
        color2[0] * (1 - speed) + target2[0] * speed,
        color2[1] * (1 - speed) + target2[1] * speed,
      ];
      positionsRef.current.color3 = [
        color3[0] * (1 - speed) + target3[0] * speed,
        color3[1] * (1 - speed) + target3[1] * speed,
      ];
      positionsRef.current.color4 = [
        color4[0] * (1 - speed) + target4[0] * speed,
        color4[1] * (1 - speed) + target4[1] * speed,
      ];

      renderGradientCanvas();
      requestAnimationFrame(animate);
    } else {
      animatingRef.current = false;
    }
  }, [renderGradientCanvas]);

  useEffect(() => {
    if (!isWebGLSupport || customBackground) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      setIsWebGLSupport(false);
      return;
    }
    glRef.current = gl;

    const program = gl.createProgram();
    if (!program) {
      setIsWebGLSupport(false);
      return;
    }
    programRef.current = program;

    const shaders = loadShaders(gl, [vertexShader, fragmentShader]);
    shaders.forEach((shader) => gl.attachShader(program, shader));
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setIsWebGLSupport(false);
      return;
    }

    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    const positionBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1,
      ]),
      gl.STATIC_DRAW,
    );

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  }, [customBackground, isWebGLSupport]);

  useEffect(() => {
    if (!isWebGLSupport || customBackground) {
      return;
    }
    updateTargetColors();

    positionsRef.current.color1 = positionsRef.current.target1;
    positionsRef.current.color2 = positionsRef.current.target2;
    positionsRef.current.color3 = positionsRef.current.target3;
    positionsRef.current.color4 = positionsRef.current.target4;

    if (document.startViewTransition) {
      document.startViewTransition(() => {
        renderGradientCanvas();
        containerRef.current?.classList.toggle('wallpaper-mask', theme === 'dark');
      });
    } else {
      renderGradientCanvas();
      containerRef.current?.classList.toggle('wallpaper-mask', theme === 'dark');
    }
  }, [theme, renderGradientCanvas, isWebGLSupport, customBackground]);

  useEffect(() => {
    if (!isWebGLSupport || customBackground) {
      return undefined;
    }
    const handleAnimate = () => {
      if (isAnimationEnabled) {
        updateTargetColors();
        if (!animatingRef.current) requestAnimationFrame(animate);
      }
    };

    window.addEventListener('onMessageSend', handleAnimate);
    return () => {
      window.removeEventListener('onMessageSend', handleAnimate);
    };
  }, [animate, customBackground, isAnimationEnabled, isWebGLSupport]);

  return (isWebGLSupport && !customBackgroundValue ? (
    <div ref={containerRef} className="wallpaper-wrap">
      <canvas ref={canvasRef} className="wallpaper-canvas" />
      <div ref={maskContainerRef} className="wallpaper-pattern" />
    </div>
  ) : (
    <div
      className={buildClassName(
        styles.background,
        styles.withTransition,
        customBackground && styles.customBgImage,
        backgroundColor && styles.customBgColor,
        customBackground && isBackgroundBlurred && styles.blurred,
        isRightColumnShown && styles.withRightColumn,
        IS_ELECTRON && !(renderingChatId && renderingThreadId) && styles.draggable,
      )}
      style={customBackgroundValue ? `--custom-background: ${customBackgroundValue}` : undefined}
    />
  )
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { theme } = global.settings.byKey;
    const isAnimationEnabled = selectCanAnimateInterface(global);

    return {
      theme,
      isAnimationEnabled,
    };
  },
)(Wallpaper));
