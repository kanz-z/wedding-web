/** Window extensions & module declarations */
interface Window {
  enableScroll?: () => void;
  showBottomNav?: () => void;
  copyToClipboard?: (text: string) => void;
  fetchGuestbook?: (page?: number) => void;
}

declare module "aos" {
  interface AosOptions {
    duration?: number;
    easing?: string;
    once?: boolean;
    offset?: number;
  }
  interface AosInstance {
    init(options?: AosOptions): void;
    refresh(): void;
    refreshHard(): void;
  }
  const AOS: AosInstance;
  export default AOS;
}

declare module "qrcodejs" {
  interface QrOptions {
    text: string;
    width?: number;
    height?: number;
    colorDark?: string;
    colorLight?: string;
  }
  class QRCode {
    constructor(el: HTMLElement | string, options: QrOptions);
  }
  export default QRCode;
}

declare module "*.css" {
  const content: string;
  export default content;
}

