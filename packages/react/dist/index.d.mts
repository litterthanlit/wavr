import * as react_jsx_runtime from 'react/jsx-runtime';
import { GradientConfig } from '@wavr/core';
export { GradientConfig, LayerConfig, RGBColor } from '@wavr/core';

interface WavrGradientProps {
    config: GradientConfig;
    className?: string;
    style?: React.CSSProperties;
    interactive?: boolean;
    paused?: boolean;
    scrollLinked?: boolean;
    scrollDuration?: number;
    speed?: number;
    onError?: (error: Error) => void;
}
declare function WavrGradient({ config, className, style, interactive, paused, scrollLinked, scrollDuration, speed, onError, }: WavrGradientProps): react_jsx_runtime.JSX.Element;

export { WavrGradient, type WavrGradientProps };
