declare module 'node-hwp' {
  export interface HwpDocument {
    _hml?: Record<string, unknown>;
  }

  export function open(
    file: string,
    callback: (err: Error | null, doc: HwpDocument) => void,
  ): void;

  export function open(
    file: string,
    option: string | { type: string },
    callback: (err: Error | null, doc: HwpDocument) => void,
  ): void;
}
