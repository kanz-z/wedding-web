/** Window extensions & module declarations */
interface Window {
  enableScroll?: () => void;
  showBottomNav?: () => void;
  copyToClipboard?: (text: string) => void;
  fetchGuestbook?: (page?: number) => void;
}

declare module "aos" {
  const AOS: any;
  export default AOS;
}

declare module "qrcodejs" {
  const QRCode: any;
  export default QRCode;
}

declare module "*.css" {
  const content: string;
  export default content;
}

